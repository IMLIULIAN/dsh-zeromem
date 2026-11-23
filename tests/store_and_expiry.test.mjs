import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  evaluateExpiry,
  parseCalendarDate,
  parseUntilDate,
  partitionExpired,
  selectAdaptiveHits,
} from "../lib/expiry.mjs";
import {
  APP_FORMAT_ID,
  FORMAT_DIGEST,
  SCHEMA_SIG,
  SQLiteMemoryStore,
  canonicalJson,
  sha256Text,
  tokenizeForFts,
} from "../lib/store.mjs";

function makeTempDb(prefix = "zeromem_store_") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return { dir, dbPath: path.join(dir, "memory.db") };
}

test("SQLite schema watermarks, dual-track CJK/EN FTS5, and until: expiry demotion", () => {
  const { dir, dbPath } = makeTempDb();
  try {
    const store = new SQLiteMemoryStore(dbPath);
    const db = new DatabaseSync(dbPath);
    const appId = Number(db.prepare("PRAGMA application_id").get().application_id);
    const metaRows = Object.fromEntries(
      db.prepare("SELECT key, value FROM meta").all().map((r) => [r.key, r.value])
    );
    db.close();

    assert.equal(appId, APP_FORMAT_ID);
    assert.equal(APP_FORMAT_ID, 0x494d4c4c);
    assert.equal(metaRows.schema_version, "1");
    assert.equal(metaRows.schema_sig, SCHEMA_SIG);
    assert.equal(metaRows.format_digest, FORMAT_DIGEST);

    const saved = store.saveDocumentAndFacts({
      docId: "doc-test001",
      namespace: "ops",
      contentSha256: sha256Text("seed"),
      sourceId: "test",
      mentionedAt: "2026-11-23T00:00:00Z",
      createdAt: "2026-11-23T00:00:00Z",
      segments: [
        { id: "s0", path: ["note", "0"], role: null, text: "网关限流默认每分钟 120 次。" },
        { id: "s1", path: ["note", "1"], role: null, text: "临时限流放宽活动 until:2025-12-31 生效。" },
      ],
      facts: [
        {
          text: "API 网关限流默认每分钟 120 次。",
          type: "world",
          entities: ["API 网关", "限流"],
          evidence: ["s0"],
          action: "pass",
        },
        {
          text: "API 网关限流临时活动规则 until:2025-12-31。",
          type: "world",
          entities: ["API 网关", "until:2025-12-31"],
          evidence: ["s1"],
          action: "revise",
        },
      ],
    });
    assert.equal(saved.length, 2);

    const hits = store.search("网关限流", { namespace: "ops", asOf: "2026-11-23", adaptive: false });
    assert.equal(hits.length, 2);
    // Active record comes first; expired record is non-destructively demoted to tail
    assert.equal(hits[0].until_expiry, undefined);
    assert.equal(hits[1].until_expiry.expired, true);
    assert.equal(hits[1].until_expiry.until, "2025-12-31");
    assert.equal(hits[1].text, "API 网关限流临时活动规则 until:2025-12-31。");

    // Negative control: disable until expiry leaves no until_expiry metadata
    const neg = store.search("网关限流", { namespace: "ops", untilEnabled: false, adaptive: false });
    assert.equal(neg.every((r) => r.until_expiry === undefined), true);

    const st = store.stats();
    assert.equal(st.documents, 1);
    assert.equal(st.facts, 2);
    assert.equal(st.revised_facts, 1);
    assert.deepEqual(st.namespaces, ["ops"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("until: strict calendar parsing and adaptive 2-8 score gating", () => {
  assert.equal(parseCalendarDate(2026, 2, 30), null);
  assert.equal(parseCalendarDate(2028, 2, 29), "2028-02-29");
  assert.equal(
    parseUntilDate({ tags: ["until:2026-01-10", "until:20260315"], text: "notes until:2026-02-01" }),
    "2026-03-15"
  );
  assert.equal(evaluateExpiry("2026-12-01", "2026-11-23"), null);
  assert.equal(evaluateExpiry("2026-11-20", "2026-11-23").expired_days, 3);

  const synthetic = [
    { fact_id: 1, text: "A", score: 10.0 },
    { fact_id: 2, text: "B", score: 8.0 },
    { fact_id: 3, text: "C", score: 4.0 },
    { fact_id: 4, text: "D", score: 2.0 },
    { fact_id: 5, text: "E", score: 1.0 },
  ];
  const gated = selectAdaptiveHits(synthetic, { limit: 8, minLimit: 2, scoreRatio: 0.35, adaptive: true });
  assert.deepEqual(
    gated.map((r) => r.fact_id),
    [1, 2, 3]
  );

  // Disabled rollback returns fixed cap
  const rolled = selectAdaptiveHits(synthetic, {
    limit: 6,
    adaptive: true,
    env: { ZEROMEM_ADAPTIVE_LIMIT_DISABLED: "1" },
  });
  assert.equal(rolled.length, 5);

  // Partition anchors leading score on active hit even if expired tail has higher score
  const mixed = [
    { fact_id: 10, text: "expired until:2025-01-01", score: 50.0 },
    { fact_id: 11, text: "active strong", score: 6.0 },
    { fact_id: 12, text: "active ok", score: 3.0 },
    { fact_id: 13, text: "active weak", score: 1.0 },
  ];
  const { items } = partitionExpired(mixed, { today: "2026-11-23" });
  assert.equal(items[items.length - 1].fact_id, 10);
  const picked = selectAdaptiveHits(items, { limit: 8, minLimit: 2, scoreRatio: 0.35, adaptive: true });
  assert.deepEqual(
    picked.map((r) => r.fact_id),
    [11, 12]
  );
});

test("softEvict conservation and fail-closed SHA-256 tamper-checked restore", () => {
  const { dir, dbPath } = makeTempDb("zeromem_evict_");
  try {
    const store = new SQLiteMemoryStore(dbPath);
    const ids = store.saveDocumentAndFacts({
      docId: "doc-ev001",
      namespace: "work",
      contentSha256: sha256Text("evict-test"),
      mentionedAt: "2026-11-23T00:00:00Z",
      createdAt: "2026-11-23T00:00:00Z",
      segments: [
        { id: "s0", path: ["note", "0"], role: null, text: "Postgres 端口为 5432。" },
        { id: "s1", path: ["note", "1"], role: null, text: "Redis 端口为 6379。" },
      ],
      facts: [
        { text: "Postgres 监听 5432 端口。", type: "world", entities: ["Postgres"], evidence: ["s0"], action: "pass" },
        { text: "Redis 监听 6379 端口。", type: "world", entities: ["Redis"], evidence: ["s1"], action: "pass" },
      ],
    });

    // Guard refuses emptying 100% without force=true
    assert.throws(() => store.softEvict({ factIds: ids, reason: "all", force: false }), /evict-safety-guard/);

    // Evict single fact
    const ev = store.softEvict({ factIds: [ids[0]], reason: "outdated" });
    assert.equal(ev.moved_facts, 1);
    assert.equal(store.stats().facts, 1);
    assert.equal(store.stats().evicted_records, 1);
    assert.equal(store.search("Postgres", { adaptive: false }).length, 0);

    const batches = store.listEvictedBatches();
    assert.equal(batches.length, 1);
    assert.equal(batches[0].batch_id, ev.batch_id);

    // Tamper check aborts fail-closed
    const db = new DatabaseSync(dbPath);
    const origRow = db.prepare("SELECT payload_json FROM evicted_records WHERE batch_id = ?").get(ev.batch_id);
    const tampered = String(origRow.payload_json).replace("5432", "9999");
    db.prepare("UPDATE evicted_records SET payload_json = ? WHERE batch_id = ?").run(tampered, ev.batch_id);
    db.close();

    assert.throws(() => store.restoreEvicted(ev.batch_id), /tamper-detected/);
    assert.equal(store.stats().facts, 1);

    // Restore original payload -> atomic restore succeeds & rebuilds FTS5
    const db2 = new DatabaseSync(dbPath);
    db2.prepare("UPDATE evicted_records SET payload_json = ? WHERE batch_id = ?").run(
      origRow.payload_json,
      ev.batch_id
    );
    db2.close();

    const restored = store.restoreEvicted(ev.batch_id);
    assert.equal(restored.restored_facts, 1);
    assert.equal(store.stats().facts, 2);
    assert.equal(store.stats().evicted_records, 0);
    assert.equal(store.search("Postgres", { adaptive: false }).length, 1);

    // Canonical JSON key ordering check
    assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
    assert.ok(tokenizeForFts("网关限流 api_v2").includes("网关"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
