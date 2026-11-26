import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

import { ConfigManager } from "../lib/config.mjs";
import {
  FACT_ADMISSION_SUPERSEDE_ADDENDUM,
  FACT_ADMISSION_SYSTEM,
  guardFact,
} from "../lib/contracts.mjs";
import { apply, backupDatabase, exportMarkdown, ZeroMemEngine } from "../lib/index.mjs";
import { APP_FORMAT_ID, SCHEMA_SIG, SQLiteMemoryStore, sha256Text } from "../lib/store.mjs";

function makeTempDir(prefix = "zeromem_tl_") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

class ScriptedLlm {
  constructor(responses, model = "mock-v2") {
    this.responses = [...responses];
    this.model = model;
    this.calls = [];
  }

  async chatJson(systemPrompt, userPayload, opts = {}) {
    this.calls.push({
      systemPrompt,
      userPayload,
      numPredict: opts.numPredict,
      responseFormat: opts.responseFormat ?? null,
    });
    const content = this.responses.length ? this.responses.shift() : "{}";
    return {
      content,
      meta: { provider: "ollama", model: this.model, elapsed_ms: 5 },
    };
  }
}

function createMockCordisHost() {
  const events = new Map();
  const tools = new Map();
  const routes = new Map();

  const root = {
    on(eventName, fn) {
      if (!events.has(eventName)) events.set(eventName, []);
      events.get(eventName).push(fn);
      return () => {};
    },
    inject(_deps, cb) {
      cb({
        on: root.on,
        effect: () => {},
        get(key) {
          if (key === "connection") return { trustedHosts: [], requestRejection: () => null };
          return undefined;
        },
        tools: {
          register(spec) {
            tools.set(spec.name, spec);
            return () => tools.delete(spec.name);
          },
        },
        webServer: {
          register(route) {
            routes.set(route.path, route);
            return () => routes.delete(route.path);
          },
          tapIndex() {
            return () => {};
          },
        },
      });
    },
    effect() {},
  };

  async function invokeRoute(routePath, { method = "GET", headers = {}, body = null } = {}) {
    const basePath = routePath.split("?")[0];
    const route = routes.get(basePath);
    assert.ok(route, `Route ${basePath} not registered`);
    const req = new EventEmitter();
    req.method = method;
    req.url = routePath;
    req.headers = { host: "127.0.0.1:8787", ...headers };
    let statusCode = 0;
    let resHeaders = {};
    const chunks = [];
    const res = {
      writeHead(code, hdrs) {
        statusCode = code;
        resHeaders = hdrs || {};
      },
      write(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8"));
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8"));
      },
    };
    const done = route.handler(req, res);
    if (body !== null && body !== undefined) {
      req.emit("data", Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8"));
    }
    req.emit("end");
    await done;
    const raw = Buffer.concat(chunks);
    return { statusCode, headers: resHeaders, body: raw.toString("utf8"), buffer: raw };
  }

  return { root, tools, routes, invokeRoute };
}

test("prior_facts lookup, supersedes_fact_id lineage, schema constraint, and softEvict/restore parity", async () => {
  const ext1 = JSON.stringify({
    facts: [
      {
        text: "项目 A 采用方案 X（单体 MySQL）部署。",
        type: "world",
        occurred_start: "2025-06-01",
        occurred_end: null,
        where: "生产环境",
        entities: ["项目 A", "方案 X", "MySQL"],
        evidence: ["s0"],
      },
    ],
  });
  const adm1 = JSON.stringify({ 0: { decision: "pass", evidence: ["s0"], replacement: "" } });

  const ext2 = JSON.stringify({
    facts: [
      {
        text: "项目 A 从方案 X 迁移至方案 Y（SQLite WAL + FTS5）。",
        type: "world",
        occurred_start: "2026-03-10",
        occurred_end: null,
        where: "生产环境",
        entities: ["项目 A", "方案 Y", "SQLite"],
        evidence: ["s0"],
      },
      {
        text: "项目 A 日志保留周期为 30 天。",
        type: "world",
        occurred_start: "2026-03-10",
        occurred_end: null,
        where: null,
        entities: ["项目 A", "日志"],
        evidence: ["s1"],
      },
    ],
  });
  const adm2 = JSON.stringify({
    0: { decision: "pass", evidence: ["s0"], replacement: "", supersedes_fact_id: 1 },
    1: { decision: "pass", evidence: ["s1"], replacement: "", supersedes_fact_id: 9999 },
  });

  const ext3 = JSON.stringify({
    facts: [
      {
        text: "项目 A 演示环境使用方案 Z。",
        type: "world",
        occurred_start: "2026-04-01",
        occurred_end: null,
        where: null,
        entities: ["项目 A", "方案 Z"],
        evidence: ["s0"],
      },
    ],
  });
  const adm3 = JSON.stringify({ 0: { decision: "pass", evidence: ["s0"], replacement: "" } });

  const dir = makeTempDir("zeromem_sup_");
  try {
    const dbPath = path.join(dir, "timeline.db");
    const mock = new ScriptedLlm([ext1, adm1, ext2, adm2, ext3, adm3]);
    const cfgMgr = new ConfigManager({
      configPath: path.join(dir, "cfg.json"),
      initialOverrides: { dbPath },
    });
    const engine = new ZeroMemEngine({ configManager: cfgMgr, llmFactory: () => mock });

    const r1 = await engine.remember("2025-06-01 决议：项目 A 采用方案 X（单体 MySQL）部署。", {
      ns: "proj-a",
      mentionedAt: "2025-06-01T08:00:00Z",
    });
    assert.equal(r1.saved, 1);
    assert.equal(r1.superseded, 0);
    const oldFid = r1.fact_ids[0];
    // First admission on empty namespace keeps unmodified prompt and no schema
    assert.equal(mock.calls[1].systemPrompt, FACT_ADMISSION_SYSTEM);
    assert.equal("prior_facts" in mock.calls[1].userPayload, false);
    assert.equal(mock.calls[1].responseFormat, null);

    const r2 = await engine.remember(
      "2026-03-10 迁移：项目 A 从方案 X 迁移至方案 Y（SQLite WAL + FTS5）。\n\n项目 A 日志保留周期为 30 天。",
      { ns: "proj-a", mentionedAt: "2026-03-10T09:00:00Z" }
    );
    assert.equal(r2.saved, 2);
    assert.equal(r2.superseded, 1);
    const [newFid, logFid] = r2.fact_ids;

    // Second admission includes prior_facts, addendum prompt, and JSON Schema enum
    assert.ok(mock.calls[3].systemPrompt.includes(FACT_ADMISSION_SUPERSEDE_ADDENDUM));
    assert.ok(mock.calls[3].userPayload.prior_facts.some((pf) => pf.fact_id === oldFid));
    assert.deepEqual(
      mock.calls[3].responseFormat.properties["0"].properties.supersedes_fact_id.enum,
      [null, oldFid]
    );
    assert.equal(r2.facts[0].supersedes_fact_id, oldFid);
    assert.equal("supersedes_fact_id" in r2.facts[1], false);

    // Cross-namespace isolation: proj-b admission sees no prior_facts from proj-a
    await engine.remember("2026-04-01：项目 A 演示环境使用方案 Z。", { ns: "proj-b" });
    assert.equal("prior_facts" in mock.calls[5].userPayload, false);

    // Active fact ranks ahead of superseded historical fact
    const hits = engine.recall("项目 A 方案", { ns: "proj-a", adaptive: false, limit: 10 });
    const hitIds = hits.map((h) => h.fact_id);
    assert.ok(hitIds.indexOf(newFid) < hitIds.indexOf(oldFid));
    const byId = new Map(hits.map((h) => [h.fact_id, h]));
    assert.equal(byId.get(newFid).supersedes_fact_id, oldFid);
    assert.equal("superseded_by" in byId.get(newFid), false);
    assert.deepEqual(byId.get(oldFid).superseded_by, [newFid]);
    assert.equal("supersedes_fact_id" in byId.get(oldFid), false);

    // Negative control: unrelated fact omits optional lineage keys
    const logHits = engine.recall("日志保留", { ns: "proj-a" });
    assert.equal(logHits[0].fact_id, logFid);
    assert.equal("supersedes_fact_id" in logHits[0], false);
    assert.equal("superseded_by" in logHits[0], false);

    // includeSuperseded=false hides oldFid
    const activeOnly = engine.recall("项目 A 方案", {
      ns: "proj-a",
      includeSuperseded: false,
      adaptive: false,
    });
    assert.equal(activeOnly.some((h) => h.fact_id === oldFid), false);
    assert.equal(activeOnly.some((h) => h.fact_id === newFid), true);

    assert.equal(engine.stats("proj-a").supersessions, 1);

    // Soft-evicting newer fact clears superseded_by on oldFid; restoring brings it back
    const ev = engine.softEvict({ factIds: [newFid], reason: "rollback test", batchId: "b-sup" });
    assert.equal(ev.moved_facts, 1);
    const afterEvict = engine.recall("项目 A 方案", { ns: "proj-a", adaptive: false });
    assert.equal(afterEvict.some((h) => h.fact_id === newFid), false);
    assert.equal(afterEvict[0].fact_id, oldFid);
    assert.equal("superseded_by" in afterEvict[0], false);

    const restored = engine.restoreEvicted("b-sup");
    assert.equal(restored.restored_facts, 1);
    const afterRestore = new Map(
      engine.recall("项目 A 方案", { ns: "proj-a", adaptive: false }).map((h) => [h.fact_id, h])
    );
    assert.deepEqual(afterRestore.get(oldFid).superseded_by, [newFid]);
    assert.equal(afterRestore.get(newFid).supersedes_fact_id, oldFid);

    // Engine facade exportMarkdown + backup
    const sdkMd = engine.exportMarkdown({ ns: "proj-a" });
    assert.equal(sdkMd.ok, true);
    assert.ok(sdkMd.markdown.includes("方案 Y"));
    const sdkBak = await engine.backup(path.join(dir, "sdk-snap.db"));
    assert.equal(sdkBak.ok, true);
    assert.equal(sdkBak.journal_mode, "delete");

    // Watermark invariants untouched
    const rawDb = new DatabaseSync(dbPath);
    try {
      assert.equal(Number(rawDb.prepare("PRAGMA application_id").get().application_id), APP_FORMAT_ID);
      assert.equal(rawDb.prepare("SELECT value FROM meta WHERE key='schema_version'").get().value, "1");
      assert.equal(rawDb.prepare("SELECT value FROM meta WHERE key='schema_sig'").get().value, SCHEMA_SIG);
    } finally {
      rawDb.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("occurred_from/to filtering, conservative date backfill, and DSH tool/Web API wiring", async () => {
  const dir = makeTempDir("zeromem_dates_");
  const prevCfg = process.env.ZEROMEM_DSH_CONFIG;
  process.env.ZEROMEM_DSH_CONFIG = path.join(dir, "dsh-zeromem.json");
  try {
    const dbPath = path.join(dir, "dates.db");
    const store = new SQLiteMemoryStore(dbPath);
    store.saveDocumentAndFacts({
      docId: "doc-2025",
      namespace: "eng",
      contentSha256: "a".repeat(64),
      sourceId: "rfc-2025.md",
      mentionedAt: "2025-06-02T00:00:00Z",
      createdAt: "2025-06-02T00:00:00Z",
      segments: [{ id: "s0", path: ["note", "0"], role: null, text: "2025-06-01 项目 A 使用方案 X。" }],
      facts: [
        {
          text: "项目 A 使用方案 X。",
          type: "world",
          occurred_start: "2025-06-01",
          occurred_end: "2025-12-31",
          entities: ["项目 A", "方案 X"],
          evidence: ["s0"],
          action: "pass",
        },
      ],
    });
    store.saveDocumentAndFacts({
      docId: "doc-2026",
      namespace: "eng",
      contentSha256: "b".repeat(64),
      sourceId: "rfc-2026.md",
      mentionedAt: "2026-03-15T00:00:00Z",
      createdAt: "2026-03-15T00:00:00Z",
      segments: [
        { id: "s0", path: ["note", "0"], role: null, text: "2026-03-15 项目 A 迁移到方案 Y。" },
        { id: "s1", path: ["note", "1"], role: null, text: "项目 A 团队每周五做代码评审。" },
      ],
      facts: [
        {
          text: "项目 A 迁移到方案 Y。",
          type: "world",
          occurred_start: "2026-03-15",
          occurred_end: null,
          entities: ["项目 A", "方案 Y"],
          evidence: ["s0"],
          action: "pass",
          supersedes_fact_id: 1,
        },
        {
          text: "项目 A 团队每周五做代码评审。",
          type: "world",
          occurred_start: null,
          occurred_end: null,
          entities: ["项目 A"],
          evidence: ["s1"],
          action: "pass",
        },
      ],
    });

    // Year / month / empty-query timeline / interval overlap
    assert.deepEqual(
      store.search("项目 A", { namespace: "eng", occurredFrom: "2025", occurredTo: "2025" }).map((h) => h.fact_id),
      [1]
    );
    assert.deepEqual(
      store.search("项目 A", { namespace: "eng", occurredFrom: "2026-03", occurredTo: "2026-03" }).map((h) => h.fact_id),
      [2]
    );
    assert.deepEqual(
      store.search("", { namespace: "eng", occurredFrom: "2025-01-01", occurredTo: "2026-12-31" }).map((h) => h.fact_id),
      [2, 1]
    );
    assert.deepEqual(
      store.search("", { namespace: "eng", occurredFrom: "2025-11-01", occurredTo: "2025-11-30" }).map((h) => h.fact_id),
      [1]
    );

    // Invalid dates and inverted ranges fail closed
    assert.throws(() => store.search("项目 A", { occurredFrom: "2026-02-30" }), /invalid-occurred-from/);
    assert.throws(
      () => store.search("项目 A", { occurredFrom: "2026-05-01", occurredTo: "2026-01-01" }),
      /invalid-occurred-range/
    );

    // Conservative single-date deterministic backfill in guardFact (no record-date or until: leak)
    const segMap = new Map([
      ["s0", { id: "s0", text: "2026-03-01 记录：服务将于 2026-03-15 迁移，临时方案 until:2026-03-20。" }],
      ["s1", { id: "s1", text: "临时灰度规则 until:2026-04-01。" }],
    ]);
    const gEvt = guardFact(
      { text: "2026-03-01 记录：服务将于 2026-03-15 迁移。", type: "world", occurred_start: null, evidence: ["s0"] },
      segMap,
      { mentionedAt: "2026-03-01T08:00:00Z" }
    );
    assert.equal(gEvt.guarded.occurred_start, "2026-03-15");
    const gUntil = guardFact(
      { text: "临时灰度规则 until:2026-04-01。", type: "world", occurred_start: null, evidence: ["s1"] },
      segMap,
      { mentionedAt: "2026-03-01T08:00:00Z" }
    );
    assert.equal(gUntil.guarded.occurred_start, null);
    const gZhDate = guardFact(
      { text: "2026 年 3 月 15 日服务完成迁移。", type: "world", occurred_start: null, evidence: ["s0"] },
      segMap,
      { mentionedAt: "2026-03-01T08:00:00Z" }
    );
    assert.equal(gZhDate.guarded.occurred_start, "2026-03-15");

    // Cordis DSH tool & Web API wiring
    const host = createMockCordisHost();
    apply(host.root, { dbPath, ollamaUrl: "http://127.0.0.1:1" });

    const toolRes = await host.tools.get("zeromem_recall").execute({
      query: "项目 A",
      namespace: "eng",
      occurred_from: "2025-01-01",
      occurred_to: "2025-12-31",
    });
    assert.equal(toolRes.ok, true);
    assert.deepEqual(toolRes.items.map((i) => i.fact_id), [1]);
    assert.deepEqual(toolRes.items[0].superseded_by, [2]);
    assert.equal(toolRes.superseded_count, 1);

    const stTool = await host.tools.get("zeromem_stats").execute({ namespace: "eng" });
    assert.equal(stTool.supersessions, 1);

    // Web routes: /api/memories time filter, 400 on bad date, /api/export.md, /api/backup
    const webSlice = await host.invokeRoute(
      "/dsh-zeromem/api/memories?q=%E9%A1%B9%E7%9B%AE&ns=eng&occurred_from=2026-01-01&include_superseded=0"
    );
    assert.equal(webSlice.statusCode, 200);
    assert.deepEqual(JSON.parse(webSlice.body).items.map((i) => i.fact_id), [2]);

    const badDate = await host.invokeRoute("/dsh-zeromem/api/memories?occurred_from=2026-02-30");
    assert.equal(badDate.statusCode, 400);

    const expRes = await host.invokeRoute("/dsh-zeromem/api/export.md?ns=eng&download=1");
    assert.equal(expRes.statusCode, 200);
    assert.ok(String(expRes.headers["Content-Type"]).includes("text/markdown"));
    assert.ok(String(expRes.headers["Content-Disposition"]).includes("attachment;"));
    assert.ok(expRes.body.includes("`替代 #1`"));
    assert.ok(expRes.body.includes("`已被 #2 替代`"));

    const bakRes = await host.invokeRoute("/dsh-zeromem/api/backup", { method: "POST", body: { sha256: true } });
    assert.equal(bakRes.statusCode, 200);
    const bakJson = JSON.parse(bakRes.body);
    assert.equal(bakJson.ok, true);
    assert.equal(bakJson.receipt.journal_mode, "delete");
    assert.equal(bakJson.receipt.integrity_check, "ok");
    assert.equal(bakJson.receipt.counts.supersessions, 1);
    assert.ok(fs.existsSync(bakJson.receipt.backup_path));
    assert.ok(fs.existsSync(bakJson.receipt.sha256_file));
  } finally {
    if (prevCfg === undefined) delete process.env.ZEROMEM_DSH_CONFIG;
    else process.env.ZEROMEM_DSH_CONFIG = prevCfg;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("read-only Markdown export (file, Obsidian dir, CLI stdout) leaves source DB byte-identical", () => {
  const dir = makeTempDir("zeromem_exp_");
  try {
    const dbPath = path.join(dir, "export.db");
    const store = new SQLiteMemoryStore(dbPath);
    store.saveDocumentAndFacts({
      docId: "doc-a",
      namespace: "project:alpha",
      contentSha256: "1".repeat(64),
      sourceId: "notes/alpha.md",
      mentionedAt: "2025-08-01T10:00:00Z",
      createdAt: "2025-08-01T10:00:00Z",
      segments: [
        {
          id: "s0",
          path: ["note", "0"],
          role: "user",
          text: "2025-08-01 初版端口 8080，临时规则 until:2025-12-31。",
        },
      ],
      facts: [
        {
          text: "初版服务端口为 8080（until:2025-12-31）。",
          type: "world",
          occurred_start: "2025-08-01",
          entities: ["project:alpha", "until:2025-12-31"],
          evidence: ["s0"],
          action: "pass",
        },
      ],
    });
    store.saveDocumentAndFacts({
      docId: "doc-b",
      namespace: "project:alpha",
      contentSha256: "2".repeat(64),
      sourceId: "notes/alpha-v2.md",
      mentionedAt: "2026-02-01T10:00:00Z",
      createdAt: "2026-02-01T10:00:00Z",
      segments: [{ id: "s0", path: ["note", "0"], role: null, text: "2026-02-01 端口改为 9090，禁用旧 8080。" }],
      facts: [
        {
          text: "正式服务端口迁移为 9090。",
          type: "world",
          occurred_start: "2026-02-01",
          entities: ["project:alpha"],
          evidence: ["s0"],
          action: "revise",
          supersedes_fact_id: 1,
        },
      ],
    });
    store.saveDocumentAndFacts({
      docId: "doc-c",
      namespace: "ops/sec",
      contentSha256: "3".repeat(64),
      sourceId: "ops.md",
      mentionedAt: "2026-03-01T00:00:00Z",
      createdAt: "2026-03-01T00:00:00Z",
      segments: [{ id: "s0", path: ["note", "0"], role: null, text: "使用独立只读账号同步日志。" }],
      facts: [
        {
          text: "使用独立只读账号同步日志。",
          type: "experience",
          occurred_start: "2026-03-01",
          entities: ["日志"],
          evidence: ["s0"],
          action: "pass",
        },
      ],
    });

    const beforeBytes = fs.readFileSync(dbPath);

    // 1. Single-file export
    const singleMd = path.join(dir, "all.md");
    const resFile = exportMarkdown({ dbPath, outputPath: singleMd, asOf: "2026-05-01" });
    assert.equal(resFile.ok, true);
    assert.equal(resFile.read_only, true);
    assert.equal(resFile.facts_exported, 3);
    assert.equal(resFile.superseded_facts, 1);
    assert.equal(resFile.expired_facts, 1);
    const md = fs.readFileSync(singleMd, "utf8");
    assert.ok(md.includes('generator: "ZeroMem"'));
    assert.ok(md.includes("`替代 #1`"));
    assert.ok(md.includes("`已被 #2 替代`"));
    assert.ok(md.includes("已过期（until 2025-12-31）"));
    assert.ok(md.includes("> **原文证据 (`s0` · `user`)**: 2025-08-01 初版端口 8080"));
    assert.ok(md.includes("> **原文证据 (`s0`)**: 2026-02-01 端口改为 9090"));

    // 2. Obsidian/Git per-namespace directory export
    const vaultDir = path.join(dir, "vault");
    const resDir = exportMarkdown({ dbPath, outputDir: vaultDir, asOf: "2026-05-01" });
    assert.equal(resDir.mode, "directory");
    assert.ok(fs.existsSync(path.join(vaultDir, "INDEX.md")));
    assert.ok(fs.existsSync(path.join(vaultDir, "project_alpha.md")));
    assert.ok(fs.existsSync(path.join(vaultDir, "ops_sec.md")));
    const idxTxt = fs.readFileSync(path.join(vaultDir, "INDEX.md"), "utf8");
    assert.ok(idxTxt.includes("[project:alpha](./project_alpha.md)"));
    assert.ok(idxTxt.includes("[ops/sec](./ops_sec.md)"));

    // 3. CLI export stdout + date slice
    const cliBin = path.resolve("bin/dsh-zeromem.mjs");
    const stdoutMd = execFileSync(
      process.execPath,
      [cliBin, "export", "--md", "--db", dbPath, "--ns", "project:alpha", "--occurred-from", "2026-01-01"],
      { encoding: "utf8" }
    );
    assert.ok(stdoutMd.includes("正式服务端口迁移为 9090"));
    assert.equal(stdoutMd.includes("初版服务端口为 8080"), false);

    // Source DB untouched byte-for-byte
    assert.equal(Buffer.compare(fs.readFileSync(dbPath), beforeBytes), 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("SQLite Online Backup flattens live WAL, verifies integrity, guards targets, and works via CLI", async () => {
  const dir = makeTempDir("zeromem_bak_");
  try {
    const dbPath = path.join(dir, "live.db");
    const store = new SQLiteMemoryStore(dbPath);
    store.saveDocumentAndFacts({
      docId: "doc-1",
      namespace: "prod",
      contentSha256: "c".repeat(64),
      sourceId: "prod.md",
      mentionedAt: "2026-01-01T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      segments: [{ id: "s0", path: ["note", "0"], role: null, text: "主库连接池上限 200。" }],
      facts: [
        {
          text: "主库连接池上限 200。",
          type: "world",
          occurred_start: "2026-01-01",
          entities: ["主库"],
          evidence: ["s0"],
          action: "pass",
        },
      ],
    });

    // Hold an open WAL read transaction while writing doc-2 so -wal has live frames
    const liveConn = new DatabaseSync(dbPath);
    let receipt;
    const snap = path.join(dir, "cloud_sync", "zeromem-snap.db");
    try {
      liveConn.exec("PRAGMA journal_mode = WAL;");
      liveConn.exec("BEGIN;");
      liveConn.prepare("SELECT COUNT(*) AS c FROM facts").get();

      store.saveDocumentAndFacts({
        docId: "doc-2",
        namespace: "prod",
        contentSha256: "d".repeat(64),
        sourceId: "prod-v2.md",
        mentionedAt: "2026-04-01T00:00:00Z",
        createdAt: "2026-04-01T00:00:00Z",
        segments: [{ id: "s0", path: ["note", "0"], role: null, text: "2026-04-01 主库连接池上限扩至 400。" }],
        facts: [
          {
            text: "主库连接池上限扩至 400。",
            type: "world",
            occurred_start: "2026-04-01",
            entities: ["主库"],
            evidence: ["s0"],
            action: "pass",
            supersedes_fact_id: 1,
          },
        ],
      });
      assert.ok(fs.existsSync(`${dbPath}-wal`));

      receipt = await backupDatabase({ dbPath, outputPath: snap, writeSha256: true });
    } finally {
      liveConn.close();
    }

    assert.equal(receipt.ok, true);
    assert.equal(receipt.method, "sqlite_online_backup");
    assert.equal(receipt.journal_mode, "delete");
    assert.equal(receipt.wal_sidecars_present, false);
    assert.equal(receipt.integrity_check, "ok");
    assert.equal(receipt.application_id_valid, true);
    assert.equal(receipt.schema_version, "1");
    assert.equal(receipt.counts.facts, 2);
    assert.equal(receipt.counts.supersessions, 1);
    assert.equal(fs.existsSync(`${snap}-wal`), false);
    assert.equal(fs.existsSync(`${snap}-shm`), false);
    assert.ok(fs.existsSync(receipt.sha256_file));

    // Snapshot immediately usable as a standalone store with full lineage
    const snapStore = new SQLiteMemoryStore(snap);
    const hits = snapStore.search("主库连接池", { namespace: "prod", adaptive: false });
    assert.deepEqual(hits.map((h) => h.fact_id), [2, 1]);
    assert.equal(hits[0].supersedes_fact_id, 1);
    assert.deepEqual(hits[1].superseded_by, [2]);

    // Safety guards
    await assert.rejects(() => backupDatabase({ dbPath, outputPath: snap, overwrite: false }), /backup-target-exists/);
    await assert.rejects(
      () => backupDatabase({ dbPath, outputPath: dbPath, overwrite: true }),
      /backup-target-equals-source/
    );

    // CLI auto-naming inside directory + JSON receipt
    const bdir = path.join(dir, "auto_backups");
    fs.mkdirSync(bdir, { recursive: true });
    const cliBin = path.resolve("bin/dsh-zeromem.mjs");
    const rawOut = execFileSync(process.execPath, [cliBin, "backup", bdir, "--db", dbPath, "--json"], {
      encoding: "utf8",
    });
    const cliReceipt = JSON.parse(rawOut);
    assert.equal(cliReceipt.ok, true);
    assert.ok(fs.existsSync(cliReceipt.backup_path));
    assert.equal(path.dirname(cliReceipt.backup_path), path.resolve(bdir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
