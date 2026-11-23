/**
 * DSH Web / Desktop HTTP backend and dual-channel UI script injection for ZeroMem.
 *
 * Dual-channel injection (works on both `dsh web` and official Electron DSH Desktop):
 *   1. `registerDesktopIndexInject(root)` — registered synchronously at top of `apply(root)` via
 *      `webserver/index-inject` using an inline script that appends `<script src="/dsh-zeromem/panel.js">`
 *      with silent `onerror` so hot-disabling NEVER rejects Desktop boot.
 *   2. `ctx.webServer.tapIndex(...)` — injects `<script defer src="/dsh-zeromem/panel.js">` in `dsh web`.
 *
 * Security fence (2-layer fail-closed):
 *   1. Local loopback/trusted-host check + `Sec-Fetch-Site: cross-site` block + same-origin POST check.
 *   2. Delegates to host `connection.requestRejection(req)` when available (fail-closed on throw).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PANEL_JS_PATH = path.join(PACKAGE_ROOT, "assets", "panel.js");
const PKG_JSON_PATH = path.join(PACKAGE_ROOT, "package.json");

const JSON_HEADERS = Object.freeze({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
});

const DESKTOP_LOADER_INLINE =
  '(function(){try{if(window.__DSH_ZEROMEM_LOADED__)return;' +
  'var d=document.body||document.head||document.documentElement;if(!d)return;' +
  'var s=document.createElement("script");s.src="/dsh-zeromem/panel.js";' +
  's.onerror=function(){};d.appendChild(s);}catch(e){}})()';

let cachedPkgVersion = "0.1.0";
try {
  const pkg = JSON.parse(fs.readFileSync(PKG_JSON_PATH, "utf8"));
  if (pkg?.version) cachedPkgVersion = String(pkg.version);
} catch {
  // ignore
}

function isLoopbackHostname(rawHost) {
  const host = String(rawHost || "").trim().toLowerCase();
  if (!host) return false;
  let hn = host;
  if (hn.startsWith("[")) {
    const end = hn.indexOf("]");
    hn = end !== -1 ? hn.slice(1, end) : hn;
  } else {
    const colon = hn.lastIndexOf(":");
    if (colon !== -1 && hn.indexOf(":") === colon) {
      hn = hn.slice(0, colon);
    }
  }
  if (hn === "localhost" || hn.endsWith(".localhost") || hn === "::1") return true;
  const parts = hn.split(".");
  if (parts.length === 4 && parts[0] === "127") {
    return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
  }
  return false;
}

function extractAuthority(headerVal) {
  const raw = String(headerVal || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

export function createRequestGuard(ctx) {
  const envTrusted = String(process.env.DSH_ZEROMEM_TRUSTED_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  function trustedAuthorities() {
    const set = new Set(envTrusted);
    try {
      const conn = typeof ctx?.get === "function" ? ctx.get("connection") : ctx?.connection;
      if (Array.isArray(conn?.trustedHosts)) {
        for (const h of conn.trustedHosts) {
          if (typeof h === "string" && h.trim()) set.add(h.trim().toLowerCase());
        }
      }
    } catch {
      // ignore
    }
    return set;
  }

  return function rejectIfUnauthorized(req, res) {
    const deny = (status, msg) => {
      res.writeHead(status, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, error: msg }));
      return true;
    };

    const headers = req?.headers || {};
    const hostHeader = String(headers.host || "").trim().toLowerCase();
    const trusted = trustedAuthorities();
    const hostAllowed =
      isLoopbackHostname(hostHeader) ||
      trusted.has(hostHeader) ||
      trusted.has(hostHeader.split(":")[0]);

    if (!hostAllowed) {
      return deny(403, "Forbidden host authority");
    }

    const fetchSite = String(headers["sec-fetch-site"] || "").trim().toLowerCase();
    if (fetchSite === "cross-site") {
      return deny(403, "Cross-site request blocked");
    }

    const originHeader = String(headers.origin || "").trim();
    if (originHeader) {
      const originAuth = extractAuthority(originHeader);
      const isAppScheme = originHeader.startsWith("dsh-app://") || originHeader === "null";
      if (!isAppScheme && originAuth && hostHeader && originAuth !== hostHeader) {
        return deny(403, "Origin mismatch");
      }
    }

    // Layer 2: delegate to host connection.requestRejection if present (fail-closed)
    try {
      const conn = typeof ctx?.get === "function" ? ctx.get("connection") : ctx?.connection;
      if (conn && typeof conn.requestRejection === "function") {
        const rejection = conn.requestRejection(req);
        if (rejection !== undefined && rejection !== null && rejection !== false) {
          if (typeof rejection === "number") return deny(rejection, "Rejected by host gate");
          if (typeof rejection === "object" && typeof rejection.status === "number") {
            return deny(rejection.status, String(rejection.message || "Rejected by host gate"));
          }
          return deny(403, "Rejected by host gate");
        }
      }
    } catch {
      return deny(403, "Host request gate error");
    }

    return false;
  };
}

function readJsonBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", (err) => reject(err));
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(payload));
}

function parseQuery(reqUrl) {
  try {
    return new URL(String(reqUrl || "/"), "http://127.0.0.1").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function loadPanelJs() {
  try {
    return fs.readFileSync(PANEL_JS_PATH, "utf8");
  } catch {
    return "/* ZeroMem panel asset missing */";
  }
}

