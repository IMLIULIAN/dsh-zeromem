/**
 * Read-only Markdown export (Obsidian/Git friendly) and SQLite Online Backup snapshots.
 *
 * Parity with Python ZeroMem (`v2mem/portability.py`), zero third-party dependencies:
 * 1. `exportMarkdown`:
 *    - 100% read-only: opens SQLite read-only with `PRAGMA query_only = ON`, never mutates DB.
 *    - Zero LLM calls; defense-in-depth credential redaction via `redactCredentials`.
 *    - Preserves bound original evidence quotes, timeline fields (`occurred_start` / `occurred_end`),
 *      supersession lineage (`supersedes_fact_id` / `superseded_by`), and `until:` expiry status.
 *    - Supports in-memory stdout mode, single file (`outputPath`), or per-namespace Obsidian/Git
 *      directory (`outputDir` with `INDEX.md`).
 * 2. `backupDatabase`:
 *    - Uses Node built-in `node:sqlite` Online Backup API (`backup`) so active WAL readers/writers
 *      are never blocked or corrupted.
 *    - Flattens the destination snapshot to `PRAGMA journal_mode = DELETE`, guaranteeing a clean
 *      single-file snapshot with zero `-wal`/`-shm` sidecars (safe for OneDrive/BaiduSyncdisk/iCloud).
 *    - Verifies `PRAGMA integrity_check === 'ok'`, computes SHA-256, and publishes atomically.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, backup as sqliteOnlineBackup } from "node:sqlite";

import { expandHome } from "./config.mjs";
import { redactCredentials } from "./contracts.mjs";
import {
  evaluateExpiry,
  factMatchesOccurredRange,
  normalizeOccurredRange,
  parseUntilDate,
  resolveAsOfDate,
} from "./expiry.mjs";
import { APP_FORMAT_ID } from "./store.mjs";

const UNSAFE_FILENAME_RE = /[<>:"/\\|?*\x00-\x1f]+/g;
const RESERVED_STEMS = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
  "INDEX",
]);

function utcNowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function sha256File(filePath) {
  const hash = createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.allocUnsafe(65536);
    while (true) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n <= 0) break;
      hash.update(n === buf.length ? buf : buf.subarray(0, n));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function hasTable(db, tableName) {
  const row = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(String(tableName));
  return Boolean(row);
}

function openReadOnlyDb(dbFile) {
  let db;
  try {
    db = new DatabaseSync(dbFile, { readOnly: true, timeout: 15_000 });
    db.exec("PRAGMA query_only = ON;");
    // Touch sqlite_master to confirm readable even if WAL lacks -shm
    db.prepare("SELECT 1 AS ok FROM sqlite_master LIMIT 1").get();
    return db;
  } catch {
    try {
      if (db) db.close();
    } catch {
      // ignore
    }
    const fallback = new DatabaseSync(dbFile, { timeout: 15_000 });
    fallback.exec("PRAGMA query_only = ON;");
    fallback.exec("PRAGMA busy_timeout = 15000;");
    return fallback;
  }
}

function atomicWriteText(targetPath, text) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const base = path.basename(targetPath);
  const tmpPath = path.join(dir, `.${base}.tmp.${process.pid}.${Date.now()}`);
  try {
    const fd = fs.openSync(tmpPath, "w", 0o600);
    try {
      fs.writeSync(fd, text, 0, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, targetPath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup error
    }
    throw err;
  }
}

function safeNamespaceStem(namespace, usedSet) {
  let cleaned = String(namespace || "")
    .trim()
    .replace(UNSAFE_FILENAME_RE, "_")
    .replace(/^[ .]+|[ .]+$/g, "");
  if (!cleaned || RESERVED_STEMS.has(cleaned.toUpperCase())) {
    cleaned = `ns_${cleaned || "default"}`;
  }
  cleaned = cleaned.slice(0, 80);
  let candidate = cleaned;
  if (usedSet.has(candidate.toLowerCase())) {
    const digest = createHash("sha256").update(String(namespace), "utf8").digest("hex").slice(0, 6);
    candidate = `${cleaned}_${digest}`;
  }
  usedSet.add(candidate.toLowerCase());
  return candidate;
}

function yamlScalar(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return JSON.stringify(String(value));
}

function formatBlockquote(prefix, text) {
  const safeText = redactCredentials(String(text || ""))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  const lines = safeText ? safeText.split("\n") : [""];
  const out = [`> ${prefix}${lines[0]}`];
  for (let i = 1; i < lines.length; i++) {
    out.push(lines[i] ? `> ${lines[i]}` : ">");
  }
  return out.join("\n");
}

function renderFactMarkdown(fact) {
  const fid = fact.fact_id;
  const badges = [`\`${fact.type}\``];
  if (fact.action === "revise") badges.push("`已纠错`");
  if (fact.supersedes_fact_id !== null && fact.supersedes_fact_id !== undefined) {
    badges.push(`\`替代 #${fact.supersedes_fact_id}\``);
  }
  if (Array.isArray(fact.superseded_by) && fact.superseded_by.length) {
    const supRefs = fact.superseded_by.map((x) => `#${x}`).join(", ");
    badges.push(`\`已被 ${supRefs} 替代\``);
  }
  if (fact.until_expiry?.label) {
    badges.push(`\`${fact.until_expiry.label}\``);
  }

  const lines = [`### Fact #${fid} ${badges.join(" ")}`, ""];
  lines.push(redactCredentials(fact.text));
  lines.push("");

  const metaParts = [];
  if (fact.occurred_start) {
    let occ = String(fact.occurred_start);
    if (fact.occurred_end && String(fact.occurred_end) !== occ) {
      occ = `${occ} ~ ${fact.occurred_end}`;
    }
    metaParts.push(`**发生时间**: \`${occ}\``);
  }
  metaParts.push(`**记录时间**: \`${fact.mentioned_at}\``);
  if (fact.where) {
    metaParts.push(`**地点/环境**: ${redactCredentials(String(fact.where))}`);
  }
  let srcRef = `\`${fact.doc_id}\``;
  if (fact.source_id) {
    srcRef += ` (${redactCredentials(String(fact.source_id))})`;
  }
  metaParts.push(`**来源**: ${srcRef}`);
  lines.push(`- ${metaParts.join(" | ")}`);

  if (Array.isArray(fact.entities) && fact.entities.length) {
    const entStr = fact.entities.map((e) => `\`${redactCredentials(String(e))}\``).join(" ");
    lines.push(`- **实体/标签**: ${entStr}`);
  }

  if (fact.supersedes_fact_id !== null && fact.supersedes_fact_id !== undefined) {
    lines.push(`- **演化关系**: 替代旧事实 \`Fact #${fact.supersedes_fact_id}\``);
  }
  if (Array.isArray(fact.superseded_by) && fact.superseded_by.length) {
    const newer = fact.superseded_by.map((x) => `\`Fact #${x}\``).join(", ");
    lines.push(`- **历史状态**: 已被更新事实 ${newer} 替代`);
  }

  if (Array.isArray(fact.evidence) && fact.evidence.length) {
    lines.push("");
    for (const ev of fact.evidence) {
      const rolePart = ev.role ? ` · \`${ev.role}\`` : "";
      lines.push(formatBlockquote(`**原文证据 (\`${ev.id}\`${rolePart})**: `, String(ev.text || "")));
    }
  }

  lines.push("");
  return lines.join("\n");
}

function renderEvictedSection(evictedRows) {
  if (!Array.isArray(evictedRows) || !evictedRows.length) return "";
  const lines = [
    "---",
    "",
    "## 回收站归档记录（`evicted_records`）",
    "",
    "| 批次 ID | 类型 | 记录 ID | 空间 | 原因 | 淘汰时间 | SHA-256 (前12位) |",
    "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
  ];
  for (const r of evictedRows) {
    lines.push(
      `| \`${r.batch_id}\` | \`${r.record_kind}\` | \`${r.record_id}\` | ` +
        `\`${r.namespace}\` | ${redactCredentials(String(r.reason))} | ` +
        `\`${r.evicted_at}\` | \`${String(r.content_sha256).slice(0, 12)}\` |`
    );
  }
  lines.push("");
  return lines.join("\n");
}

function loadExportData(
  dbFile,
  {
    namespace = null,
    fromDate = null,
    toDate = null,
    asOfDate,
    includeSuperseded = true,
    includeEvicted = false,
  }
) {
  const db = openReadOnlyDb(dbFile);
  let factRows = [];
  let docRows = [];
  const segCache = new Map();
  const supersedesMap = new Map();
  const supersededByMap = new Map();
  let evictedBatches = [];

  try {
    if (namespace) {
      factRows = db
        .prepare(
          `SELECT * FROM facts WHERE namespace = ?
           ORDER BY namespace ASC, COALESCE(occurred_start, mentioned_at) DESC, fact_id ASC`
        )
        .all(namespace)
        .map((r) => ({ ...r }));
      docRows = db
        .prepare("SELECT doc_id, source_id FROM documents WHERE namespace = ?")
        .all(namespace)
        .map((r) => ({ ...r }));
    } else {
      factRows = db
        .prepare(
          `SELECT * FROM facts
           ORDER BY namespace ASC, COALESCE(occurred_start, mentioned_at) DESC, fact_id ASC`
        )
        .all()
        .map((r) => ({ ...r }));
      docRows = db
        .prepare("SELECT doc_id, source_id FROM documents")
        .all()
        .map((r) => ({ ...r }));
    }

    const docIds = [...new Set(factRows.map((r) => String(r.doc_id)))].sort();
    const segStmt = db.prepare("SELECT seg_id, role, text FROM segments WHERE doc_id = ?");
    for (const did of docIds) {
      const m = new Map();
      for (const sr of segStmt.all(did)) {
        m.set(String(sr.seg_id), {
          id: String(sr.seg_id),
          role: sr.role ?? null,
          text: String(sr.text),
        });
      }
      segCache.set(did, m);
    }

    if (factRows.length && hasTable(db, "fact_supersessions")) {
      for (const srow of db
        .prepare("SELECT new_fact_id, old_fact_id FROM fact_supersessions ORDER BY old_fact_id ASC")
        .all()) {
        const nid = Number(srow.new_fact_id);
        const oid = Number(srow.old_fact_id);
        if (!supersedesMap.has(nid)) supersedesMap.set(nid, []);
        supersedesMap.get(nid).push(oid);
      }
      for (const srow of db
        .prepare(
          `SELECT fs.old_fact_id, fs.new_fact_id FROM fact_supersessions fs
           JOIN facts nf ON nf.fact_id = fs.new_fact_id ORDER BY fs.new_fact_id ASC`
        )
        .all()) {
        const oid = Number(srow.old_fact_id);
        const nid = Number(srow.new_fact_id);
        if (!supersededByMap.has(oid)) supersededByMap.set(oid, []);
        supersededByMap.get(oid).push(nid);
      }
    }

    if (includeEvicted && hasTable(db, "evicted_records")) {
      const erows = namespace
        ? db
            .prepare(
              `SELECT batch_id, record_kind, record_id, namespace, reason, evicted_at, content_sha256
               FROM evicted_records WHERE namespace = ? ORDER BY evicted_at DESC, batch_id ASC`
            )
            .all(namespace)
        : db
            .prepare(
              `SELECT batch_id, record_kind, record_id, namespace, reason, evicted_at, content_sha256
               FROM evicted_records ORDER BY evicted_at DESC, batch_id ASC`
            )
            .all();
      evictedBatches = erows.map((r) => ({ ...r }));
    }
  } finally {
    db.close();
  }

  const docSourceMap = new Map(docRows.map((r) => [String(r.doc_id), r.source_id ?? null]));
  const byNs = new Map();
  const referencedDocs = new Set();
  let supersededCnt = 0;
  let expiredCnt = 0;
  let totalFacts = 0;

  for (const row of factRows) {
    if (
      !factMatchesOccurredRange(row.occurred_start, row.occurred_end, {
        fromDate,
        toDate,
      })
    ) {
      continue;
    }
    const fid = Number(row.fact_id);
    const supBy = supersededByMap.get(fid) || null;
    if (!includeSuperseded && supBy) continue;

    const did = String(row.doc_id);
    const ns = String(row.namespace);
    const evIds = safeJsonParse(row.evidence_ids_json || "[]", []);
    const entities = safeJsonParse(row.entities_json || "[]", []);
    const segMap = segCache.get(did) || new Map();
    const evClean = (Array.isArray(evIds) ? evIds : [])
      .map((eid) => segMap.get(String(eid)))
      .filter(Boolean);

    const untilDate = parseUntilDate({
      tags: entities,
      text: String(row.text || ""),
      evidence: evClean,
    });
    const expiryInfo = evaluateExpiry(untilDate, asOfDate);

    const item = {
      fact_id: fid,
      doc_id: did,
      source_id: docSourceMap.get(did) ?? null,
      namespace: ns,
      text: String(row.text),
      type: String(row.type),
      occurred_start: row.occurred_start ?? null,
      occurred_end: row.occurred_end ?? null,
      where: row.where_loc ?? null,
      entities: Array.isArray(entities) ? entities : [],
      evidence: evClean,
      action: String(row.action),
      mentioned_at: String(row.mentioned_at),
      until_expiry: expiryInfo,
      supersedes_fact_id: supersedesMap.has(fid) ? supersedesMap.get(fid)[0] : null,
      superseded_by: supBy,
    };

    if (!byNs.has(ns)) byNs.set(ns, []);
    byNs.get(ns).push(item);
    referencedDocs.add(did);
    totalFacts += 1;
    if (supBy) supersededCnt += 1;
    if (expiryInfo) expiredCnt += 1;
  }

  return {
    byNs,
    evictedRows: evictedBatches,
    counts: {
      facts_exported: totalFacts,
      documents_referenced: referencedDocs.size,
      superseded_facts: supersededCnt,
      expired_facts: expiredCnt,
      evicted_records: evictedBatches.length,
    },
  };
}

/**
 * Read-only export of ZeroMem SQLite facts and bound original evidence to Obsidian/Git Markdown.
 */
