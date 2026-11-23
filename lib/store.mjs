/**
 * Single-file SQLite store powered by Node built-in `node:sqlite` (zero native builds).
 *
 * 100% schema & tokenization compatible with Python ZeroMem (`v2mem/store.py` & `v2mem/governance.py`):
 *   - PRAGMA application_id = 0x494D4C4C
 *   - meta(schema_version='1', schema_sig='42e7ab99494de6a6b4e88eb2')
 *   - documents, segments, facts, facts_fts (dual-track fact_tokens + evidence_tokens)
 *   - evicted_records side table with canonical SHA-256 tamper verification
 */

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  ADAPTIVE_MIN_LIMIT,
  ADAPTIVE_SCORE_RATIO,
  parseUntilDate,
  partitionExpired,
  resolveAsOfDate,
  resolveDefaultLimit,
  selectAdaptiveHits,
} from "./expiry.mjs";

// SQLite file format application_id & schema format signature (ZeroMem v1 parity)
export const APP_FORMAT_ID = 0x494d4c4c;
export const SCHEMA_SIG = "42e7ab99494de6a6b4e88eb2";
export const FORMAT_DIGEST = "c9f48efabf95bb82308f0c10";

const ASCII_WORD_RE = /[a-z0-9][a-z0-9._:/-]*/g;
const CJK_RUN_RE = /[\u4e00-\u9fff]+/g;

const SCHEMA_SQL = `
PRAGMA application_id = ${APP_FORMAT_ID};
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
    doc_id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    source_id TEXT,
    mentioned_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_ns_sha
    ON documents(namespace, content_sha256);

CREATE TABLE IF NOT EXISTS segments (
    doc_id TEXT NOT NULL,
    seg_id TEXT NOT NULL,
    namespace TEXT NOT NULL,
    path_json TEXT NOT NULL,
    role TEXT,
    text TEXT NOT NULL,
    mentioned_at TEXT NOT NULL,
    PRIMARY KEY (doc_id, seg_id)
);

CREATE TABLE IF NOT EXISTS facts (
    fact_id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id TEXT NOT NULL,
    namespace TEXT NOT NULL,
    text TEXT NOT NULL,
    type TEXT NOT NULL,
    occurred_start TEXT,
    occurred_end TEXT,
    where_loc TEXT,
    entities_json TEXT NOT NULL,
    evidence_ids_json TEXT NOT NULL,
    action TEXT NOT NULL,
    mentioned_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_facts_ns_time
    ON facts(namespace, mentioned_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
    fact_tokens,
    evidence_tokens,
    namespace UNINDEXED,
    fact_id UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2'
);
`;

const EVICTED_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS evicted_records (
    batch_id TEXT NOT NULL,
    record_kind TEXT NOT NULL CHECK(record_kind IN ('fact', 'document')),
    record_id TEXT NOT NULL,
    namespace TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    reason TEXT NOT NULL,
    evicted_at TEXT NOT NULL,
    PRIMARY KEY (batch_id, record_kind, record_id)
);
CREATE INDEX IF NOT EXISTS idx_evicted_records_batch
    ON evicted_records(batch_id);
