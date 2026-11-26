/**
 * Dual-backend LLM client for ZeroMem DSH plugin:
 *   1. Local Ollama (`provider: "ollama"`) — direct node:http/https loopback requests
 *      (bypasses system proxy cleanly on Windows/macOS), auto-detects Qwen3.5-4B-Memory-V2,
 *      enforces deterministic anti-OTL parameters.
 *   2. OpenAI-compatible API (`provider: "openai-compatible"`) — standard `/chat/completions`
 *      supporting DeepSeek, OpenAI, SiliconFlow, OpenRouter, LM Studio, vLLM, etc.
 */

import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { DEFAULT_API_BASE_URL, DEFAULT_API_MODEL, DEFAULT_NUM_CTX, DEFAULT_OLLAMA_URL } from "./config.mjs";

export const HF_REPO_ID = "IMLIULIAN/qwen3.5-4b-memory-v2";
export const SAFE_OLLAMA_MODEL_RE = /^[a-zA-Z0-9._:/-]{2,140}$/;

export const RECOMMENDED_LOCAL_PULL_MODELS = Object.freeze([
  {
    id: `hf.co/${HF_REPO_ID}:Q8_0`,
    shortLabel: "V2 标准版",
    sizeHint: "4.5 GB · 推荐",
    recommended: true,
  },
  {
    id: `hf.co/${HF_REPO_ID}:Q4_K_M`,
    shortLabel: "V2 轻量版",
    sizeHint: "2.7 GB · 低显存",
    recommended: false,
  },
]);

export function getOllamaInstallGuide(platform = process.platform) {
  if (platform === "win32") {
    return {
      platform: "win32",
      command: "winget install Ollama.Ollama",
      downloadUrl: "https://ollama.com/download/windows",
    };
  }
  if (platform === "darwin") {
    return {
      platform: "darwin",
      command: "brew install --cask ollama",
      downloadUrl: "https://ollama.com/download/mac",
    };
  }
  return {
    platform,
    command: "curl -fsSL https://ollama.com/install.sh | sh",
    downloadUrl: "https://ollama.com/download/linux",
  };
}

function execFileVersion(binPath) {
  return new Promise((resolve) => {
    try {
      execFile(binPath, ["--version"], { timeout: 2500, windowsHide: true }, (err, stdout, stderr) => {
        if (err) {
          resolve(null);
          return;
        }
        const out = String(stdout || stderr || "").trim();
        resolve({ binPath, version: out.slice(0, 80) });
      });
    } catch {
      resolve(null);
    }
  });
}

export async function detectOllamaBinary({ env = process.env, platform = process.platform } = {}) {
  const candidates = ["ollama"];
  if (platform === "win32") {
    const localApp = env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const winBin = path.join(localApp, "Programs", "Ollama", "ollama.exe");
    if (fs.existsSync(winBin)) candidates.push(winBin);
  } else if (platform === "darwin") {
    for (const p of [
      "/opt/homebrew/bin/ollama",
      "/usr/local/bin/ollama",
      "/Applications/Ollama.app/Contents/Resources/ollama",
    ]) {
      if (fs.existsSync(p)) candidates.push(p);
    }
  } else {
    for (const p of ["/usr/local/bin/ollama", "/usr/bin/ollama"]) {
      if (fs.existsSync(p)) candidates.push(p);
    }
  }

  for (const cand of candidates) {
    const found = await execFileVersion(cand);
    if (found) return { installed: true, binPath: found.binPath, version: found.version };
  }
  return { installed: false, binPath: "", version: "" };
}