export function exportMarkdown({
  dbPath,
  outputPath = null,
  outputDir = null,
  namespace = null,
  occurredFrom = null,
  occurredTo = null,
  asOf = null,
  includeSuperseded = true,
  includeEvicted = false,
  frontmatter = true,
} = {}) {
  if (outputPath !== null && outputPath !== undefined && outputDir !== null && outputDir !== undefined) {
    throw new Error("export-target-conflict: specify either outputPath or outputDir, not both");
  }

  const dbFile = expandHome(dbPath);
  if (!dbFile || !fs.existsSync(dbFile) || !fs.statSync(dbFile).isFile()) {
    throw new Error(`db-not-found: ${dbFile || dbPath}`);
  }

  const { fromDate, toDate } = normalizeOccurredRange(occurredFrom, occurredTo);
  const asOfDate = resolveAsOfDate(asOf);
  const exportedAt = utcNowIso();

  const { byNs, evictedRows, counts } = loadExportData(dbFile, {
    namespace: namespace || null,
    fromDate,
    toDate,
    asOfDate,
    includeSuperseded: Boolean(includeSuperseded),
    includeEvicted: Boolean(includeEvicted),
  });
  const namespaces = [...byNs.keys()].sort();

  if (outputDir !== null && outputDir !== undefined) {
    const outRoot = expandHome(outputDir);
    fs.mkdirSync(outRoot, { recursive: true });
    const usedStems = new Set();
    const writtenFiles = [];
    const indexRows = [];

    for (const ns of namespaces) {
      const facts = byNs.get(ns);
      const stem = safeNamespaceStem(ns, usedStems);
      const nsFile = path.join(outRoot, `${stem}.md`);
      const nsDocs = new Set(facts.map((f) => f.doc_id)).size;
      const nsSup = facts.filter((f) => Array.isArray(f.superseded_by) && f.superseded_by.length).length;
      const nsExp = facts.filter((f) => Boolean(f.until_expiry)).length;

      const parts = [];
      if (frontmatter) {
        parts.push(
          "---",
          `generator: ${yamlScalar("ZeroMem")}`,
          "read_only: true",
          `namespace: ${yamlScalar(ns)}`,
          `exported_at: ${yamlScalar(exportedAt)}`,
          `as_of: ${yamlScalar(asOfDate)}`,
          `facts: ${facts.length}`,
          `documents: ${nsDocs}`,
          `superseded_facts: ${nsSup}`,
          `expired_facts: ${nsExp}`,
          "---",
          ""
        );
      }
      parts.push(`# ZeroMem 空间：${ns}`, "");
      const rangeNote =
        fromDate || toDate ? ` · 时间过滤 \`${fromDate || "*"} ~ ${toDate || "*"}\`` : "";
      parts.push(
        `> 只读导出快照 · 导出时间 \`${exportedAt}\` · 事实 \`${facts.length}\` 条 · 文档 \`${nsDocs}\` 篇${rangeNote}`,
        ""
      );
      for (const f of facts) parts.push(renderFactMarkdown(f));
      const nsEvicted = evictedRows.filter((r) => String(r.namespace) === ns);
      if (nsEvicted.length) parts.push(renderEvictedSection(nsEvicted));

      atomicWriteText(nsFile, `${parts.join("\n").trimEnd()}\n`);
      writtenFiles.push(nsFile);
      indexRows.push(`| [${ns}](./${stem}.md) | ${facts.length} | ${nsDocs} | ${nsSup} | ${nsExp} |`);
    }

    const idxParts = [];
    if (frontmatter) {
      idxParts.push(
        "---",
        `generator: ${yamlScalar("ZeroMem")}`,
        "read_only: true",
        `exported_at: ${yamlScalar(exportedAt)}`,
        `as_of: ${yamlScalar(asOfDate)}`,
        `namespaces: ${namespaces.length}`,
        `facts: ${counts.facts_exported}`,
        `documents: ${counts.documents_referenced}`,
        "---",
        ""
      );
    }
    idxParts.push(
      "# ZeroMem 本地记忆只读索引",
      "",
      `- **导出时间**：\`${exportedAt}\``,
      `- **基准日期 (\`as_of\`)**：\`${asOfDate}\``,
      `- **命名空间数**：\`${namespaces.length}\` · **事实总数**：\`${counts.facts_exported}\` · **关联文档**：\`${counts.documents_referenced}\``,
      ""
    );
    if (indexRows.length) {
      idxParts.push(
        "| 空间 | 事实数 | 文档数 | 已替代 | 已过期 |",
        "| :--- | :---: | :---: | :---: | :---: |",
        ...indexRows,
        ""
      );
    } else {
      idxParts.push("_当前筛选条件下无匹配记忆。_\n");
    }
    if (evictedRows.length) idxParts.push(renderEvictedSection(evictedRows));

    const idxFile = path.join(outRoot, "INDEX.md");
    atomicWriteText(idxFile, `${idxParts.join("\n").trimEnd()}\n`);
    writtenFiles.unshift(idxFile);

    return {
      ok: true,
      mode: "directory",
      format: "markdown",
      read_only: true,
      db_path: dbFile,
      output_dir: outRoot,
      exported_at: exportedAt,
      as_of: asOfDate,
      occurred_from: fromDate,
      occurred_to: toDate,
      namespaces,
      ...counts,
      files_written: writtenFiles,
    };
  }

  const parts = [];
  if (frontmatter) {
    parts.push(
      "---",
      `generator: ${yamlScalar("ZeroMem")}`,
      "read_only: true",
      `exported_at: ${yamlScalar(exportedAt)}`,
      `as_of: ${yamlScalar(asOfDate)}`,
      `namespaces: ${namespaces.length}`,
      `facts: ${counts.facts_exported}`,
      `documents: ${counts.documents_referenced}`,
      `superseded_facts: ${counts.superseded_facts}`,
      `expired_facts: ${counts.expired_facts}`,
      "---",
      ""
    );
  }
  parts.push("# ZeroMem 本地记忆只读导出", "");
  const rangeNote =
    fromDate || toDate ? ` · 事件时间过滤 \`${fromDate || "*"} ~ ${toDate || "*"}\`` : "";
  parts.push(
    `> 导出时间 \`${exportedAt}\` · 空间 \`${namespaces.length}\` 个 · 事实 \`${counts.facts_exported}\` 条 · 文档 \`${counts.documents_referenced}\` 篇${rangeNote}`,
    ""
  );
  if (!namespaces.length) {
    parts.push("_当前筛选条件下无匹配记忆。_", "");
  }
  for (const ns of namespaces) {
    const facts = byNs.get(ns);
    parts.push(`## 空间：\`${ns}\`（${facts.length} 条）`, "");
    for (const f of facts) parts.push(renderFactMarkdown(f));
  }
  if (evictedRows.length) parts.push(renderEvictedSection(evictedRows));

  const mdText = `${parts.join("\n").trimEnd()}\n`;
  const writtenFiles = [];
  let outFileStr = null;
  if (outputPath !== null && outputPath !== undefined) {
    const outFile = expandHome(outputPath);
    atomicWriteText(outFile, mdText);
    outFileStr = outFile;
    writtenFiles.push(outFileStr);
  }

  const res = {
    ok: true,
    mode: outputPath !== null && outputPath !== undefined ? "file" : "stdout",
    format: "markdown",
    read_only: true,
    db_path: dbFile,
    output_path: outFileStr,
    exported_at: exportedAt,
    as_of: asOfDate,
    occurred_from: fromDate,
    occurred_to: toDate,
    namespaces,
    ...counts,
    files_written: writtenFiles,
  };
  if (outputPath === null || outputPath === undefined) {
    res.markdown = mdText;
  }
  return res;
}