/**
 * Must be called synchronously inside `apply(root)` before any `root.inject(...)`
 * so official DSH Desktop collects the inline loader during initial boot.
 */
export function registerDesktopIndexInject(root) {
  if (!root || typeof root.on !== "function") return () => {};
  return root.on("webserver/index-inject", (table) => {
    try {
      if (!Array.isArray(table)) return;
      for (const row of table) {
        if (!row) continue;
        if (row.kind === "script-src" && row.src === "/dsh-zeromem/panel.js") return;
        if (row.kind === "script" && typeof row.text === "string" && row.text.includes("/dsh-zeromem/panel.js")) {
          return;
        }
      }
      table.push({ kind: "script", placement: "body", text: DESKTOP_LOADER_INLINE });
    } catch {
      // fail-open
    }
  });
}

export function mountWebServer(ctx, engine) {
  const disposers = [];
  if (!ctx?.webServer || typeof ctx.webServer.register !== "function") return () => {};

  const reject = createRequestGuard(ctx);
  const addRoute = (routePath, handler) => {
    const dispose = ctx.webServer.register({
      kind: "exact",
      path: routePath,
      handler: async (req, res) => {
        if (reject(req, res)) return;
        try {
          await handler(req, res);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: String(err?.message || err).slice(0, 300) });
        }
      },
    });
    if (typeof dispose === "function") disposers.push(dispose);
  };

  const PANEL_ETAG = '"zm-c9f48efabf95bb82"';

  addRoute("/dsh-zeromem/panel.js", async (_req, res) => {
    const js = loadPanelJs();
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      ETag: PANEL_ETAG,
    });
    res.end(js);
  });

  addRoute("/dsh-zeromem/api/status", async (req, res) => {
    const qs = parseQuery(req.url);
    const skipProbe = qs.get("quick") === "1";
    const stats = engine.stats();
    const config = engine.getPublicConfig();
    const providerStatus = skipProbe
      ? { ok: true, provider: config.provider, state: "unchecked", model: config.provider === "ollama" ? config.ollamaModel : config.apiModel, message: "" }
      : await engine.probeProvider();
    sendJson(res, 200, {
      ok: true,
      version: cachedPkgVersion,
      stats,
      config,
      provider_status: providerStatus,
      activity: typeof engine.getActivitySnapshot === "function" ? engine.getActivitySnapshot() : { busy: false, count: 0, phase: "idle", label: "", since: 0 },
      setup: typeof engine.getLocalSetupState === "function" ? engine.getLocalSetupState() : { active: false, status: "idle" },
      runtime: engine.runtimeMetrics,
    });
  });

  addRoute("/dsh-zeromem/api/local-setup", async (req, res) => {
    const method = String(req.method || "GET").toUpperCase();
    if (method === "GET") {
      const probe = await engine.probeProvider({ provider: "ollama" });
      sendJson(res, 200, {
        ok: true,
        probe,
        setup: engine.getLocalSetupState(),
        recommended_models: engine.getRecommendedLocalModels(),
        install_guide: engine.getOllamaInstallGuide(),
      });
      return;
    }
    if (method === "POST") {
      const body = await readJsonBody(req);
      const action = String(body?.action || "").trim();
      if (action === "start-ollama") {
        const result = await engine.startLocalOllama();
        const probe = result.ok ? await engine.probeProvider({ provider: "ollama" }) : null;
        sendJson(res, result.ok ? 200 : 400, { ok: Boolean(result.ok), result, probe, setup: engine.getLocalSetupState() });
        return;
      }
      if (action === "pull-model") {
        const model = String(body?.model || "").trim();
        const result = engine.startLocalModelPull(model);
        sendJson(res, 200, { ok: true, ...result });
        return;
      }
      if (action === "cancel") {
        const result = engine.cancelLocalModelPull();
        sendJson(res, 200, { ok: true, ...result, setup: engine.getLocalSetupState() });
        return;
      }
      sendJson(res, 400, { ok: false, error: "Unsupported setup action" });
      return;
    }
    sendJson(res, 405, { ok: false, error: "GET or POST required" });
  });

  const sseClients = new Set();
  addRoute("/dsh-zeromem/api/events", async (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const writeEvent = (eventName, payload) => {
      try {
        res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
      } catch {
        cleanup();
      }
    };

    const unsub =
      typeof engine.onActivity === "function"
        ? engine.onActivity((payload) => writeEvent("activity", payload))
        : () => {};

    const hb = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch {
        cleanup();
      }
    }, 25_000);
    if (typeof hb.unref === "function") hb.unref();

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(hb);
      unsub();
      sseClients.delete(cleanup);
      try {
        res.end();
      } catch {
        // ignore
      }
    };
    sseClients.add(cleanup);
    if (typeof req.on === "function") {
      req.on("close", cleanup);
      req.on("aborted", cleanup);
    }
    if (typeof res.on === "function") {
      res.on("close", cleanup);
    }

    writeEvent("activity", {
      activity: typeof engine.getActivitySnapshot === "function" ? engine.getActivitySnapshot() : { busy: false, count: 0, phase: "idle", label: "", since: 0 },
      setup: typeof engine.getLocalSetupState === "function" ? engine.getLocalSetupState() : { active: false, status: "idle" },
      stats_dirty: false,
    });
  });
  disposers.push(() => {
    for (const c of [...sseClients]) c();
  });

  addRoute("/dsh-zeromem/api/background", async (req, res) => {
    const method = String(req.method || "GET").toUpperCase();
    if (method === "GET") {
      const bg = engine.readBackground();
      if (!bg) {
        res.writeHead(204, { "Cache-Control": "no-store" });
        res.end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": bg.contentType,
        "Content-Length": String(bg.buffer.length),
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(bg.buffer);
      return;
    }
    if (method === "POST") {
      const body = await readJsonBody(req, 8.5 * 1024 * 1024);
      const dataUrl = String(body?.dataUrl || "").trim();
      const m = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
      if (!m) {
        sendJson(res, 400, { ok: false, error: "无效的图片数据格式" });
        return;
      }
      const buf = Buffer.from(m[1].replace(/\s+/g, ""), "base64");
      try {
        const updated = engine.saveBackground(buf);
        sendJson(res, 200, { ok: true, config: updated });
      } catch (err) {
        sendJson(res, 400, { ok: false, error: String(err?.message || err) });
      }
      return;
    }
    if (method === "DELETE") {
      const updated = engine.clearBackground();
      sendJson(res, 200, { ok: true, config: updated });
      return;
    }
    sendJson(res, 405, { ok: false, error: "GET, POST or DELETE required" });
  });

  addRoute("/dsh-zeromem/api/memories", async (req, res) => {
    const qs = parseQuery(req.url);
    const q = qs.get("q") || "";
    const ns = qs.get("ns") || null;
    const limit = Math.max(1, Math.min(Number(qs.get("limit") || 50) || 50, 100));
    const t0 = Date.now();
    // Always disable adaptive pruning in the human workbench browse view so users see complete matches
    const items = engine.recall(q, { ns, limit, adaptive: false });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      elapsed_ms: Date.now() - t0,
      items,
    });
  });

  addRoute("/dsh-zeromem/api/document", async (req, res) => {
    const qs = parseQuery(req.url);
    const docId = String(qs.get("doc_id") || "").trim();
    if (!docId) {
      sendJson(res, 400, { ok: false, error: "doc_id is required" });
      return;
    }
    const doc = engine.getDocument(docId);
    if (!doc) {
      sendJson(res, 404, { ok: false, error: "document not found" });
      return;
    }
    sendJson(res, 200, { ok: true, document: doc });
  });

  addRoute("/dsh-zeromem/api/remember", async (req, res) => {
    if (String(req.method || "").toUpperCase() !== "POST") {
      sendJson(res, 405, { ok: false, error: "POST required" });
      return;
    }
    const body = await readJsonBody(req);
    const content = String(body?.content || "").trim();
    if (!content) {
      sendJson(res, 400, { ok: false, error: "请输入要记录的内容" });
      return;
    }
    const result = await engine.remember(content, {
      ns: body?.namespace ? String(body.namespace).trim() : null,
      sourceId: body?.source_id ? String(body.source_id).trim() : "dsh-web-workbench",
      verify: body?.verify !== undefined ? Boolean(body.verify) : null,
    });
    sendJson(res, 200, { ok: true, result });
  });

  addRoute("/dsh-zeromem/api/evict", async (req, res) => {
    if (String(req.method || "").toUpperCase() !== "POST") {
      sendJson(res, 405, { ok: false, error: "POST required" });
      return;
    }
    const body = await readJsonBody(req);
    const result = engine.softEvict({
      factIds: body?.fact_id !== undefined && body?.fact_id !== null ? [Number(body.fact_id)] : Array.isArray(body?.fact_ids) ? body.fact_ids : [],
      docIds: body?.doc_id ? [String(body.doc_id)] : Array.isArray(body?.doc_ids) ? body.doc_ids : [],
      expired: Boolean(body?.expired),
      namespace: body?.namespace ? String(body.namespace).trim() : null,
      reason: body?.reason ? String(body.reason) : "web-workbench",
      force: Boolean(body?.force),
    });
    sendJson(res, 200, { ok: true, result });
  });

  addRoute("/dsh-zeromem/api/evicted", async (req, res) => {
    const qs = parseQuery(req.url);
    const limit = Math.max(1, Math.min(Number(qs.get("limit") || 50) || 50, 200));
    const batches = engine.listEvictedBatches(limit);
    sendJson(res, 200, { ok: true, batches });
  });

  addRoute("/dsh-zeromem/api/restore", async (req, res) => {
    if (String(req.method || "").toUpperCase() !== "POST") {
      sendJson(res, 405, { ok: false, error: "POST required" });
      return;
    }
    const body = await readJsonBody(req);
    const batchId = String(body?.batch_id || "").trim();
    if (!batchId) {
      sendJson(res, 400, { ok: false, error: "batch_id is required" });
      return;
    }
    const result = engine.restoreEvicted(batchId);
    sendJson(res, 200, { ok: true, result });
  });

  addRoute("/dsh-zeromem/api/config", async (req, res) => {
    const method = String(req.method || "GET").toUpperCase();
    if (method === "GET") {
      sendJson(res, 200, { ok: true, config: engine.getPublicConfig() });
      return;
    }
    if (method === "POST") {
      const body = await readJsonBody(req);
      const updated = engine.updateConfig(body || {});
      sendJson(res, 200, { ok: true, config: updated });
      return;
    }
    sendJson(res, 405, { ok: false, error: "GET or POST required" });
  });

  addRoute("/dsh-zeromem/api/test-provider", async (req, res) => {
    if (String(req.method || "").toUpperCase() !== "POST") {
      sendJson(res, 405, { ok: false, error: "POST required" });
      return;
    }
    const body = await readJsonBody(req);
    const probe = await engine.probeProvider(body || {}, { liveChat: Boolean(body?.liveChat) });
    sendJson(res, 200, { ok: true, probe });
  });

  if (typeof ctx.webServer.tapIndex === "function") {
    const disposeTap = ctx.webServer.tapIndex((html) => {
      if (typeof html !== "string" || html.includes("/dsh-zeromem/panel.js")) return html;
      const tag = '<script defer src="/dsh-zeromem/panel.js"></script>';
      return html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
    });
    if (typeof disposeTap === "function") disposers.push(disposeTap);
  }

  return () => {
    for (const d of disposers) {
      try {
        d();
      } catch {
        // ignore
      }
    }
  };
}