`;

/**
 * Deterministic canonical JSON matching Python `json.dumps(val, ensure_ascii=False, sort_keys=True, separators=(",", ":"))`.
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const pairs = [];
  for (const k of keys) {
    if (value[k] === undefined) continue;
    pairs.push(`${JSON.stringify(k)}:${canonicalJson(value[k])}`);
  }
  return `{${pairs.join(",")}}`;
}

export function sha256Text(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

/**
 * Zero-dependency bilingual tokenizer (ASCII identifiers + CJK 2-grams), exact parity with Python ZeroMem.
 */
export function tokenizeForFts(text) {
  const low = String(text || "").toLowerCase();
  const tokens = [];

  ASCII_WORD_RE.lastIndex = 0;
  let m;
  while ((m = ASCII_WORD_RE.exec(low)) !== null) {
    const w = m[0].replace(/^[._:/-]+|[._:/-]+$/g, "");
    if (w) {
      tokens.push(w);
      const parts = w.split(/[._:/-]+/).filter((p) => p && p !== w);
      tokens.push(...parts);
    }
  }

  CJK_RUN_RE.lastIndex = 0;
  while ((m = CJK_RUN_RE.exec(low)) !== null) {
    const run = m[0];
    if (run.length === 1) {
      tokens.push(run);
    } else {
      for (let i = 0; i < run.length - 1; i++) {
        tokens.push(run.slice(i, i + 2));
      }
      if (run.length <= 4) {
        tokens.push(run);
      }
    }
  }

  return tokens.join(" ");
}

function ftsQuote(tok) {
  const safe = String(tok).replace(/"/g, "");
  return `"${safe}"`;
}

function toPlainObject(row) {
  if (!row || typeof row !== "object") return null;
  return { ...row };
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export class SQLiteMemoryStore {
  constructor(dbPath) {
    this.dbPath = path.resolve(String(dbPath));
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this._initDb();
  }

  _withDb(fn, { write = false } = {}) {
    const db = new DatabaseSync(this.dbPath, { timeout: 15_000 });
    try {
      db.exec("PRAGMA busy_timeout = 15000;");
      if (write) {
        db.exec("BEGIN IMMEDIATE;");
        try {
          const result = fn(db);
          db.exec("COMMIT;");
          return result;
        } catch (err) {
          try {
            db.exec("ROLLBACK;");
          } catch {
            // ignore rollback error
          }
          throw err;
        }
      }
      return fn(db);
    } finally {
      db.close();
    }
  }

  _initDb() {
    const db = new DatabaseSync(this.dbPath, { timeout: 15_000 });
    try {
      db.exec("PRAGMA busy_timeout = 15000;");
      db.exec(SCHEMA_SQL);
      db.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES (?, ?)").run("schema_version", "1");
      db.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES (?, ?)").run("schema_sig", SCHEMA_SIG);
      db.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES (?, ?)").run("format_digest", FORMAT_DIGEST);
    } finally {
      db.close();
    }
  }

  hasDocument(namespace, contentSha256) {
    return this._withDb((db) => {
      const row = db
        .prepare("SELECT doc_id FROM documents WHERE namespace = ? AND content_sha256 = ?")
        .get(namespace, contentSha256);
      return row ? String(row.doc_id) : null;
    });
  }

  saveDocumentAndFacts({
    docId,
    namespace,
    contentSha256,
    sourceId = null,
    mentionedAt,
    createdAt,
    segments,
    facts,
  }) {
    const segTextMap = new Map();
    for (const s of segments) segTextMap.set(s.id, s.text);

    return this._withDb(
      (db) => {
        db.prepare(
          `INSERT INTO documents(doc_id, namespace, content_sha256, source_id, mentioned_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(docId, namespace, contentSha256, sourceId ?? null, mentionedAt, createdAt);

        const insSeg = db.prepare(
          `INSERT INTO segments(doc_id, seg_id, namespace, path_json, role, text, mentioned_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        for (const s of segments) {
          insSeg.run(
            docId,
            s.id,
            namespace,
            JSON.stringify(s.path || []),
            s.role ?? null,
            s.text,
            mentionedAt
          );
        }

        const insFact = db.prepare(
          `INSERT INTO facts(
             doc_id, namespace, text, type, occurred_start, occurred_end,
             where_loc, entities_json, evidence_ids_json, action, mentioned_at, created_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const insFts = db.prepare(
          "INSERT INTO facts_fts(fact_tokens, evidence_tokens, namespace, fact_id) VALUES (?, ?, ?, ?)"
        );

        const savedIds = [];
        for (const item of facts) {
          const entities = Array.isArray(item.entities) ? item.entities : [];
          const evIds = Array.isArray(item.evidence) ? item.evidence : [];
          const info = insFact.run(
            docId,
            namespace,
            item.text,
            item.type || "world",
            item.occurred_start ?? null,
            item.occurred_end ?? null,
            item.where ?? null,
            JSON.stringify(entities),
            JSON.stringify(evIds),
            item.action || "pass",
            mentionedAt,
            createdAt
          );
          const factId = Number(info.lastInsertRowid);
          savedIds.push(factId);

          const factBlob = [
            item.text,
            entities.map((e) => String(e)).join(" "),
            String(item.occurred_start || ""),
            String(item.where || ""),
          ].join(" ");
          const boundEvidence = evIds.map((eid) => segTextMap.get(eid) || "").join(" ");
          insFts.run(tokenizeForFts(factBlob), tokenizeForFts(boundEvidence), namespace, factId);
        }

        return savedIds;
      },
      { write: true }
    );
  }

  search(
    query,
    {
      namespace = null,
      limit = null,
      adaptive = true,
      minLimit = ADAPTIVE_MIN_LIMIT,
      scoreRatio = ADAPTIVE_SCORE_RATIO,
      asOf = null,
      untilEnabled = true,
    } = {}
  ) {
    const cap = resolveDefaultLimit(limit, { adaptive });
    const fetchLimit = Math.max(cap * 3, 24);
    const qTokens = tokenizeForFts(query).split(/\s+/).filter(Boolean);

    return this._withDb((db) => {
      if (!qTokens.length) {
        const rows = this._recentRows(db, { namespace, limit: fetchLimit });
        const hydrated = this._hydrateRanked(
          db,
          rows.map((r) => [r, 0.0])
        );
        const { items } = partitionExpired(hydrated, { today: asOf, enabled: untilEnabled });
        return items.slice(0, cap);
      }

      const uniqTokens = [];
      for (const t of qTokens) {
        if (!uniqTokens.includes(t)) uniqTokens.push(t);
        if (uniqTokens.length >= 24) break;
      }

      const quoted = uniqTokens.map(ftsQuote);
      const seenIds = new Set();
      const ranked = [];

      if (quoted.length >= 1 && quoted.length <= 6) {
        const andExpr = quoted.join(" AND ");
        for (const [row, score] of this._ftsQuery(db, andExpr, { namespace, limit: fetchLimit })) {
          const fid = Number(row.fact_id);
          if (!seenIds.has(fid)) {
            seenIds.add(fid);
            ranked.push([row, Number((score + 1.0).toFixed(4))]);
          }
        }
      }

      if (ranked.length < fetchLimit) {
        const orExpr = quoted.join(" OR ");
        for (const [row, score] of this._ftsQuery(db, orExpr, { namespace, limit: fetchLimit * 2 })) {
          const fid = Number(row.fact_id);
          if (!seenIds.has(fid)) {
            seenIds.add(fid);
            ranked.push([row, score]);
          }
          if (ranked.length >= fetchLimit) break;
        }
      }

      const hydrated = this._hydrateRanked(db, ranked.slice(0, fetchLimit));
      const { items } = partitionExpired(hydrated, { today: asOf, enabled: untilEnabled });
      return selectAdaptiveHits(items, {
        limit: cap,
        minLimit,
        scoreRatio,
        adaptive,
      });
    });
  }

  _ftsQuery(db, matchExpr, { namespace = null, limit = 24 }) {
    let sql = `
      SELECT f.*, bm25(facts_fts, 2.0, 1.0) AS rank_score
      FROM facts_fts
      JOIN facts f ON f.fact_id = facts_fts.fact_id
      WHERE facts_fts MATCH ?
    `;
    const params = [matchExpr];
    if (namespace) {
      sql += " AND f.namespace = ?";
      params.push(namespace);
    }
    sql += " ORDER BY rank_score ASC, f.mentioned_at DESC LIMIT ?";
    params.push(limit);

    const rows = db.prepare(sql).all(...params);
    return rows.map((r) => [toPlainObject(r), Number((-Number(r.rank_score || 0)).toFixed(4))]);
  }

  _recentRows(db, { namespace = null, limit = 24 }) {
    if (namespace) {
      return db
        .prepare("SELECT * FROM facts WHERE namespace = ? ORDER BY mentioned_at DESC, fact_id DESC LIMIT ?")
        .all(namespace, limit)
        .map(toPlainObject);
    }
    return db
      .prepare("SELECT * FROM facts ORDER BY mentioned_at DESC, fact_id DESC LIMIT ?")
      .all(limit)
      .map(toPlainObject);
  }

  _hydrateRanked(db, ranked) {
    const results = [];
    for (const [row, score] of ranked) {
      const docId = String(row.doc_id);
      const evIds = safeJsonParse(row.evidence_ids_json || "[]", []);
      const evTexts = [];
      if (Array.isArray(evIds) && evIds.length) {
        const placeholders = evIds.map(() => "?").join(",");
        const segRows = db
          .prepare(`SELECT seg_id, role, text FROM segments WHERE doc_id = ? AND seg_id IN (${placeholders})`)
          .all(docId, ...evIds);
        const segLookup = new Map();
        for (const sr of segRows) segLookup.set(String(sr.seg_id), sr);
        for (const sid of evIds) {
          const sr = segLookup.get(String(sid));
          if (sr) {
            evTexts.push({
              id: String(sid),
              role: sr.role ?? null,
              text: String(sr.text),
            });
          }
        }
      }
      results.push({
        fact_id: Number(row.fact_id),
        doc_id: docId,
        namespace: String(row.namespace),
        text: String(row.text),
        type: String(row.type),
        occurred_start: row.occurred_start ?? null,
        occurred_end: row.occurred_end ?? null,
        where: row.where_loc ?? null,
        entities: safeJsonParse(row.entities_json || "[]", []),
        evidence_ids: Array.isArray(evIds) ? evIds.map(String) : [],
        evidence: evTexts,
        action: String(row.action),
        mentioned_at: String(row.mentioned_at),
        score,
      });
    }
    return results;
  }

  stats(namespace = null) {
    return this._withDb((db) => {
      let docs = 0;
      let segs = 0;
      let facts = 0;
      let revised = 0;
      let namespaces = [];

      if (namespace) {
        docs = Number(db.prepare("SELECT COUNT(*) AS c FROM documents WHERE namespace = ?").get(namespace).c);
        segs = Number(db.prepare("SELECT COUNT(*) AS c FROM segments WHERE namespace = ?").get(namespace).c);
        facts = Number(db.prepare("SELECT COUNT(*) AS c FROM facts WHERE namespace = ?").get(namespace).c);
        revised = Number(
          db.prepare("SELECT COUNT(*) AS c FROM facts WHERE namespace = ? AND action = 'revise'").get(namespace).c
        );
        namespaces = [namespace];
      } else {
        docs = Number(db.prepare("SELECT COUNT(*) AS c FROM documents").get().c);
        segs = Number(db.prepare("SELECT COUNT(*) AS c FROM segments").get().c);
        facts = Number(db.prepare("SELECT COUNT(*) AS c FROM facts").get().c);
        revised = Number(db.prepare("SELECT COUNT(*) AS c FROM facts WHERE action = 'revise'").get().c);
        namespaces = db
          .prepare("SELECT DISTINCT namespace FROM documents ORDER BY namespace")
          .all()
          .map((r) => String(r.namespace));
      }

      let evictedCount = 0;
      const hasEvicted = db
        .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'evicted_records'")
        .get();
      if (hasEvicted) {
        evictedCount = namespace
          ? Number(
              db.prepare("SELECT COUNT(*) AS c FROM evicted_records WHERE namespace = ?").get(namespace).c
            )
          : Number(db.prepare("SELECT COUNT(*) AS c FROM evicted_records").get().c);
      }

      let dbSizeBytes = 0;
      try {
        dbSizeBytes = fs.statSync(this.dbPath).size;
      } catch {
        dbSizeBytes = 0;
      }

      return {
        db_path: this.dbPath,
        db_size_bytes: dbSizeBytes,
        documents: docs,
        segments: segs,
        facts,
        revised_facts: revised,
        evicted_records: evictedCount,
        namespaces,
      };
    });
  }

  getDocument(docId) {
    return this._withDb((db) => {
      const doc = db.prepare("SELECT * FROM documents WHERE doc_id = ?").get(String(docId));
      if (!doc) return null;
      const segRows = db
        .prepare("SELECT seg_id, path_json, role, text FROM segments WHERE doc_id = ?")
        .all(String(docId))
        .map(toPlainObject)
        .sort((a, b) => {
          const na = Number(String(a.seg_id).slice(1));
          const nb = Number(String(b.seg_id).slice(1));
          return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
        });
      const factCount = Number(
        db.prepare("SELECT COUNT(*) AS c FROM facts WHERE doc_id = ?").get(String(docId)).c
      );
      return {
        doc_id: String(doc.doc_id),
        namespace: String(doc.namespace),
        source_id: doc.source_id ?? null,
        mentioned_at: String(doc.mentioned_at),
        created_at: String(doc.created_at),
        segments: segRows.map((r) => ({
          id: String(r.seg_id),
          path: safeJsonParse(r.path_json || "[]", []),
          role: r.role ?? null,
          text: String(r.text),
        })),
        fact_count: factCount,
      };
    });
  }

  deleteFact(factId) {
    return this._withDb(
      (db) => {
        const info = db.prepare("DELETE FROM facts WHERE fact_id = ?").run(Number(factId));
        db.prepare("DELETE FROM facts_fts WHERE fact_id = ?").run(Number(factId));
        return Number(info.changes) > 0;
      },
      { write: true }
    );
  }

  deleteDocument(docId) {
    return this._withDb(
      (db) => {
        const fids = db
          .prepare("SELECT fact_id FROM facts WHERE doc_id = ?")
          .all(String(docId))
          .map((r) => Number(r.fact_id));
        const delFts = db.prepare("DELETE FROM facts_fts WHERE fact_id = ?");
        for (const fid of fids) delFts.run(fid);
        db.prepare("DELETE FROM facts WHERE doc_id = ?").run(String(docId));
        db.prepare("DELETE FROM segments WHERE doc_id = ?").run(String(docId));
        const info = db.prepare("DELETE FROM documents WHERE doc_id = ?").run(String(docId));
        return Number(info.changes) > 0;
      },
      { write: true }
    );
  }

  /**
   * Lossless same-DB soft eviction into `evicted_records` side table (compatible with Python `v2mem/governance.py`).
   */
  softEvict({
    factIds = [],
    docIds = [],
    expired = false,
    namespace = null,
    asOf = null,
    reason = "soft-evict",
    batchId = null,
    force = false,
  } = {}) {
    const cleanReason = String(reason || "soft-evict").trim() || "soft-evict";
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const effectiveBatchId =
      String(batchId || "").trim() || `evict-${stamp}-${randomBytes(3).toString("hex")}`;
    const evictedAt = new Date().toISOString();

    return this._withDb(
      (db) => {
        db.exec(EVICTED_TABLE_DDL);

        const targetFactSet = new Set(
          (Array.isArray(factIds) ? factIds : []).map((x) => Number(x)).filter(Number.isInteger)
        );
        const targetDocSet = new Set(
          (Array.isArray(docIds) ? docIds : []).map((x) => String(x).trim()).filter(Boolean)
        );

        if (expired) {
          const asOfIso = resolveAsOfDate(asOf);
          const rows = namespace
            ? db.prepare("SELECT * FROM facts WHERE namespace = ?").all(namespace)
            : db.prepare("SELECT * FROM facts").all();
          for (const row of rows) {
            const entities = safeJsonParse(row.entities_json || "[]", []);
            const evIds = safeJsonParse(row.evidence_ids_json || "[]", []);
            let boundSegs = [];
            if (Array.isArray(evIds) && evIds.length) {
              const ph = evIds.map(() => "?").join(",");
              boundSegs = db
                .prepare(`SELECT text FROM segments WHERE doc_id = ? AND seg_id IN (${ph})`)
                .all(String(row.doc_id), ...evIds);
            }
            const until = parseUntilDate({
              tags: entities,
              text: String(row.text),
              evidence: boundSegs,
            });
            if (until && until < asOfIso) {
              targetFactSet.add(Number(row.fact_id));
            }
          }
        }

        const docTargets = [...targetDocSet].sort();
        const docFactIds = new Set();
        const docPayloads = [];
        for (const docId of docTargets) {
          const doc = db.prepare("SELECT * FROM documents WHERE doc_id = ?").get(docId);
          if (!doc) continue;
          if (namespace && String(doc.namespace) !== namespace) continue;
          const segs = db
            .prepare("SELECT * FROM segments WHERE doc_id = ? ORDER BY seg_id")
            .all(docId)
            .map(toPlainObject);
          const facts = db
            .prepare("SELECT * FROM facts WHERE doc_id = ? ORDER BY fact_id ASC")
            .all(docId)
            .map(toPlainObject);
          for (const f of facts) docFactIds.add(Number(f.fact_id));
          const snapshot = { document: toPlainObject(doc), segments: segs, facts };
          const payloadJson = canonicalJson(snapshot);
          docPayloads.push({
            kind: "document",
            id: docId,
            namespace: String(doc.namespace),
            payloadJson,
            sha: sha256Text(payloadJson),
            factCount: facts.length,
          });
        }

        const factTargets = [...targetFactSet].filter((fid) => !docFactIds.has(fid)).sort((a, b) => a - b);
        const factPayloads = [];
        for (const fid of factTargets) {
          const row = db.prepare("SELECT * FROM facts WHERE fact_id = ?").get(fid);
          if (!row) continue;
          if (namespace && String(row.namespace) !== namespace) continue;
          const factObj = toPlainObject(row);
          const evIds = safeJsonParse(factObj.evidence_ids_json || "[]", []);
          let segs = [];
          if (Array.isArray(evIds) && evIds.length) {
            const ph = evIds.map(() => "?").join(",");
            segs = db
              .prepare(`SELECT * FROM segments WHERE doc_id = ? AND seg_id IN (${ph}) ORDER BY seg_id`)
              .all(String(factObj.doc_id), ...evIds)
              .map(toPlainObject);
          }
          const snapshot = { fact: factObj, bound_segments: segs };
          const payloadJson = canonicalJson(snapshot);
          factPayloads.push({
            kind: "fact",
            id: String(fid),
            namespace: String(factObj.namespace),
            payloadJson,
            sha: sha256Text(payloadJson),
          });
        }

        const movedFactsTotal = factPayloads.length + docPayloads.reduce((acc, d) => acc + d.factCount, 0);
        if (factPayloads.length === 0 && docPayloads.length === 0) {
          return {
            ok: true,
            batch_id: effectiveBatchId,
            moved_facts: 0,
            moved_documents: 0,
            total_records: 0,
            reason: cleanReason,
          };
        }

        const activeFactsBefore = namespace
          ? Number(db.prepare("SELECT COUNT(*) AS c FROM facts WHERE namespace = ?").get(namespace).c)
          : Number(db.prepare("SELECT COUNT(*) AS c FROM facts").get().c);

        if (!force && activeFactsBefore > 0 && movedFactsTotal >= activeFactsBefore && activeFactsBefore > 1) {
          throw new Error(
            `evict-safety-guard: refusing to empty all ${activeFactsBefore} active facts without force=true`
          );
        }

        const insEvict = db.prepare(
          `INSERT INTO evicted_records(
             batch_id, record_kind, record_id, namespace, payload_json, content_sha256, reason, evicted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const delFts = db.prepare("DELETE FROM facts_fts WHERE fact_id = ?");
        const delFact = db.prepare("DELETE FROM facts WHERE fact_id = ?");

        for (const item of docPayloads) {
          insEvict.run(
            effectiveBatchId,
            "document",
            item.id,
            item.namespace,
            item.payloadJson,
            item.sha,
            cleanReason,
            evictedAt
          );
          const fids = db
            .prepare("SELECT fact_id FROM facts WHERE doc_id = ?")
            .all(item.id)
            .map((r) => Number(r.fact_id));
          for (const fid of fids) delFts.run(fid);
          db.prepare("DELETE FROM facts WHERE doc_id = ?").run(item.id);
          db.prepare("DELETE FROM segments WHERE doc_id = ?").run(item.id);
          db.prepare("DELETE FROM documents WHERE doc_id = ?").run(item.id);
        }

        for (const item of factPayloads) {
          insEvict.run(
            effectiveBatchId,
            "fact",
            item.id,
            item.namespace,
            item.payloadJson,
            item.sha,
            cleanReason,
            evictedAt
          );
          delFact.run(Number(item.id));
          delFts.run(Number(item.id));
        }

        const activeFactsAfter = namespace
          ? Number(db.prepare("SELECT COUNT(*) AS c FROM facts WHERE namespace = ?").get(namespace).c)
          : Number(db.prepare("SELECT COUNT(*) AS c FROM facts").get().c);

        if (activeFactsAfter + movedFactsTotal !== activeFactsBefore) {
          throw new Error(
            `conservation-failed: before=${activeFactsBefore}, after=${activeFactsAfter}, moved=${movedFactsTotal}`
          );
        }

        return {
          ok: true,
          batch_id: effectiveBatchId,
          moved_facts: factPayloads.length,
          moved_documents: docPayloads.length,
          total_facts_affected: movedFactsTotal,
          total_records: factPayloads.length + docPayloads.length,
          reason: cleanReason,
          evicted_at: evictedAt,
        };
      },
      { write: true }
    );
  }

  listEvictedBatches(limit = 50) {
    return this._withDb((db) => {
      const exists = db
        .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'evicted_records'")
        .get();
      if (!exists) return [];
      const rows = db
        .prepare(
          `SELECT batch_id, reason, MIN(evicted_at) AS evicted_at,
                  COUNT(*) AS record_count,
                  GROUP_CONCAT(DISTINCT namespace) AS namespaces
           FROM evicted_records
           GROUP BY batch_id, reason
           ORDER BY evicted_at DESC
           LIMIT ?`
        )
        .all(Math.max(1, Math.min(Number(limit) || 50, 200)));

      return rows.map((r) => {
        const sample = db
          .prepare(
            "SELECT record_kind, record_id, payload_json FROM evicted_records WHERE batch_id = ? LIMIT 3"
          )
          .all(String(r.batch_id))
          .map((item) => {
            const parsed = safeJsonParse(item.payload_json, {});
            const preview =
              item.record_kind === "fact"
                ? String(parsed?.fact?.text || "").slice(0, 120)
                : `doc ${item.record_id} (${Array.isArray(parsed?.facts) ? parsed.facts.length : 0} facts)`;
            return {
              kind: String(item.record_kind),
              id: String(item.record_id),
              preview,
            };
          });
        return {
          batch_id: String(r.batch_id),
          reason: String(r.reason),
          evicted_at: String(r.evicted_at),
          record_count: Number(r.record_count),
          namespaces: String(r.namespaces || "")
            .split(",")
            .filter(Boolean),
          samples: sample,
        };
      });
    });
  }

  /**
   * Fail-closed SHA-256 tamper-checked atomic restore from `evicted_records`.
   */
  restoreEvicted(batchId) {
    const cleanBatch = String(batchId || "").trim();
    if (!cleanBatch) throw new Error("batch_id is required");

    return this._withDb(
      (db) => {
        const exists = db
          .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'evicted_records'")
          .get();
        if (!exists) throw new Error(`batch-not-found: ${cleanBatch}`);

        const rows = db
          .prepare("SELECT * FROM evicted_records WHERE batch_id = ? ORDER BY record_kind, record_id")
          .all(cleanBatch)
          .map(toPlainObject);
        if (!rows.length) throw new Error(`batch-not-found: ${cleanBatch}`);

        // Phase 1: verify every single row SHA-256 BEFORE modifying anything
        const verified = [];
        for (const r of rows) {
          const parsed = JSON.parse(String(r.payload_json));
          const canonical = canonicalJson(parsed);
          const actualSha = sha256Text(canonical);
          if (actualSha !== String(r.content_sha256)) {
            throw new Error(
              `tamper-detected: batch=${cleanBatch} ${r.record_kind}:${r.record_id} expected=${r.content_sha256} actual=${actualSha}`
            );
          }
          verified.push({ row: r, snapshot: parsed });
        }

        // Phase 2: atomic restore + rebuild dual-track facts_fts
        const insDoc = db.prepare(
          `INSERT OR IGNORE INTO documents(doc_id, namespace, content_sha256, source_id, mentioned_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        );
        const insSeg = db.prepare(
          `INSERT OR IGNORE INTO segments(doc_id, seg_id, namespace, path_json, role, text, mentioned_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        const insFact = db.prepare(
          `INSERT OR REPLACE INTO facts(
             fact_id, doc_id, namespace, text, type, occurred_start, occurred_end,
             where_loc, entities_json, evidence_ids_json, action, mentioned_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const delFts = db.prepare("DELETE FROM facts_fts WHERE fact_id = ?");
        const insFts = db.prepare(
          "INSERT INTO facts_fts(fact_tokens, evidence_tokens, namespace, fact_id) VALUES (?, ?, ?, ?)"
        );

        let restoredDocs = 0;
        let restoredFacts = 0;

        const indexFact = (f, segTextById) => {
          const entities = safeJsonParse(f.entities_json || "[]", []);
          const evIds = safeJsonParse(f.evidence_ids_json || "[]", []);
          const factBlob = [
            String(f.text || ""),
            Array.isArray(entities) ? entities.map(String).join(" ") : "",
            String(f.occurred_start || ""),
            String(f.where_loc || ""),
          ].join(" ");
          const boundEvidence = (Array.isArray(evIds) ? evIds : [])
            .map((eid) => segTextById.get(String(eid)) || "")
            .join(" ");
          delFts.run(Number(f.fact_id));
          insFts.run(tokenizeForFts(factBlob), tokenizeForFts(boundEvidence), String(f.namespace), Number(f.fact_id));
        };

        for (const { row, snapshot } of verified) {
          if (row.record_kind === "document") {
            const doc = snapshot.document;
            insDoc.run(
              doc.doc_id,
              doc.namespace,
              doc.content_sha256,
              doc.source_id ?? null,
              doc.mentioned_at,
              doc.created_at
            );
            const segMap = new Map();
            for (const s of snapshot.segments || []) {
              insSeg.run(
                s.doc_id,
                s.seg_id,
                s.namespace,
                s.path_json,
                s.role ?? null,
                s.text,
                s.mentioned_at
              );
              segMap.set(String(s.seg_id), String(s.text));
            }
            for (const f of snapshot.facts || []) {
              insFact.run(
                Number(f.fact_id),
                f.doc_id,
                f.namespace,
                f.text,
                f.type,
                f.occurred_start ?? null,
                f.occurred_end ?? null,
                f.where_loc ?? null,
                f.entities_json,
                f.evidence_ids_json,
                f.action,
                f.mentioned_at,
                f.created_at
              );
              indexFact(f, segMap);
              restoredFacts += 1;
            }
            restoredDocs += 1;
          } else {
            const f = snapshot.fact;
            const segMap = new Map();
            for (const s of snapshot.bound_segments || []) {
              insSeg.run(
                s.doc_id,
                s.seg_id,
                s.namespace,
                s.path_json,
                s.role ?? null,
                s.text,
                s.mentioned_at
              );
              segMap.set(String(s.seg_id), String(s.text));
            }
            insFact.run(
              Number(f.fact_id),
              f.doc_id,
              f.namespace,
              f.text,
              f.type,
              f.occurred_start ?? null,
              f.occurred_end ?? null,
              f.where_loc ?? null,
              f.entities_json,
              f.evidence_ids_json,
              f.action,
              f.mentioned_at,
              f.created_at
            );
            indexFact(f, segMap);
            restoredFacts += 1;
          }
        }

        db.prepare("DELETE FROM evicted_records WHERE batch_id = ?").run(cleanBatch);

        return {
          ok: true,
          batch_id: cleanBatch,
          restored_documents: restoredDocs,
          restored_facts: restoredFacts,
          verified_rows: verified.length,
        };
      },
      { write: true }
    );
  }
}