export async function startLocalOllamaService({ baseUrl = DEFAULT_OLLAMA_URL, waitMs = 10_000 } = {}) {
  const cleanUrl = String(baseUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    throw new Error("无效的 Ollama 地址");
  }
  if (!isLoopbackHost(parsed.hostname)) {
    throw new Error("仅支持一键启动本机回环 Ollama 服务");
  }

  // Already running?
  try {
    const alive = await directHttpJson(`${cleanUrl}/api/tags`, { method: "GET", timeoutMs: 2500 });
    if (alive.ok) return { ok: true, alreadyRunning: true, message: "本地 Ollama 已在运行" };
  } catch {
    // not running yet
  }

  const bin = await detectOllamaBinary();
  if (!bin.installed) {
    return {
      ok: false,
      state: "ollama_not_installed",
      install_guide: getOllamaInstallGuide(),
      message: "未检测到本机 Ollama，请先安装或切换云端 API",
    };
  }

  const child = spawn(bin.binPath, ["serve"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();

  const deadline = Date.now() + Math.max(2000, waitMs);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 450));
    try {
      const alive = await directHttpJson(`${cleanUrl}/api/tags`, { method: "GET", timeoutMs: 2000 });
      if (alive.ok) return { ok: true, started: true, message: "本地 Ollama 已后台启动" };
    } catch {
      // keep polling until ready
    }
  }
  return { ok: false, state: "start_timeout", message: "Ollama 启动超时，请手动确认服务状态" };
}

export function pullOllamaModel({
  baseUrl = DEFAULT_OLLAMA_URL,
  model = RECOMMENDED_LOCAL_PULL_MODELS[0].id,
  onProgress = null,
  signal = null,
} = {}) {
  const targetModel = String(model || RECOMMENDED_LOCAL_PULL_MODELS[0].id).trim();
  if (!SAFE_OLLAMA_MODEL_RE.test(targetModel)) {
    return Promise.reject(new Error("无效的 Ollama 模型名"));
  }
  const cleanUrl = String(baseUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(`${cleanUrl}/api/pull`);
  } catch {
    return Promise.reject(new Error("无效的 Ollama 地址"));
  }

  return new Promise((resolve, reject) => {
    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;
    const payloadBuf = Buffer.from(JSON.stringify({ name: targetModel, stream: true }), "utf8");
    let settled = false;
    const finishOk = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    const finishErr = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(payloadBuf.length),
        },
      },
      (res) => {
        if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
          const errChunks = [];
          res.on("data", (c) => errChunks.push(c));
          res.on("end", () => {
            const raw = Buffer.concat(errChunks).toString("utf8").slice(0, 220);
            finishErr(new Error(`Ollama /api/pull HTTP ${res.statusCode}: ${raw}`));
          });
          return;
        }

        let buf = "";
        let lastStatus = "pulling";
        const processLine = (line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          let obj;
          try {
            obj = JSON.parse(trimmed);
          } catch {
            return;
          }
          if (obj.error) {
            finishErr(new Error(String(obj.error)));
            req.destroy();
            return;
          }
          const status = String(obj.status || lastStatus);
          lastStatus = status;
          const total = Number(obj.total || 0);
          const completed = Number(obj.completed || 0);
          const percent =
            status === "success"
              ? 100
              : total > 0
                ? Math.max(0, Math.min(99, Math.round((completed / total) * 100)))
                : null;
          if (typeof onProgress === "function") {
            onProgress({ status, model: targetModel, completed, total, percent });
          }
        };

        res.on("data", (chunk) => {
          buf += chunk.toString("utf8");
          let idx = buf.indexOf("\n");
          while (idx !== -1) {
            const line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            processLine(line);
            idx = buf.indexOf("\n");
          }
        });
        res.on("end", () => {
          if (buf.trim()) processLine(buf);
          finishOk({ ok: true, model: targetModel, status: lastStatus });
        });
        res.on("error", (err) => finishErr(err));
      }
    );

    if (signal) {
      if (signal.aborted) {
        req.destroy(new Error("已取消下载"));
        finishErr(new Error("已取消下载"));
        return;
      }
      signal.addEventListener(
        "abort",
        () => {
          req.destroy(new Error("已取消下载"));
          finishErr(new Error("已取消下载"));
        },
        { once: true }
      );
    }

    req.on("error", (err) => finishErr(err));
    req.write(payloadBuf);
    req.end();
  });
}

