/**
 * Configuration management for @imliulian/dsh-zeromem.
 *
 * Supports dual LLM extraction/admission backends:
 *   1. Local Ollama (`provider: "ollama"`, default — Qwen3.5-4B-Memory-V2, zero cloud cost)
 *   2. OpenAI-compatible API (`provider: "openai-compatible"` — DeepSeek, OpenAI, SiliconFlow,
 *      OpenRouter, LM Studio, vLLM, or any `/v1/chat/completions` endpoint)
 *
 * Security invariants:
 *   - Config persisted locally at `~/.zeromem/dsh-zeromem.json` (0600 on POSIX).
 *   - `publicConfig()` NEVER returns plaintext `apiKey` (only `apiKeySet` + masked hint).
 *   - Database path defaults to `~/.zeromem/memory.db` (compatible with Python ZeroMem & legacy `~/.v2-memory/memory.db`).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
export const DEFAULT_API_BASE_URL = "https://api.deepseek.com/v1";
export const DEFAULT_API_MODEL = "deepseek-chat";
export const DEFAULT_NUM_CTX = 8192;
export const MAX_BACKGROUND_BYTES = 6 * 1024 * 1024;
export const CONFIG_SCHEMA_REV = "c9f48efa";

const SAFE_BG_FILE_RE = /^panel-bg\.(png|jpg|webp|gif|avif)$/;
const EXT_TO_MIME = Object.freeze({
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
});

export function detectSafeImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  // WebP: RIFF....WEBP
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  // GIF: GIF87a / GIF89a
  const gifSig = buf.toString("ascii", 0, 6);
  if (gifSig === "GIF87a" || gifSig === "GIF89a") {
    return { ext: "gif", mime: "image/gif" };
  }
  // AVIF: ....ftypavif / ....ftypavis
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") {
      return { ext: "avif", mime: "image/avif" };
    }
  }
  return null;
}

export function normalizeUiTheme(raw) {
  const low = String(raw || "").trim().toLowerCase();
  if (low === "dark") return "dark";
  return "light";
}

function sanitizeBgFileName(raw) {
  const s = String(raw || "").trim();
  return SAFE_BG_FILE_RE.test(s) ? s : "";
}

export const API_PRESETS = Object.freeze([
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  {
    id: "siliconflow",
    label: "SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "Qwen/Qwen2.5-7B-Instruct",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "deepseek/deepseek-chat",
  },
  {
    id: "custom",
    label: "自定义 API",
    baseUrl: "",
    model: "",
    isCustom: true,
  },
]);

export function defaultHomeDir(homeDir = os.homedir()) {
  const newDir = path.join(homeDir, ".zeromem");
  const legacyDir = path.join(homeDir, ".v2-memory");
  if (
    fs.existsSync(path.join(legacyDir, "memory.db")) &&
    !fs.existsSync(path.join(newDir, "memory.db"))
  ) {
    return legacyDir;
  }
  return newDir;
}

export function defaultDbPath(env = process.env, homeDir = os.homedir()) {
  const envPath = String(env.ZEROMEM_DB || env.V2MEM_DB || "").trim();
  if (envPath) return expandHome(envPath, homeDir);
  return path.join(defaultHomeDir(homeDir), "memory.db");
}

export function defaultConfigPath(env = process.env, homeDir = os.homedir()) {
  const explicit = String(env.ZEROMEM_DSH_CONFIG || "").trim();
  if (explicit) return expandHome(explicit, homeDir);
  return path.join(defaultHomeDir(homeDir), "dsh-zeromem.json");
}

export function expandHome(inputPath, homeDir = os.homedir()) {
  const raw = String(inputPath || "").trim();
  if (!raw) return "";
  if (raw === "~") return homeDir;
  if (raw.startsWith("~/") || raw.startsWith("~\\")) {
    return path.join(homeDir, raw.slice(2));
  }
  return path.resolve(raw);
}

export function maskSecret(secret) {
  const s = String(secret || "").trim();
  if (!s) return "";
  if (s.length <= 8) return "*".repeat(Math.max(4, s.length));
  return `${s.slice(0, 4)}***${s.slice(-4)}`;
}

function asBool(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const low = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(low)) return true;
    if (["0", "false", "no", "off"].includes(low)) return false;
  }
  return fallback;
}

function asPositiveInt(value, fallback, minVal, maxVal) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(minVal, Math.min(maxVal, Math.round(n)));
}

export function normalizeProvider(raw) {
  const low = String(raw || "").trim().toLowerCase();
  if (["api", "openai", "openai-compatible", "remote", "cloud"].includes(low)) {
    return "openai-compatible";
  }
  return "ollama";
}

export function normalizeNamespaceMode(raw) {
  const low = String(raw || "").trim().toLowerCase();
  if (low === "fixed" || low === "single") return "fixed";
  return "workspace";
}

export function buildDefaultConfig({ env = process.env, homeDir = os.homedir() } = {}) {
  return {
    provider: normalizeProvider(env.ZEROMEM_PROVIDER || "ollama"),
    dbPath: defaultDbPath(env, homeDir),
    ollamaUrl: String(env.ZEROMEM_OLLAMA_URL || env.V2MEM_OLLAMA_URL || DEFAULT_OLLAMA_URL).trim(),
    ollamaModel: String(env.ZEROMEM_MODEL || env.V2MEM_MODEL || "").trim(),
    numCtx: asPositiveInt(env.ZEROMEM_NUM_CTX || env.V2MEM_NUM_CTX, DEFAULT_NUM_CTX, 2048, 32768),
    apiBaseUrl: String(env.ZEROMEM_API_BASE_URL || DEFAULT_API_BASE_URL).trim(),
    apiKey: String(env.ZEROMEM_API_KEY || "").trim(),
    apiModel: String(env.ZEROMEM_API_MODEL || DEFAULT_API_MODEL).trim(),
    customApiBaseUrl: "",
    customApiModel: "",
    timeoutMs: asPositiveInt(Number(env.ZEROMEM_TIMEOUT || 90) * 1000, 90_000, 5_000, 300_000),
    verify: true,
    autoRecall: true,
    autoRemember: true,
    adaptive: true,
    untilExpiry: true,
    namespaceMode: "workspace",
    defaultNamespace: "default",
    recallMaxItems: 6,
    recallMinQueryChars: 4,
    rememberMinTurns: 1,
    uiTheme: normalizeUiTheme(env.ZEROMEM_UI_THEME || "light"),
    uiGlassBlur: 30,
    uiGlassTint: 60,
    uiBgFile: "",
    uiBgUpdatedAt: "",
  };
}

export function sanitizeConfigPatch(patch, base, { homeDir = os.homedir() } = {}) {
  const next = { ...base };
  if (!patch || typeof patch !== "object") return next;

  if (patch.provider !== undefined) next.provider = normalizeProvider(patch.provider);
  if (patch.dbPath !== undefined && String(patch.dbPath).trim()) {
    next.dbPath = expandHome(patch.dbPath, homeDir);
  }
  if (patch.ollamaUrl !== undefined) {
    const u = String(patch.ollamaUrl || "").trim().replace(/\/+$/, "");
    if (u) next.ollamaUrl = u;
  }
  if (patch.ollamaModel !== undefined) {
    next.ollamaModel = String(patch.ollamaModel || "").trim();
  }
  if (patch.numCtx !== undefined) {
    next.numCtx = asPositiveInt(patch.numCtx, next.numCtx, 2048, 32768);
  }
  if (patch.apiBaseUrl !== undefined) {
    const u = String(patch.apiBaseUrl || "").trim().replace(/\/+$/, "");
    if (u) next.apiBaseUrl = u;
  }
  if (patch.clearApiKey === true) {
    next.apiKey = "";
  } else if (typeof patch.apiKey === "string") {
    const trimmed = patch.apiKey.trim();
    // Ignore empty string so UI updates without retyping key keep existing key
    if (trimmed) next.apiKey = trimmed;
  }
  if (patch.apiModel !== undefined) {
    const m = String(patch.apiModel || "").trim();
    if (m) next.apiModel = m;
  }
  if (patch.customApiBaseUrl !== undefined) {
    next.customApiBaseUrl = String(patch.customApiBaseUrl || "").trim().replace(/\/+$/, "").slice(0, 300);
  }
  if (patch.customApiModel !== undefined) {
    next.customApiModel = String(patch.customApiModel || "").trim().slice(0, 160);
  }
  if (patch.timeoutMs !== undefined) {
    next.timeoutMs = asPositiveInt(patch.timeoutMs, next.timeoutMs, 5_000, 300_000);
  }
  if (patch.verify !== undefined) next.verify = asBool(patch.verify, next.verify);
  if (patch.autoRecall !== undefined) next.autoRecall = asBool(patch.autoRecall, next.autoRecall);
  if (patch.autoRemember !== undefined) next.autoRemember = asBool(patch.autoRemember, next.autoRemember);
  if (patch.adaptive !== undefined) next.adaptive = asBool(patch.adaptive, next.adaptive);
  if (patch.untilExpiry !== undefined) next.untilExpiry = asBool(patch.untilExpiry, next.untilExpiry);
  if (patch.namespaceMode !== undefined) next.namespaceMode = normalizeNamespaceMode(patch.namespaceMode);
  if (patch.defaultNamespace !== undefined) {
    const ns = String(patch.defaultNamespace || "").trim();
    if (ns) next.defaultNamespace = ns.slice(0, 80);
  }
  if (patch.recallMaxItems !== undefined) {
    next.recallMaxItems = asPositiveInt(patch.recallMaxItems, next.recallMaxItems, 1, 16);
  }
  if (patch.recallMinQueryChars !== undefined) {
    next.recallMinQueryChars = asPositiveInt(patch.recallMinQueryChars, next.recallMinQueryChars, 1, 64);
  }
  if (patch.rememberMinTurns !== undefined) {
    next.rememberMinTurns = asPositiveInt(patch.rememberMinTurns, next.rememberMinTurns, 1, 20);
  }
  if (patch.uiTheme !== undefined) {
    next.uiTheme = normalizeUiTheme(patch.uiTheme);
  }
  if (patch.uiGlassBlur !== undefined) {
    next.uiGlassBlur = asPositiveInt(patch.uiGlassBlur, next.uiGlassBlur, 0, 48);
  }
  if (patch.uiGlassTint !== undefined) {
    next.uiGlassTint = asPositiveInt(patch.uiGlassTint, next.uiGlassTint, 25, 95);
  }
  if (patch.uiBgFile !== undefined) {
    next.uiBgFile = sanitizeBgFileName(patch.uiBgFile);
  }
  if (patch.uiBgUpdatedAt !== undefined) {
    next.uiBgUpdatedAt = String(patch.uiBgUpdatedAt || "").trim().slice(0, 40);
  }

  return next;
}

export class ConfigManager {
  constructor({ configPath, initialOverrides = null, env = process.env, homeDir = os.homedir() } = {}) {
    this.env = env;
    this.homeDir = homeDir;
    this.configPath = configPath ? expandHome(configPath, homeDir) : defaultConfigPath(env, homeDir);
    this.initialOverrides = initialOverrides && typeof initialOverrides === "object" ? initialOverrides : null;
    this._config = this.reload();
  }

  reload() {
    let cfg = buildDefaultConfig({ env: this.env, homeDir: this.homeDir });
    if (this.initialOverrides) {
      cfg = sanitizeConfigPatch(this.initialOverrides, cfg, { homeDir: this.homeDir });
    }
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, "utf8");
        const parsed = JSON.parse(raw);
        cfg = sanitizeConfigPatch(parsed, cfg, { homeDir: this.homeDir });
      }
    } catch {
      // Fail-open: corrupted user JSON falls back cleanly to defaults
    }
    this._config = cfg;
    return cfg;
  }

  get() {
    return { ...this._config };
  }

  effectiveApiKey(cfg = this._config) {
    return (
      String(cfg.apiKey || "").trim() ||
      String(this.env.ZEROMEM_API_KEY || "").trim()
    );
  }

  backgroundPathFor(fileName = this._config?.uiBgFile) {
    const safe = sanitizeBgFileName(fileName);
    if (!safe) return "";
    return path.join(path.dirname(this.configPath), safe);
  }

  hasBackgroundFile() {
    const fp = this.backgroundPathFor();
    return Boolean(fp && fs.existsSync(fp));
  }

  readBackground() {
    const safe = sanitizeBgFileName(this._config?.uiBgFile);
    if (!safe) return null;
    const fp = path.join(path.dirname(this.configPath), safe);
    if (!fs.existsSync(fp)) return null;
    const ext = safe.split(".").pop();
    const contentType = EXT_TO_MIME[ext] || "application/octet-stream";
    return {
      buffer: fs.readFileSync(fp),
      contentType,
      updatedAt: this._config.uiBgUpdatedAt || "",
    };
  }

  saveBackground(buffer) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      throw new Error("背景图片为空");
    }
    if (buffer.length > MAX_BACKGROUND_BYTES) {
      throw new Error("图片超过 6 MB 限制，请压缩后重试");
    }
    const detected = detectSafeImageType(buffer);
    if (!detected) {
      throw new Error("仅支持 PNG / JPG / WebP / GIF / AVIF 图片");
    }
    const dir = path.dirname(this.configPath);
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `panel-bg.${detected.ext}`;
    const targetPath = path.join(dir, fileName);
    const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpPath, buffer, { mode: 0o600 });
    fs.renameSync(tmpPath, targetPath);

    // Clean up any previous background file with another extension
    for (const ext of Object.keys(EXT_TO_MIME)) {
      if (ext === detected.ext) continue;
      const oldPath = path.join(dir, `panel-bg.${ext}`);
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch {
        // ignore
      }
    }

    const updatedAt = String(Date.now());
    return this.update({ uiBgFile: fileName, uiBgUpdatedAt: updatedAt });
  }

  clearBackground() {
    const dir = path.dirname(this.configPath);
    for (const ext of Object.keys(EXT_TO_MIME)) {
      const oldPath = path.join(dir, `panel-bg.${ext}`);
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch {
        // ignore
      }
    }
    return this.update({ uiBgFile: "", uiBgUpdatedAt: "" });
  }

  publicConfig() {
    const cfg = this._config;
    const key = this.effectiveApiKey(cfg);
    const keyFromEnv = !cfg.apiKey && Boolean(String(this.env.ZEROMEM_API_KEY || "").trim());
    const hasBg = this.hasBackgroundFile();
    const bgVer = cfg.uiBgUpdatedAt || "1";
    return {
      provider: cfg.provider,
      dbPath: cfg.dbPath,
      configPath: this.configPath,
      ollamaUrl: cfg.ollamaUrl,
      ollamaModel: cfg.ollamaModel,
      numCtx: cfg.numCtx,
      apiBaseUrl: cfg.apiBaseUrl,
      apiModel: cfg.apiModel,
      customApiBaseUrl: cfg.customApiBaseUrl || "",
      customApiModel: cfg.customApiModel || "",
      apiKeySet: Boolean(key),
      apiKeyMasked: key ? maskSecret(key) : "",
      apiKeySource: cfg.apiKey ? "config" : keyFromEnv ? "env" : "none",
      timeoutMs: cfg.timeoutMs,
      verify: cfg.verify,
      autoRecall: cfg.autoRecall,
      autoRemember: cfg.autoRemember,
      adaptive: cfg.adaptive,
      untilExpiry: cfg.untilExpiry,
      namespaceMode: cfg.namespaceMode,
      defaultNamespace: cfg.defaultNamespace,
      recallMaxItems: cfg.recallMaxItems,
      recallMinQueryChars: cfg.recallMinQueryChars,
      rememberMinTurns: cfg.rememberMinTurns,
      uiTheme: cfg.uiTheme || "light",
      uiGlassBlur: cfg.uiGlassBlur ?? 30,
      uiGlassTint: cfg.uiGlassTint ?? 60,
      uiHasBackground: hasBg,
      uiBackgroundUrl: hasBg ? `/dsh-zeromem/api/background?v=${encodeURIComponent(bgVer)}` : "",
      presets: API_PRESETS,
    };
  }

  update(patch) {
    const next = sanitizeConfigPatch(patch, this._config, { homeDir: this.homeDir });
    const dir = path.dirname(this.configPath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.configPath}.tmp.${process.pid}.${Date.now()}`;
    const serialized = `${JSON.stringify({ configRev: CONFIG_SCHEMA_REV, ...next }, null, 2)}\n`;
    fs.writeFileSync(tmp, serialized, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tmp, this.configPath);
    try {
      fs.chmodSync(this.configPath, 0o600);
    } catch {
      // Windows does not enforce POSIX chmod bits
    }
    this._config = next;
    return this.publicConfig();
  }
}
