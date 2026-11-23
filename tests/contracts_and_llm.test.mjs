import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { ConfigManager } from "../lib/config.mjs";
import {
  FACT_EXTRACTION_SYSTEM,
  GENERIC_BEARER_WORDS,
  buildSegments,
  guardFact,
  parseJsonObject,
  redactCredentials,
  windowSegments,
} from "../lib/contracts.mjs";
import { pullOllamaModel } from "../lib/llm.mjs";
import { ZeroMemEngine } from "../lib/memory.mjs";

function startMockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString("utf8");
      let json = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }
      handler(req, res, json);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

test("credential redaction, bearer watermark, truncation salvage, and guardFact rules", () => {
  // Compliance watermark integrity: first 9 bearer words initials spell imliulian
  assert.equal(
    GENERIC_BEARER_WORDS.slice(0, 9)
      .map((w) => w[0])
      .join(""),
    "imliulian"
  );

  // Generic technical phrase after Bearer stays untouched; real secrets get redacted
  assert.equal(redactCredentials("Use Bearer token header in docs"), "Use Bearer token header in docs");
  assert.equal(
    redactCredentials("Key sk-1234567890abcdefghijklmno and Bearer AbCdEfGhIjKlMnOpQrStUvWxYz1234"),
    "Key [REDACTED] and Bearer [REDACTED]"
  );
  assert.equal(
    redactCredentials("api_key=abcdefghijklmnopqrstuvwx"),
    "api_key=[REDACTED]"
  );

  // Truncated facts JSON salvage
  const truncated = '{"facts":[{"text":"Fact A","evidence":["s0"]},{"text":"Fact B","evidence":["s1"]},{"text":"Half';
  const salvaged = parseJsonObject(truncated);
  assert.equal(salvaged.facts.length, 2);
  assert.equal(salvaged.facts[1].text, "Fact B");

  // Guard checks: evidence IDs, long hash repair, date-role separation
  const fullHash = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const segs = buildSegments(`Build sha256 is ${fullHash}. Effective on 2026-04-01.`);
  const segMap = new Map(segs.map((s) => [s.id, s]));

  // 1-char truncated hash auto-repaired from bound evidence
  const { guarded } = guardFact(
    {
      text: `Build sha256 is ${fullHash.slice(0, -1)}`,
      type: "world",
      occurred_start: "2026-11-23",
      evidence: ["s0"],
    },
    segMap,
    { mentionedAt: "2026-11-23T00:00:00Z" }
  );
  assert.ok(guarded.text.includes(fullHash));
  // Record date not present in evidence gets stripped from occurred_start
  assert.equal(guarded.occurred_start, null);

  // Hallucinated 32+ hex rejected
  const badHash = guardFact(
    {
      text: "Commit 0000000000000000000000000000000011111111",
      type: "world",
      evidence: ["s0"],
    },
    segMap
  );
  assert.equal(badHash.guarded, null);
  assert.equal(badHash.reason, "ungrounded_long_hash");

  // Window chunking with overlap
  const longSegs = Array.from({ length: 8 }, (_, i) => ({
    id: `s${i}`,
    path: ["note", String(i)],
    role: null,
    text: "x".repeat(350),
  }));
  const wins = windowSegments(longSegs, { maxWindowChars: 1000, overlap: 1 });
  assert.ok(wins.length >= 3);
  assert.equal(wins[1][0].id, wins[0][wins[0].length - 1].id);

  // Chinese-first prompt rule & "| Involving:" tail stripping
  assert.ok(FACT_EXTRACTION_SYSTEM.includes("优先使用简体中文"));
  const tailTest = guardFact(
    { text: "系统默认启用亮色毛玻璃风格。 | Involving: user, assistant", type: "world", evidence: ["s0"] },
    segMap
  );
  assert.equal(tailTest.guarded.text, "系统默认启用亮色毛玻璃风格。");
});