export const PREFERRED_LOCAL_MODELS = Object.freeze([
  "imliulian/qwen3.5-4b-memory:v2",
  "imliulian/qwen3.5-4b-memory:v2-q8_0",
  "qwen3.5:4b-memory-v2",
  `hf.co/${HF_REPO_ID}:Q8_0`,
  `hf.co/${HF_REPO_ID}:q8_0`,
  "imliulian/qwen3.5-4b-memory:v2-q4_k_m",
  "qwen3.5:4b-memory-v2-q4",
  `hf.co/${HF_REPO_ID}:Q4_K_M`,
  `hf.co/${HF_REPO_ID}:q4_k_m`,
]);

export function isV2ModelName(name) {
  const low = String(name || "").toLowerCase();
  return low.includes("memory-v2") || low.includes("qwen3.5-4b-memory:v2");
}

function isLoopbackHost(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "::1" || h.startsWith("127.");
}

/**
 * Direct HTTP JSON request via node:http / node:https (never routes loopback through system proxy).
 */
function directHttpJson(urlStr, { method = "GET", headers = {}, body = null, timeoutMs = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch (err) {
      reject(new Error(`Invalid URL: ${urlStr}`));
      return;
    }

    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;
    const payloadBuf = body !== null && body !== undefined ? Buffer.from(JSON.stringify(body), "utf8") : null;
    const reqHeaders = { ...headers };
    if (payloadBuf) {
      reqHeaders["content-type"] = "application/json";
      reqHeaders["content-length"] = String(payloadBuf.length);
    }

    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: reqHeaders,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
          }
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode || 0,
            json,
            text: raw,
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
    });
    req.on("error", (err) => reject(err));

    if (payloadBuf) req.write(payloadBuf);
    req.end();
  });
}