function sameFilePath(a, b) {
  const pa = path.resolve(a);
  const pb = path.resolve(b);
  return process.platform === "win32" ? pa.toLowerCase() === pb.toLowerCase() : pa === pb;
}

function formatBackupStamp(dt) {
  const p2 = (n) => String(n).padStart(2, "0");
  return (
    `${dt.getUTCFullYear()}${p2(dt.getUTCMonth() + 1)}${p2(dt.getUTCDate())}-` +
    `${p2(dt.getUTCHours())}${p2(dt.getUTCMinutes())}${p2(dt.getUTCSeconds())}`
  );
}

/**
 * Create a clean, self-contained SQLite Online Backup snapshot (journal_mode=DELETE, zero WAL sidecars).
 */
export async function backupDatabase({
  dbPath,
  outputPath = null,
  overwrite = false,
  verify = true,
  writeSha256 = false,
  pages = 256,
} = {}) {
  const started = performance.now();
  const dbFile = expandHome(dbPath);
  if (!dbFile || !fs.existsSync(dbFile) || !fs.statSync(dbFile).isFile()) {
    throw new Error(`db-not-found: ${dbFile || dbPath}`);
  }

  const nowDt = new Date();
  const stamp = formatBackupStamp(nowDt);
  const defaultName = `zeromem-backup-${stamp}.db`;

  let dest;
  if (outputPath === null || outputPath === undefined || !String(outputPath).trim()) {
    dest = path.resolve(path.dirname(dbFile), "backups", defaultName);
  } else {
    const rawOut = String(outputPath).trim();
    const cand = expandHome(rawOut);
    const isDir = (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) || rawOut.endsWith("/") || rawOut.endsWith("\\");
    dest = isDir ? path.resolve(cand, defaultName) : path.resolve(cand);
  }

  if (sameFilePath(dest, dbFile)) {
    throw new Error("backup-target-equals-source: destination must be different from active database");
  }
  if (fs.existsSync(dest) && !overwrite) {
    throw new Error(`backup-target-exists: ${dest} (pass overwrite=true to replace)`);
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmpPath = path.join(
    path.dirname(dest),
    `.${path.basename(dest)}.tmp.${process.pid}.${Date.now()}`
  );

  let srcDb = null;
  let dstDb = null;
  let finalJmode = "delete";
  let integrity = "skipped";
  let appId = 0;
  let schemaVer = null;
  let counts = {
    documents: 0,
    segments: 0,
    facts: 0,
    evicted_records: 0,
    supersessions: 0,
  };

  try {
    // Open source read-only via query_only pragma (safe over active WAL databases)
    srcDb = new DatabaseSync(dbFile, { timeout: 20_000 });
    srcDb.exec("PRAGMA query_only = ON;");
    srcDb.exec("PRAGMA busy_timeout = 20000;");

    await sqliteOnlineBackup(srcDb, tmpPath, {
      rate: Math.max(1, Math.trunc(Number(pages) || 256)),
    });

    srcDb.close();
    srcDb = null;

    // Flatten WAL into a clean single file safe for cloud drives (OneDrive/BaiduSyncdisk/iCloud)
    dstDb = new DatabaseSync(tmpPath, { timeout: 20_000 });
    dstDb.exec("PRAGMA busy_timeout = 20000;");
    const jmodeRow = dstDb.prepare("PRAGMA journal_mode = DELETE").get();
    finalJmode = jmodeRow ? String(Object.values(jmodeRow)[0]).toLowerCase() : "delete";

    if (verify) {
      const icRows = dstDb.prepare("PRAGMA integrity_check").all();
      const icVals = icRows.map((r) => String(Object.values(r)[0]));
      if (icVals.length !== 1 || icVals[0].toLowerCase() !== "ok") {
        throw new Error(`backup-integrity-failed: ${JSON.stringify(icVals.slice(0, 5))}`);
      }
      integrity = "ok";
    }

    const appRow = dstDb.prepare("PRAGMA application_id").get();
    appId = appRow ? Number(Object.values(appRow)[0]) : 0;
    if (hasTable(dstDb, "meta")) {
      const srow = dstDb.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
      schemaVer = srow ? String(srow.value) : null;
    }

    counts = {
      documents: hasTable(dstDb, "documents")
        ? Number(dstDb.prepare("SELECT COUNT(*) AS c FROM documents").get().c)
        : 0,
      segments: hasTable(dstDb, "segments")
        ? Number(dstDb.prepare("SELECT COUNT(*) AS c FROM segments").get().c)
        : 0,
      facts: hasTable(dstDb, "facts")
        ? Number(dstDb.prepare("SELECT COUNT(*) AS c FROM facts").get().c)
        : 0,
      evicted_records: hasTable(dstDb, "evicted_records")
        ? Number(dstDb.prepare("SELECT COUNT(*) AS c FROM evicted_records").get().c)
        : 0,
      supersessions: hasTable(dstDb, "fact_supersessions")
        ? Number(dstDb.prepare("SELECT COUNT(*) AS c FROM fact_supersessions").get().c)
        : 0,
    };

    dstDb.close();
    dstDb = null;

    for (const suf of ["-wal", "-shm"]) {
      const sidecar = `${tmpPath}${suf}`;
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }

    fs.renameSync(tmpPath, dest);
  } catch (err) {
    if (srcDb) {
      try {
        srcDb.close();
      } catch {
        // ignore
      }
    }
    if (dstDb) {
      try {
        dstDb.close();
      } catch {
        // ignore
      }
    }
    for (const p of [tmpPath, `${tmpPath}-wal`, `${tmpPath}-shm`]) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // ignore
      }
    }
    throw err;
  }

  const walSidecars = ["-wal", "-shm"].some((suf) => fs.existsSync(`${dest}${suf}`));
  const digest = sha256File(dest);
  const sizeBytes = fs.statSync(dest).size;

  let shaFilePath = null;
  if (writeSha256) {
    const shaTarget = `${dest}.sha256`;
    atomicWriteText(shaTarget, `${digest}  ${path.basename(dest)}\n`);
    shaFilePath = shaTarget;
  }

  const elapsedMs = Number((performance.now() - started).toFixed(2));
  return {
    ok: true,
    method: "sqlite_online_backup",
    source_db: dbFile,
    backup_path: dest,
    created_at: nowDt.toISOString().replace(/\.\d{3}Z$/, "Z"),
    journal_mode: finalJmode,
    wal_sidecars_present: walSidecars,
    integrity_check: integrity,
    application_id: appId,
    application_id_valid: appId === APP_FORMAT_ID,
    schema_version: schemaVer,
    size_bytes: sizeBytes,
    sha256: digest,
    sha256_file: shaFilePath,
    counts,
    elapsed_ms: elapsedMs,
  };
}
