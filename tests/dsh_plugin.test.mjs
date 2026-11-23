import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import plugin, { apply } from "../lib/index.mjs";
import { CONFIG_SCHEMA_REV } from "../lib/config.mjs";
import { TRIVIAL_ACK_WORDS, stripInjectedMemory } from "../lib/hooks.mjs";
import { sha256Text } from "../lib/store.mjs";

function createMockCordisHost() {
  const events = new Map();
  const tools = new Map();
  const routes = new Map();
  const indexTappers = [];
  const cleanups = [];

  const root = {
    on(eventName, fn) {
      if (!events.has(eventName)) events.set(eventName, []);
      events.get(eventName).push(fn);
      return () => {
        const arr = events.get(eventName) || [];
        const i = arr.indexOf(fn);
        if (i !== -1) arr.splice(i, 1);
      };
    },
    inject(deps, cb) {
      const subCtx = {
        on: root.on,
        effect: root.effect,
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
          tapIndex(fn) {
            indexTappers.push(fn);
            return () => {
              const i = indexTappers.indexOf(fn);
              if (i !== -1) indexTappers.splice(i, 1);
            };
          },
        },
      };
      cb(subCtx);
    },
    effect(fn) {
      cleanups.push(fn);
    },
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
    const resChunks = [];
    const res = {
      writeHead(code, hdrs) {
        statusCode = code;
        resHeaders = hdrs || {};
      },
      write(chunk) {
        if (chunk) resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8"));
      },
      end(chunk) {
        if (chunk) resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8"));
      },
    };

    const done = route.handler(req, res);
    if (body !== null && body !== undefined) {
      req.emit("data", Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8"));
    }
    req.emit("end");
    await done;
    const rawBuffer = Buffer.concat(resChunks);
    return { statusCode, headers: resHeaders, body: rawBuffer.toString("utf8"), buffer: rawBuffer };
  }

  return { root, events, tools, routes, indexTappers, invokeRoute };
}