async function httpJson(urlStr, { method = "GET", headers = {}, body = null, timeoutMs = 30_000 } = {}) {
  const parsed = new URL(urlStr);
  // Always use direct node:http/https for loopback to avoid Windows/macOS HTTP_PROXY interception
  if (isLoopbackHost(parsed.hostname)) {
    return directHttpJson(urlStr, { method, headers, body, timeoutMs });
  }
  const init = {
    method,
    headers: {
      ...(body !== null && body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body !== null && body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(urlStr, init);
  const raw = await res.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text: raw };
}

export class OllamaAdapter {
  constructor({ baseUrl = DEFAULT_OLLAMA_URL, model = "", numCtx = DEFAULT_NUM_CTX, timeoutMs = 90_000 } = {}) {
    this.baseUrl = String(baseUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
    this.explicitModel = String(model || "").trim();
    this.resolvedModel = this.explicitModel || "";
    this.numCtx = Number(numCtx) || DEFAULT_NUM_CTX;
    this.timeoutMs = Number(timeoutMs) || 90_000;
  }

  async listModels() {
    const res = await httpJson(`${this.baseUrl}/api/tags`, {
      method: "GET",
      timeoutMs: Math.min(this.timeoutMs, 8_000),
    });
    if (!res.ok) throw new Error(`Ollama /api/tags HTTP ${res.status}: ${res.text.slice(0, 160)}`);
    const models = Array.isArray(res.json?.models) ? res.json.models : [];
    return models.map((m) => String(m?.name || "")).filter(Boolean);
  }

  async listRunningModels() {
    try {
      const res = await httpJson(`${this.baseUrl}/api/ps`, {
        method: "GET",
        timeoutMs: Math.min(this.timeoutMs, 5_000),
      });
      if (!res.ok) return [];
      const models = Array.isArray(res.json?.models) ? res.json.models : [];
      return models.map((m) => String(m?.name || "")).filter(Boolean);
    } catch {
      return [];
    }
  }

  async resolveModel() {
    if (this.resolvedModel) return this.resolvedModel;

    const running = await this.listRunningModels();
    for (const r of running) {
      if (isV2ModelName(r)) {
        this.resolvedModel = r;
        return r;
      }
    }

    const available = await this.listModels();
    const availSet = new Set(available);
    for (const cand of PREFERRED_LOCAL_MODELS) {
      if (availSet.has(cand)) {
        this.resolvedModel = cand;
        return cand;
      }
    }
    for (const name of available) {
      if (isV2ModelName(name)) {
        this.resolvedModel = name;
        return name;
      }
    }

    throw new Error(
      "本地 Ollama 未检测到 Qwen3.5-4B-Memory-V2 模型。请运行 `ollama pull hf.co/IMLIULIAN/qwen3.5-4b-memory-v2:Q8_0`，或在设置中指定已有模型 / 切换为 API 模式。"
    );
  }

  async chatJson(systemPrompt, userPayload, { numPredict = 1024, retries = 1, responseFormat = null } = {}) {
    const model = await this.resolveModel();
    const payload = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      stream: false,
      think: false,
      options: {
        num_ctx: this.numCtx,
        num_predict: Number(numPredict) || 1024,
        temperature: 0.0,
        top_k: 20,
        top_p: 0.95,
        presence_penalty: 0.0,
        repeat_penalty: 1.08,
      },
    };
    if (responseFormat && (typeof responseFormat === "object" || typeof responseFormat === "string")) {
      payload.format = responseFormat;
    }

    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const t0 = Date.now();
      try {
        const res = await httpJson(`${this.baseUrl}/api/chat`, {
          method: "POST",
          body: payload,
          timeoutMs: this.timeoutMs,
        });
        if (!res.ok) {
          throw new Error(`Ollama /api/chat HTTP ${res.status}: ${res.text.slice(0, 200)}`);
        }
        const content = String(res.json?.message?.content || "").trim();
        return {
          content,
          meta: {
            provider: "ollama",
            model,
            elapsed_ms: Date.now() - t0,
            done_reason: res.json?.done_reason ?? null,
          },
        };
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }
    throw new Error(`Ollama 调用失败 (${model}): ${lastErr?.message || lastErr}`);
  }

  async probe() {
    const t0 = Date.now();
    try {
      const [available, running] = await Promise.all([this.listModels(), this.listRunningModels()]);
      const elapsedMs = Date.now() - t0;
      const target = this.explicitModel || "";
      const runningMatch = target
        ? running.find((m) => m === target)
        : running.find((m) => isV2ModelName(m));
      if (runningMatch) {
        return {
          ok: true,
          provider: "ollama",
          state: "resident",
          model: runningMatch,
          elapsed_ms: elapsedMs,
          available_models: available.slice(0, 40),
          running_models: running,
          message: `本地常驻：${runningMatch}`,
        };
      }
      const installedMatch = target
        ? available.find((m) => m === target)
        : PREFERRED_LOCAL_MODELS.find((cand) => available.includes(cand)) ||
          available.find((m) => isV2ModelName(m));
      if (installedMatch) {
        return {
          ok: true,
          provider: "ollama",
          state: "ready",
          model: installedMatch,
          elapsed_ms: elapsedMs,
          available_models: available.slice(0, 40),
          running_models: running,
          message: `本地已就绪：${installedMatch}`,
        };
      }
      return {
        ok: false,
        provider: "ollama",
        state: "missing_model",
        model: target || "qwen3.5:4b-memory-v2",
        elapsed_ms: elapsedMs,
        available_models: available.slice(0, 40),
        running_models: running,
        ollama_installed: true,
        can_pull: true,
        recommended_models: RECOMMENDED_LOCAL_PULL_MODELS,
        message: target
          ? `Ollama 已连接，未找到模型 ${target}，可一键拉取`
          : "Ollama 已就绪，尚未下载零忆 V2 模型，可一键拉取",
      };
    } catch (err) {
      let parsedHost = "";
      try {
        parsedHost = new URL(this.baseUrl).hostname;
      } catch {
        // ignore
      }
      if (isLoopbackHost(parsedHost)) {
        const bin = await detectOllamaBinary();
        if (bin.installed) {
          return {
            ok: false,
            provider: "ollama",
            state: "ollama_stopped",
            model: this.explicitModel || "",
            elapsed_ms: Date.now() - t0,
            available_models: [],
            running_models: [],
            ollama_installed: true,
            ollama_version: bin.version,
            can_start_ollama: true,
            recommended_models: RECOMMENDED_LOCAL_PULL_MODELS,
            message: "已安装 Ollama（未启动），可一键后台启动",
          };
        }
        return {
          ok: false,
          provider: "ollama",
          state: "ollama_not_installed",
          model: this.explicitModel || "",
          elapsed_ms: Date.now() - t0,
          available_models: [],
          running_models: [],
          ollama_installed: false,
          can_start_ollama: false,
          install_guide: getOllamaInstallGuide(),
          recommended_models: RECOMMENDED_LOCAL_PULL_MODELS,
          message: "未检测到本机 Ollama，可安装后一键拉取模型或改用云端 API",
        };
      }
      return {
        ok: false,
        provider: "ollama",
        state: "offline",
        model: this.explicitModel || "",
        elapsed_ms: Date.now() - t0,
        available_models: [],
        running_models: [],
        message: `无法连接 Ollama (${this.baseUrl}): ${err?.message || err}`,
      };
    }
  }
}

export class OpenAICompatibleAdapter {
  constructor({
    baseUrl = DEFAULT_API_BASE_URL,
    apiKey = "",
    model = DEFAULT_API_MODEL,
    timeoutMs = 90_000,
  } = {}) {
    this.baseUrl = String(baseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
    this.apiKey = String(apiKey || "").trim();
    this.model = String(model || DEFAULT_API_MODEL).trim() || DEFAULT_API_MODEL;
    this.timeoutMs = Number(timeoutMs) || 90_000;
  }

  _authHeaders() {
    const headers = {};
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  _completionsUrl() {
    if (this.baseUrl.endsWith("/chat/completions")) return this.baseUrl;
    return `${this.baseUrl}/chat/completions`;
  }

  _modelsUrl() {
    if (this.baseUrl.endsWith("/chat/completions")) {
      return this.baseUrl.replace(/\/chat\/completions$/, "/models");
    }
    return `${this.baseUrl}/models`;
  }

  async chatJson(systemPrompt, userPayload, { numPredict = 1024, retries = 1, responseFormat = null } = {}) {
    void responseFormat;
    const url = this._completionsUrl();
    const isLocal = isLoopbackHost(new URL(url).hostname);
    if (!this.apiKey && !isLocal) {
      throw new Error("未配置 API Key，请在 ZeroMem 设置中填写 API Key（或设置环境变量 ZEROMEM_API_KEY）。");
    }

    const buildBody = (withResponseFormat) => {
      const body = {
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        temperature: 0.0,
        max_tokens: Number(numPredict) || 1024,
        stream: false,
      };
      if (withResponseFormat) {
        body.response_format = { type: "json_object" };
      }
      return body;
    };

    let useJsonFormat = true;
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const t0 = Date.now();
      try {
        const res = await httpJson(url, {
          method: "POST",
          headers: this._authHeaders(),
          body: buildBody(useJsonFormat),
          timeoutMs: this.timeoutMs,
        });
        if (!res.ok) {
          // Some OpenAI-compatible gateways reject response_format; retry once without it
          if (useJsonFormat && res.status === 400 && /response_format/i.test(res.text)) {
            useJsonFormat = false;
            continue;
          }
          const detail = res.json?.error?.message || res.text.slice(0, 200);
          throw new Error(`API HTTP ${res.status}: ${detail}`);
        }
        const msg = res.json?.choices?.[0]?.message;
        const content =
          typeof msg?.content === "string"
            ? msg.content.trim()
            : Array.isArray(msg?.content)
              ? msg.content.map((b) => b?.text || "").join("").trim()
              : "";
        return {
          content,
          meta: {
            provider: "openai-compatible",
            model: String(res.json?.model || this.model),
            elapsed_ms: Date.now() - t0,
            finish_reason: res.json?.choices?.[0]?.finish_reason ?? null,
          },
        };
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }
    throw new Error(`API 调用失败 (${this.model}): ${lastErr?.message || lastErr}`);
  }

  async probe({ liveChat = false } = {}) {
    const t0 = Date.now();
    let parsedUrl;
    try {
      parsedUrl = new URL(this._completionsUrl());
    } catch {
      return {
        ok: false,
        provider: "openai-compatible",
        state: "invalid_config",
        model: this.model,
        elapsed_ms: 0,
        message: `无效的 API Base URL: ${this.baseUrl}`,
      };
    }

    const isLocal = isLoopbackHost(parsedUrl.hostname);
    if (!this.apiKey && !isLocal) {
      return {
        ok: false,
        provider: "openai-compatible",
        state: "missing_key",
        model: this.model,
        elapsed_ms: 0,
        message: "尚未配置 API Key（可在设置页填入，密钥仅存本地）",
      };
    }

    if (!liveChat) {
      try {
        const res = await httpJson(this._modelsUrl(), {
          method: "GET",
          headers: this._authHeaders(),
          timeoutMs: Math.min(this.timeoutMs, 10_000),
        });
        if (res.ok) {
          const list = Array.isArray(res.json?.data)
            ? res.json.data.map((m) => String(m?.id || "")).filter(Boolean).slice(0, 40)
            : [];
          return {
            ok: true,
            provider: "openai-compatible",
            state: "ready",
            model: this.model,
            elapsed_ms: Date.now() - t0,
            available_models: list,
            message: `API 已连通（${this.model}）`,
          };
        }
        if (res.status === 401 || res.status === 403) {
          return {
            ok: false,
            provider: "openai-compatible",
            state: "auth_error",
            model: this.model,
            elapsed_ms: Date.now() - t0,
            message: `API 鉴权失败 (HTTP ${res.status})`,
          };
        }
      } catch {
        // Fall through to minimal chat probe if /models isn't supported
      }
    }

    try {
      const res = await this.chatJson(
        'Return strictly valid JSON: {"ok":true}',
        { ping: 1 },
        { numPredict: 32, retries: 0 }
      );
      return {
        ok: true,
        provider: "openai-compatible",
        state: "ready",
        model: res.meta.model || this.model,
        elapsed_ms: Date.now() - t0,
        message: `API 实测连通（${res.meta.model || this.model}，${Date.now() - t0}ms）`,
      };
    } catch (err) {
      return {
        ok: false,
        provider: "openai-compatible",
        state: "offline",
        model: this.model,
        elapsed_ms: Date.now() - t0,
        message: String(err?.message || err),
      };
    }
  }
}

export function createLlmAdapter(cfg, { apiKey = "" } = {}) {
  if (cfg.provider === "openai-compatible") {
    return new OpenAICompatibleAdapter({
      baseUrl: cfg.apiBaseUrl,
      apiKey: apiKey || cfg.apiKey,
      model: cfg.apiModel,
      timeoutMs: cfg.timeoutMs,
    });
  }
  return new OllamaAdapter({
    baseUrl: cfg.ollamaUrl,
    model: cfg.ollamaModel,
    numCtx: cfg.numCtx,
    timeoutMs: cfg.timeoutMs,
  });
}