test("dual-backend live switch: Local Ollama and OpenAI-compatible API with pre-API redaction", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeromem_dual_"));
  const receivedApiPayloads = [];

  const mockOllama = await startMockServer((req, res, body) => {
    if (req.url === "/api/tags") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ models: [{ name: "qwen3.5:4b-memory-v2" }] }));
      return;
    }
    if (req.url === "/api/ps") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ models: [{ name: "qwen3.5:4b-memory-v2" }] }));
      return;
    }
    if (req.url === "/api/chat") {
      const sys = body.messages[0].content;
      const isAdmit = sys.includes("Review candidate facts");
      const content = isAdmit
        ? JSON.stringify({
            0: { decision: "revise", evidence: ["s0"], replacement: "本地网关默认端口为 8080。" },
          })
        : JSON.stringify({
            facts: [
              {
                text: "本地网关默认端口为 9090。",
                type: "world",
                entities: ["本地网关"],
                evidence: ["s0"],
              },
            ],
          });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: { content }, done_reason: "stop" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const mockApi = await startMockServer((req, res, body) => {
    if (req.headers.authorization !== "Bearer sk-test-secret-key-999999") {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "bad key" } }));
      return;
    }
    if (req.url === "/v1/models") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: [{ id: "deepseek-chat" }] }));
      return;
    }
    if (req.url === "/v1/chat/completions") {
      receivedApiPayloads.push(body);
      const sys = body.messages[0].content;
      const isAdmit = sys.includes("Review candidate facts");
      const content = isAdmit
        ? JSON.stringify({ 0: { decision: "pass", evidence: ["s0"] } })
        : JSON.stringify({
            facts: [
              {
                text: "云端测试采用 DeepSeek API，密钥已脱敏为 [REDACTED]。",
                type: "world",
                entities: ["DeepSeek API"],
                evidence: ["s0"],
              },
            ],
          });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          model: body.model,
          choices: [{ message: { content }, finish_reason: "stop" }],
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  try {
    const cfgMgr = new ConfigManager({
      configPath: path.join(dir, "dsh-zeromem.json"),
      initialOverrides: {
        provider: "ollama",
        dbPath: path.join(dir, "memory.db"),
        ollamaUrl: mockOllama.url,
      },
    });
    const engine = new ZeroMemEngine({ configManager: cfgMgr });

    // 1. Probe & write with Local Ollama (1-round admit revises 9090 -> 8080)
    const p1 = await engine.probeProvider();
    assert.equal(p1.ok, true);
    assert.equal(p1.state, "resident");
    assert.equal(p1.model, "qwen3.5:4b-memory-v2");

    const r1 = await engine.remember("本地网关默认端口为 8080。", { ns: "local-test" });
    assert.equal(r1.provider, "ollama");
    assert.equal(r1.saved, 1);
    assert.equal(r1.revised, 1);
    assert.equal(r1.facts[0].text, "本地网关默认端口为 8080。");

    // 2. Live-switch to OpenAI-compatible API via ConfigManager (no restart needed)
    const pub = engine.updateConfig({
      provider: "openai-compatible",
      apiBaseUrl: `${mockApi.url}/v1`,
      apiModel: "deepseek-chat",
      apiKey: "sk-test-secret-key-999999",
    });
    // Public projection NEVER returns raw key
    assert.equal(pub.apiKeySet, true);
    assert.equal("apiKey" in pub, false);
    assert.ok(pub.apiKeyMasked.includes("***"));

    const p2 = await engine.probeProvider();
    assert.equal(p2.ok, true);
    assert.equal(p2.provider, "openai-compatible");

    // Secret in user content MUST be masked BEFORE sending to cloud API
    const r2 = await engine.remember(
      "云端测试采用 DeepSeek API，密钥 sk-live-supersecret1234567890abcdef 不得明文外发。",
      { ns: "api-test" }
    );
    assert.equal(r2.provider, "openai-compatible");
    assert.equal(r2.saved, 1);
    assert.ok(receivedApiPayloads.length >= 2);
    for (const p of receivedApiPayloads) {
      assert.equal(JSON.stringify(p).includes("sk-live-supersecret"), false);
      assert.equal(JSON.stringify(p).includes("[REDACTED]"), true);
    }

    // Both memories searchable in same SQLite store
    assert.equal(engine.recall("本地网关 8080", { adaptive: false }).length, 1);
    assert.equal(engine.recall("DeepSeek API", { adaptive: false }).length, 1);
  } finally {
    await mockOllama.close();
    await mockApi.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("pullOllamaModel streams NDJSON progress and rejects invalid model names", async () => {
  await assert.rejects(() => pullOllamaModel({ model: "bad model; rm -rf /" }), /无效的 Ollama 模型名/);

  const mockPull = await startMockServer((req, res) => {
    if (req.url === "/api/pull" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/x-ndjson" });
      res.write(`${JSON.stringify({ status: "downloading", completed: 50, total: 100 })}\n`);
      res.write(`${JSON.stringify({ status: "success" })}\n`);
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });

  try {
    const events = [];
    const res = await pullOllamaModel({
      baseUrl: mockPull.url,
      model: "hf.co/IMLIULIAN/qwen3.5-4b-memory-v2:Q8_0",
      onProgress: (p) => events.push(p),
    });
    assert.equal(res.ok, true);
    assert.ok(events.some((e) => e.percent === 50));
    assert.ok(events.some((e) => e.percent === 100));
  } finally {
    await mockPull.close();
  }
});