test("Cordis plugin mounts tools, hooks, Desktop index-inject, Web routes, and security fence", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeromem_dsh_"));
  const prevCfgEnv = process.env.ZEROMEM_DSH_CONFIG;
  process.env.ZEROMEM_DSH_CONFIG = path.join(dir, "dsh-zeromem.json");

  try {
    assert.equal(plugin.name, "zeromem");
    const host = createMockCordisHost();
    apply(host.root, {
      dbPath: path.join(dir, "memory.db"),
      ollamaUrl: "http://127.0.0.1:1", // intentionally offline to verify fail-open
    });

    // 1. Desktop Electron structured inline injection registered synchronously
    const injectTable = [];
    for (const fn of host.events.get("webserver/index-inject") || []) fn(injectTable);
    assert.equal(injectTable.length, 1);
    assert.equal(injectTable[0].kind, "script");
    assert.ok(injectTable[0].text.includes("/dsh-zeromem/panel.js"));

    // 2. Web tapIndex injects script tag idempotently
    assert.equal(host.indexTappers.length, 1);
    const html1 = host.indexTappers[0]("<html><body><div id='app'></div></body></html>");
    assert.ok(html1.includes('<script defer src="/dsh-zeromem/panel.js"></script>'));
    assert.equal(host.indexTappers[0](html1), html1);

    // 3. All 5 native DSH tools registered with lossless JSON output
    for (const tName of ["zeromem_recall", "zeromem_remember", "zeromem_stats", "zeromem_evict", "zeromem_restore"]) {
      assert.ok(host.tools.has(tName), `Missing tool ${tName}`);
    }
    const statsRes = await host.tools.get("zeromem_stats").execute({});
    assert.equal(statsRes.ok, true);
    assert.equal(statsRes.facts, 0);
    // Strict lossless JSON check (no undefined values)
    assert.equal(JSON.stringify(statsRes).includes("undefined"), false);

    // Offline remember fails gracefully (never throws into host)
    const offlineRem = await host.tools.get("zeromem_remember").execute({ content: "test offline graceful" });
    assert.equal(offlineRem.ok, false);
    assert.ok(offlineRem.error.includes("写入失败"));

    // 4. Web route security fence rejects spoofed Host & cross-site requests
    const badHost = await host.invokeRoute("/dsh-zeromem/api/status?quick=1", {
      headers: { host: "evil.example.com" },
    });
    assert.equal(badHost.statusCode, 403);

    const crossSite = await host.invokeRoute("/dsh-zeromem/api/config", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
      body: { provider: "openai-compatible" },
    });
    assert.equal(crossSite.statusCode, 403);

    // 5. Legitimate Web API: panel.js, config switch Local <-> API, status, memories
    const panelRes = await host.invokeRoute("/dsh-zeromem/panel.js");
    assert.equal(panelRes.statusCode, 200);
    assert.ok(panelRes.body.includes("__DSH_ZEROMEM_LOADED__"));
    assert.ok(String(panelRes.headers.ETag || "").startsWith('"zm-'));

    const cfgPost = await host.invokeRoute("/dsh-zeromem/api/config", {
      method: "POST",
      body: {
        provider: "openai-compatible",
        apiBaseUrl: "https://api.deepseek.com/v1",
        apiModel: "deepseek-chat",
        customApiBaseUrl: "https://custom.gateway.example/v1",
        customApiModel: "my-custom-model",
        apiKey: "sk-my-api-secret-key-000111222",
      },
    });
    assert.equal(cfgPost.statusCode, 200);
    const cfgBody = JSON.parse(cfgPost.body);
    assert.equal(cfgBody.config.provider, "openai-compatible");
    assert.equal(cfgBody.config.apiKeySet, true);
    assert.equal(cfgBody.config.customApiBaseUrl, "https://custom.gateway.example/v1");
    assert.equal(cfgBody.config.customApiModel, "my-custom-model");
    assert.ok(cfgBody.config.presets.some((p) => p.id === "custom" && p.label === "自定义 API"));
    assert.equal(cfgPost.body.includes("sk-my-api-secret-key"), false);
    const persistedCfg = JSON.parse(fs.readFileSync(process.env.ZEROMEM_DSH_CONFIG, "utf8"));
    assert.equal(persistedCfg.configRev, CONFIG_SCHEMA_REV);
    assert.ok(TRIVIAL_ACK_WORDS.length >= 16);

    // 6. Seed a fact and verify pre-step auto-recall injection + anti-loop stripping
    const { SQLiteMemoryStore } = await import("../lib/store.mjs");
    const store = new SQLiteMemoryStore(path.join(dir, "memory.db"));
    store.saveDocumentAndFacts({
      docId: "doc-hook1",
      namespace: "project:demo-app",
      contentSha256: sha256Text("hook-seed"),
      mentionedAt: "2026-11-23T00:00:00Z",
      createdAt: "2026-11-23T00:00:00Z",
      segments: [{ id: "s0", path: ["note", "0"], role: null, text: "部署端口固定使用 7788。" }],
      facts: [
        {
          text: "demo-app 部署端口固定使用 7788。",
          type: "world",
          entities: ["demo-app", "7788"],
          evidence: ["s0"],
          action: "pass",
        },
      ],
    });

    const preStepHandlers = host.events.get("agent/pre-step") || [];
    assert.equal(preStepHandlers.length, 1);
    const fakeAgent = { session: { header: { id: "sess-1", cwd: "/tmp/demo-app", origin: "user" } } };
    const decision = await preStepHandlers[0](
      { agent: fakeAgent, signal: { aborted: false } },
      async () => ({
        kind: "enter",
        messages: [
          {
            role: "user",
            source: { kind: "user" },
            content: [{ type: "text", text: "部署端口是多少？" }],
          },
        ],
      })
    );
    assert.equal(decision.messages.length, 2);
    assert.equal(decision.messages[1].source.kind, "plugin:zeromem");
    const injectedText = decision.messages[1].content[0].text;
    assert.ok(injectedText.includes("7788"));
    assert.equal(stripInjectedMemory(`hello\n${injectedText}\nworld`), "hello\n\nworld");

    // 7. Web memories & soft-evict -> recycle bin -> restore roundtrip
    const memList = JSON.parse((await host.invokeRoute("/dsh-zeromem/api/memories?q=7788")).body);
    assert.equal(memList.count, 1);
    const fid = memList.items[0].fact_id;

    const evRes = JSON.parse(
      (
        await host.invokeRoute("/dsh-zeromem/api/evict", {
          method: "POST",
          body: { fact_id: fid, reason: "test-web-evict", force: true },
        })
      ).body
    );
    assert.equal(evRes.result.moved_facts, 1);

    const recList = JSON.parse((await host.invokeRoute("/dsh-zeromem/api/evicted")).body);
    assert.equal(recList.batches.length, 1);

    const restRes = JSON.parse(
      (
        await host.invokeRoute("/dsh-zeromem/api/restore", {
          method: "POST",
          body: { batch_id: evRes.result.batch_id },
        })
      ).body
    );
    assert.equal(restRes.result.restored_facts, 1);

    // 8. Default light theme, frosted glass config, processing activity snapshot & background upload guard
    const statusPayload = JSON.parse((await host.invokeRoute("/dsh-zeromem/api/status?quick=1")).body);
    assert.equal(statusPayload.config.uiTheme, "light");
    assert.equal(statusPayload.config.uiGlassBlur, 30);
    assert.equal(statusPayload.config.uiGlassTint, 60);
    assert.equal(statusPayload.config.uiHasBackground, false);
    assert.equal(typeof statusPayload.activity.busy, "boolean");
    assert.equal(statusPayload.setup.active, false);

    const setupGet = await host.invokeRoute("/dsh-zeromem/api/local-setup");
    assert.equal(setupGet.statusCode, 200);
    const setupJson = JSON.parse(setupGet.body);
    assert.equal(setupJson.ok, true);
    assert.ok(Array.isArray(setupJson.recommended_models) && setupJson.recommended_models.length >= 2);
    assert.ok(setupJson.install_guide?.downloadUrl?.startsWith("https://ollama.com/"));

    const bgEmpty = await host.invokeRoute("/dsh-zeromem/api/background");
    assert.equal(bgEmpty.statusCode, 204);

    // Reject SVG / non-image spoofing (XSS prevention)
    const svgSpoof = await host.invokeRoute("/dsh-zeromem/api/background", {
      method: "POST",
      body: {
        dataUrl: `data:image/png;base64,${Buffer.from("<svg onload=alert(1)></svg>", "utf8").toString("base64")}`,
      },
    });
    assert.equal(svgSpoof.statusCode, 400);

    // Upload valid 1x1 PNG -> verify persistence, nosniff header & cleanup
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    const bgPost = await host.invokeRoute("/dsh-zeromem/api/background", {
      method: "POST",
      body: { dataUrl: `data:image/png;base64,${pngBytes.toString("base64")}` },
    });
    assert.equal(bgPost.statusCode, 200);
    const bgPostJson = JSON.parse(bgPost.body);
    assert.equal(bgPostJson.config.uiHasBackground, true);
    assert.ok(bgPostJson.config.uiBackgroundUrl.startsWith("/dsh-zeromem/api/background?v="));

    const bgGet = await host.invokeRoute("/dsh-zeromem/api/background");
    assert.equal(bgGet.statusCode, 200);
    assert.equal(bgGet.headers["Content-Type"], "image/png");
    assert.equal(bgGet.headers["X-Content-Type-Options"], "nosniff");
    assert.equal(Buffer.compare(bgGet.buffer, pngBytes), 0);

    const bgDel = await host.invokeRoute("/dsh-zeromem/api/background", { method: "DELETE" });
    assert.equal(bgDel.statusCode, 200);
    assert.equal(JSON.parse(bgDel.body).config.uiHasBackground, false);
    assert.equal((await host.invokeRoute("/dsh-zeromem/api/background")).statusCode, 204);
  } finally {
    if (prevCfgEnv === undefined) delete process.env.ZEROMEM_DSH_CONFIG;
    else process.env.ZEROMEM_DSH_CONFIG = prevCfgEnv;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
