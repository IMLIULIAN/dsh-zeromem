/**
 * High-level ZeroMem engine for DeepSeek Harness.
 *
 * Bridges:
 * - ConfigManager (live-reloadable Local Ollama <-> OpenAI-compatible API switch)
 * - SQLiteMemoryStore (node:sqlite single-file DB, 100% compatible with Python ZeroMem)
 * - V2 dual-contract extraction + 1-round admission + deterministic guard + pre-API redaction
 */

import { createHash } from "node:crypto";
import {
  FACT_ADMISSION_SUPERSEDE_ADDENDUM,
  FACT_ADMISSION_SYSTEM,
  FACT_EXTRACTION_SYSTEM,
  VALID_DECISIONS,
  buildAdmissionSupersedeSchema,
  buildSegments,
  guardFact,
  inferGroundedOccurredStart,
  parseJsonObject,
  segmentToPayload,
  windowSegments,
} from "./contracts.mjs";
import { ConfigManager } from "./config.mjs";
import { ADAPTIVE_MIN_LIMIT, ADAPTIVE_SCORE_RATIO } from "./expiry.mjs";
import {
  RECOMMENDED_LOCAL_PULL_MODELS,
  createLlmAdapter,
  getOllamaInstallGuide,
  pullOllamaModel,
  startLocalOllamaService,
} from "./llm.mjs";
import { backupDatabase, exportMarkdown } from "./portability.mjs";
import { SQLiteMemoryStore } from "./store.mjs";

function utcNowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export class ZeroMemEngine {
  constructor({ configManager = null, configOptions = {}, llmFactory = createLlmAdapter } = {}) {
    this.configManager = configManager || new ConfigManager(configOptions);
    this.llmFactory = llmFactory;
    this._store = null;
    this._storePath = "";
    this._taskSeq = 0;
    this._activeTasks = new Map();
    this._activityListeners = new Set();
    this._pulse = null;
    this._pulseTimer = null;
    this._setupState = {
      active: false,
      action: "",
      model: "",
      status: "idle",
      completed: 0,
      total: 0,
      percent: null,
      error: "",
      startedAt: 0,
    };
    this._pullAbort = null;
    this.runtimeMetrics = {
      startedAt: utcNowIso(),
      autoRecalls: 0,
      autoRemembers: 0,
      autoRememberErrors: 0,
      lastError: "",
      lastRememberAt: "",
    };
  }

  _emitActivity(extra = {}) {
    if (!this._activityListeners.size) return;
    const payload = {
      activity: this.getActivitySnapshot(),
      setup: this.getLocalSetupState(),
      stats_dirty: Boolean(extra.statsDirty),
    };
    for (const fn of [...this._activityListeners]) {
      try {
        fn(payload);
      } catch {
        // fail-open
      }
    }
  }

  getLocalSetupState() {
    return { ...this._setupState };
  }

  async startLocalOllama() {
    if (this._setupState.active) {
      return { ok: false, error: "当前已有安装或启动任务进行中" };
    }
    const cfg = this.getConfig();
    const task = this.beginActivity("setup", "启动 Ollama");
    this._setupState = {
      active: true,
      action: "start-ollama",
      model: "",
      status: "starting",
      completed: 0,
      total: 0,
      percent: null,
      error: "",
      startedAt: Date.now(),
    };
    this._emitActivity();
    try {
      const res = await startLocalOllamaService({ baseUrl: cfg.ollamaUrl });
      this._setupState = {
        ...this._setupState,
        active: false,
        status: res.ok ? "done" : "error",
        error: res.ok ? "" : String(res.message || "启动失败"),
      };
      return res;
    } catch (err) {
      const msg = String(err?.message || err);
      this._setupState = { ...this._setupState, active: false, status: "error", error: msg };
      return { ok: false, message: msg };
    } finally {
      task.end({ statsDirty: true });
    }
  }

  startLocalModelPull(requestedModel = "") {
    if (this._setupState.active) {
      return { ok: true, alreadyActive: true, setup: this.getLocalSetupState() };
    }
    const cfg = this.getConfig();
    const model = String(requestedModel || RECOMMENDED_LOCAL_PULL_MODELS[0].id).trim();
    const abortCtrl = new AbortController();
    this._pullAbort = abortCtrl;
    const task = this.beginActivity("pull", "下载模型");
    this._setupState = {
      active: true,
      action: "pull-model",
      model,
      status: "connecting",
      completed: 0,
      total: 0,
      percent: 0,
      error: "",
      startedAt: Date.now(),
    };
    this._emitActivity();

    let lastBroadcastAt = 0;
    void pullOllamaModel({
      baseUrl: cfg.ollamaUrl,
      model,
      signal: abortCtrl.signal,
      onProgress: (p) => {
        this._setupState = {
          ...this._setupState,
          status: p.status || "pulling",
          completed: p.completed || 0,
          total: p.total || 0,
          percent: p.percent,
        };
        const now = Date.now();
        if (now - lastBroadcastAt >= 250 || p.percent === 100) {
          lastBroadcastAt = now;
          const label = Number.isFinite(p.percent) && p.percent > 0 ? `下载 ${p.percent}%` : "下载模型";
          task.update("pull", label);
        }
      },
    })
      .then(() => {
        this._setupState = {
          ...this._setupState,
          active: false,
          status: "success",
          percent: 100,
          error: "",
        };
        if (this.getConfig().provider !== "ollama") {
          this.updateConfig({ provider: "ollama" });
        }
      })
      .catch((err) => {
        const cancelled = abortCtrl.signal.aborted;
        this._setupState = {
          ...this._setupState,
          active: false,
          status: cancelled ? "cancelled" : "error",
          error: cancelled ? "已取消下载" : String(err?.message || err),
        };
      })
      .finally(() => {
        if (this._pullAbort === abortCtrl) this._pullAbort = null;
        task.end({ statsDirty: true });
      });

    return { ok: true, started: true, setup: this.getLocalSetupState() };
  }

  cancelLocalModelPull() {
    if (this._pullAbort) {
      this._pullAbort.abort();
      return { ok: true, cancelled: true };
    }
    return { ok: true, cancelled: false };
  }

  getRecommendedLocalModels() {
    return RECOMMENDED_LOCAL_PULL_MODELS;
  }

  getOllamaInstallGuide() {
    return getOllamaInstallGuide();
  }

  onActivity(fn) {
    if (typeof fn !== "function") return () => {};
    this._activityListeners.add(fn);
    return () => {
      this._activityListeners.delete(fn);
    };
  }

  getActivitySnapshot() {
    const now = Date.now();
    if (this._activeTasks.size > 0) {
      let oldest = Infinity;
      let latest = null;
      for (const t of this._activeTasks.values()) {
        if (t.startedAt < oldest) oldest = t.startedAt;
        latest = t;
      }
      return {
        busy: true,
        count: this._activeTasks.size,
        phase: latest?.phase || "working",
        label: latest?.label || "处理中",
        since: Number.isFinite(oldest) ? oldest : now,
      };
    }
    if (this._pulse && this._pulse.until > now) {
      return {
        busy: true,
        count: 1,
        phase: this._pulse.phase,
        label: this._pulse.label,
        since: this._pulse.since,
      };
    }
    return {
      busy: false,
      count: 0,
      phase: "idle",
      label: "",
      since: 0,
    };
  }

  beginActivity(phase = "working", label = "处理中") {
    const id = ++this._taskSeq;
    const entry = { phase: String(phase || "working"), label: String(label || "处理中"), startedAt: Date.now() };
    this._activeTasks.set(id, entry);
    this._emitActivity();
    let ended = false;
    return {
      update: (nextPhase, nextLabel) => {
        if (ended) return;
        const cur = this._activeTasks.get(id);
        if (!cur) return;
        cur.phase = String(nextPhase || cur.phase);
        cur.label = String(nextLabel || cur.label);
        this._emitActivity();
      },
      end: ({ statsDirty = false } = {}) => {
        if (ended) return;
        ended = true;
        this._activeTasks.delete(id);
        this._emitActivity({ statsDirty });
      },
    };
  }

  pulseActivity(phase = "recall", label = "召回", durationMs = 1800) {
    const now = Date.now();
    const dur = Math.max(300, Math.min(8000, Number(durationMs) || 1800));
    this._pulse = { phase: String(phase || "recall"), label: String(label || "处理中"), since: now, until: now + dur };
    this._emitActivity();
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    this._pulseTimer = setTimeout(() => {
      this._pulse = null;
      this._pulseTimer = null;
      this._emitActivity();
    }, dur + 30);
    if (typeof this._pulseTimer.unref === "function") this._pulseTimer.unref();
  }

  readBackground() {
    return this.configManager.readBackground();
  }

  saveBackground(buffer) {
    return this.configManager.saveBackground(buffer);
  }

  clearBackground() {
    return this.configManager.clearBackground();
  }

  getConfig() {
    return this.configManager.get();
  }

  getPublicConfig() {
    return this.configManager.publicConfig();
  }

  updateConfig(patch) {
    const pub = this.configManager.update(patch);
    // Reset cached store pointer if DB path changed
    if (this._storePath && this._storePath !== pub.dbPath) {
      this._store = null;
      this._storePath = "";
    }
    return pub;
  }

  getStore() {
    const cfg = this.getConfig();
    if (!this._store || this._storePath !== cfg.dbPath) {
      this._store = new SQLiteMemoryStore(cfg.dbPath);
      this._storePath = cfg.dbPath;
    }
    return this._store;
  }

  getLlm(overrideCfg = null) {
    const cfg = overrideCfg || this.getConfig();
    const apiKey =
      overrideCfg && typeof overrideCfg.apiKey === "string" && overrideCfg.apiKey.trim()
        ? overrideCfg.apiKey.trim()
        : this.configManager.effectiveApiKey(cfg);
    return this.llmFactory(cfg, { apiKey });
  }

  async probeProvider(overridePatch = null, { liveChat = false } = {}) {
    const task = this.beginActivity("probe", "检测中");
    try {
      const base = this.getConfig();
      const merged = overridePatch
        ? {
            ...base,
            ...overridePatch,
            provider: overridePatch.provider || base.provider,
            apiKey:
              overridePatch.clearApiKey === true
                ? ""
                : typeof overridePatch.apiKey === "string" && overridePatch.apiKey.trim()
                  ? overridePatch.apiKey.trim()
                  : this.configManager.effectiveApiKey(base),
          }
        : base;
      const adapter = this.getLlm(merged);
      return await adapter.probe({ liveChat });
    } finally {
      task.end();
    }
  }

  /**
   * Ingest text or chat turns: redact -> short-window chunk -> extract -> prior FTS5 lookup -> 1-round admit -> guard -> SQLite.
   */
  async remember(
    content,
    {
      ns = null,
      sourceId = null,
      mentionedAt = null,
      verify = null,
      linkSupersessions = true,
      maxWindowChars = 1400,
    } = {}
  ) {
    const cfg = this.getConfig();
    const namespace = String(ns || cfg.defaultNamespace || "default").trim() || "default";
    const ts = String(mentionedAt || utcNowIso()).trim();
    const createdAt = utcNowIso();
    const shouldVerify = verify === null || verify === undefined ? Boolean(cfg.verify) : Boolean(verify);

    const segments = buildSegments(content);
    if (!segments.length) {
      return {
        doc_id: "",
        namespace,
        deduplicated: false,
        windows: 0,
        extracted: 0,
        saved: 0,
        revised: 0,
        superseded: 0,
        dropped: 0,
        held: 0,
        guard_rejected: 0,
        provider: cfg.provider,
        model: "",
        fact_ids: [],
        facts: [],
      };
    }

    const canonicalBody = segments.map((s) => `${s.role || ""}:${s.text}`).join("\n");
    const contentSha = createHash("sha256").update(canonicalBody, "utf8").digest("hex");
    const store = this.getStore();
    const existingDoc = store.hasDocument(namespace, contentSha);
    if (existingDoc) {
      return {
        doc_id: existingDoc,
        namespace,
        deduplicated: true,
        windows: 0,
        extracted: 0,
        saved: 0,
        revised: 0,
        superseded: 0,
        dropped: 0,
        held: 0,
        guard_rejected: 0,
        provider: cfg.provider,
        model: "",
        fact_ids: [],
        facts: [],
      };
    }

    const docId = `doc-${contentSha.slice(0, 12)}`;
    const windows = windowSegments(segments, { maxWindowChars, overlap: 1 });
    const segMap = new Map(segments.map((s) => [s.id, s]));
    const llm = this.getLlm(cfg);

    const result = {
      doc_id: docId,
      namespace,
      deduplicated: false,
      windows: windows.length,
      extracted: 0,
      saved: 0,
      revised: 0,
      superseded: 0,
      dropped: 0,
      held: 0,
      guard_rejected: 0,
      provider: cfg.provider,
      model: "",
      fact_ids: [],
      facts: [],
    };

    const acceptedFacts = [];
    const seenFactKeys = new Set();
    const task = this.beginActivity("remember", "沉淀中");
    let statsDirty = false;

    try {
      for (let winIdx = 0; winIdx < windows.length; winIdx++) {
        const win = windows[winIdx];
        const winDocId = windows.length === 1 ? docId : `${docId}-w${winIdx}`;
        task.update("extract", windows.length > 1 ? `抽取 ${winIdx + 1}/${windows.length}` : "抽取中");
        const { candidates, model } = await this._extractWindow(llm, {
          namespace,
          docId: winDocId,
          window: win,
        });
        if (model) result.model = model;
        result.extracted += candidates.length;
        if (!candidates.length) continue;

        let reviewed;
        if (shouldVerify) {
          task.update("verify", "审校中");
          const priorFacts = linkSupersessions
            ? this._findPriorFacts(store, { namespace, candidates, maxItems: 6 })
            : [];
          reviewed = await this._admitWindow(llm, {
            window: win,
            candidates,
            mentionedAt: ts,
            namespace,
            result,
            priorFacts,
          });
        } else {
          reviewed = candidates.map((c) => ({ ...c, action: "bypass" }));
        }

        for (const cand of reviewed) {
          const action = String(cand.action || "pass");
          const supersedesFid = cand.supersedes_fact_id;
          const { guarded } = guardFact(cand, segMap, { mentionedAt: ts });
          if (!guarded) {
            result.guard_rejected += 1;
            continue;
          }
          const dedupKey = guarded.text.toLowerCase();
          if (seenFactKeys.has(dedupKey)) continue;
          seenFactKeys.add(dedupKey);
          const entry = { ...guarded, action };
          if (typeof supersedesFid === "number" && Number.isInteger(supersedesFid) && supersedesFid > 0) {
            entry.supersedes_fact_id = supersedesFid;
          }
          acceptedFacts.push(entry);
        }
      }

      task.update("saving", "入库中");
      const savedIds = store.saveDocumentAndFacts({
        docId,
        namespace,
        contentSha256: contentSha,
        sourceId: sourceId ?? null,
        mentionedAt: ts,
        createdAt,
        segments,
        facts: acceptedFacts,
      });

      result.saved = savedIds.length;
      result.superseded = acceptedFacts.filter((f) => f.supersedes_fact_id !== undefined).length;
      result.fact_ids = savedIds;
      result.facts = acceptedFacts;
      this.runtimeMetrics.lastRememberAt = createdAt;
      statsDirty = true;
      return result;
    } finally {
      task.end({ statsDirty });
    }
  }

  async _extractWindow(llm, { namespace, docId, window }) {
    const payload = {
      bank: namespace,
      document_id: docId,
      evidence: window.map(segmentToPayload),
    };
    const { content, meta } = await llm.chatJson(FACT_EXTRACTION_SYSTEM, payload, { numPredict: 1024 });
    const parsed = parseJsonObject(content);
    if (!parsed || !Array.isArray(parsed.facts)) {
      return { candidates: [], model: String(meta?.model || "") };
    }
    const candidates = parsed.facts.filter((f) => f && typeof f === "object" && !Array.isArray(f));
    return { candidates, model: String(meta?.model || "") };
  }

  _findPriorFacts(store, { namespace, candidates, maxItems = 6 }) {
    if (!Array.isArray(candidates) || !candidates.length || maxItems <= 0) return [];
    const collected = new Map();
    for (const cand of candidates) {
      const entities = Array.isArray(cand.entities) ? cand.entities : [];
      const parts = entities
        .slice(0, 4)
        .map((e) => String(e || "").trim())
        .filter(Boolean);
      const text = String(cand.text || "").trim();
      if (text) parts.push(text.slice(0, 120));
      const query = parts.join(" ").trim();
      if (!query) continue;
      let rows = [];
      try {
        rows = store.search(query, {
          namespace,
          limit: 3,
          adaptive: false,
          includeSuperseded: false,
        });
      } catch {
        continue;
      }
      for (const r of rows) {
        const fid = Number(r.fact_id);
        const score = Number(r.score || 0);
        const prev = collected.get(fid);
        if (!prev || score > prev.score) {
          collected.set(fid, {
            score,
            item: {
              fact_id: fid,
              text: String(r.text),
              occurred_start: r.occurred_start ?? null,
              mentioned_at: String(r.mentioned_at || ""),
              entities: Array.isArray(r.entities) ? r.entities.slice(0, 6) : [],
            },
          });
        }
      }
    }
    return [...collected.values()]
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.item.fact_id - b.item.fact_id))
      .slice(0, maxItems)
      .map((entry) => entry.item);
  }

  _parseSupersedesId(verdict, offeredPriorIds) {
    if (!offeredPriorIds || !offeredPriorIds.size) return null;
    const rawCandidates = [];
    if (Array.isArray(verdict?.supersedes_fact_id)) {
      rawCandidates.push(...verdict.supersedes_fact_id);
    } else if (verdict?.supersedes_fact_id !== undefined && verdict?.supersedes_fact_id !== null) {
      rawCandidates.push(verdict.supersedes_fact_id);
    } else if (Array.isArray(verdict?.supersedes_fact_ids)) {
      rawCandidates.push(...verdict.supersedes_fact_ids);
    }
    for (const val of rawCandidates) {
      if (typeof val === "boolean") continue;
      let parsed = null;
      if (typeof val === "number" && Number.isInteger(val)) {
        parsed = val;
      } else if (typeof val === "string" && /^\d+$/.test(val.trim())) {
        parsed = Number(val.trim());
      }
      if (parsed !== null && offeredPriorIds.has(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  async _admitWindow(llm, { window, candidates, mentionedAt, namespace, result, priorFacts = [] }) {
    const winSegText = new Map(window.map((s) => [s.id, s.text]));
    const factsMap = {};
    for (let idx = 0; idx < candidates.length; idx++) {
      const cand = candidates[idx];
      let occStart = cand.occurred_start ?? null;
      if (!occStart && Array.isArray(cand.evidence) && cand.evidence.length) {
        const evBlob = cand.evidence.map((eid) => winSegText.get(String(eid)) || "").join("\n");
        occStart = inferGroundedOccurredStart(cand.text, evBlob, mentionedAt);
      }
      factsMap[String(idx)] = {
        text: String(cand.text || ""),
        type: String(cand.type || "world"),
        occurred_start: occStart,
        occurred_end: cand.occurred_end ?? null,
        where: cand.where ?? null,
        entities: Array.isArray(cand.entities) ? cand.entities : [],
        mentioned_at: mentionedAt,
        context: namespace,
        tags: [],
      };
    }

    const payload = {
      evidence: window.map(segmentToPayload),
      facts: factsMap,
    };
    const offeredPriorIds = new Set();
    let systemPrompt = FACT_ADMISSION_SYSTEM;
    let admitSchema = null;

    if (Array.isArray(priorFacts) && priorFacts.length) {
      payload.prior_facts = priorFacts;
      for (const pf of priorFacts) {
        if (typeof pf?.fact_id === "number" && Number.isInteger(pf.fact_id) && pf.fact_id > 0) {
          offeredPriorIds.add(pf.fact_id);
        }
      }
      systemPrompt = `${FACT_ADMISSION_SYSTEM} ${FACT_ADMISSION_SUPERSEDE_ADDENDUM}`;
      if (offeredPriorIds.size) {
        admitSchema = buildAdmissionSupersedeSchema(candidates.length, [...offeredPriorIds]);
      }
    }

    const chatOpts = { numPredict: 768 };
    if (admitSchema) chatOpts.responseFormat = admitSchema;
    const { content } = await llm.chatJson(systemPrompt, payload, chatOpts);
    const verdicts = parseJsonObject(content);
    if (!verdicts) {
      return candidates.map((c) => ({ ...c, action: "pass_fallback" }));
    }

    const approved = [];
    for (let idx = 0; idx < candidates.length; idx++) {
      const cand = candidates[idx];
      const verdict = verdicts[String(idx)];
      if (!verdict || typeof verdict !== "object") {
        result.held += 1;
        continue;
      }
      const decision = String(verdict.decision || "").trim().toLowerCase();
      if (!VALID_DECISIONS.has(decision)) {
        result.held += 1;
        continue;
      }
      const ev =
        Array.isArray(verdict.evidence) && verdict.evidence.length ? verdict.evidence : cand.evidence;
      const supersedesId = this._parseSupersedesId(verdict, offeredPriorIds);

      if (decision === "pass") {
        const entry = { ...cand, evidence: ev, action: "pass" };
        if (supersedesId !== null) entry.supersedes_fact_id = supersedesId;
        approved.push(entry);
      } else if (decision === "revise") {
        const replacement = String(verdict.replacement || "").trim();
        if (replacement) {
          result.revised += 1;
          const entry = { ...cand, text: replacement, evidence: ev, action: "revise" };
          if (supersedesId !== null) entry.supersedes_fact_id = supersedesId;
          approved.push(entry);
        } else {
          result.held += 1;
        }
      } else if (decision === "drop") {
        result.dropped += 1;
      } else {
        result.held += 1;
      }
    }
    return approved;
  }

  recall(
    query,
    {
      ns = null,
      limit = null,
      adaptive = null,
      minLimit = ADAPTIVE_MIN_LIMIT,
      scoreRatio = ADAPTIVE_SCORE_RATIO,
      asOf = null,
      untilEnabled = null,
      occurredFrom = null,
      occurredTo = null,
      includeSuperseded = true,
    } = {}
  ) {
    const cfg = this.getConfig();
    const useAdaptive = adaptive === null || adaptive === undefined ? Boolean(cfg.adaptive) : Boolean(adaptive);
    const useUntil = untilEnabled === null || untilEnabled === undefined ? Boolean(cfg.untilExpiry) : Boolean(untilEnabled);
    return this.getStore().search(query, {
      namespace: ns || null,
      limit,
      adaptive: useAdaptive,
      minLimit,
      scoreRatio,
      asOf,
      untilEnabled: useUntil,
      occurredFrom,
      occurredTo,
      includeSuperseded,
    });
  }

  stats(ns = null) {
    return this.getStore().stats(ns || null);
  }

  getDocument(docId) {
    return this.getStore().getDocument(docId);
  }

  softEvict(opts) {
    const res = this.getStore().softEvict(opts);
    if (res?.moved_facts || res?.total_records) this._emitActivity({ statsDirty: true });
    return res;
  }

  listEvictedBatches(limit = 50) {
    return this.getStore().listEvictedBatches(limit);
  }

  restoreEvicted(batchId) {
    const res = this.getStore().restoreEvicted(batchId);
    if (res?.restored_facts || res?.restored_documents) this._emitActivity({ statsDirty: true });
    return res;
  }

  deleteFact(factId) {
    return this.getStore().deleteFact(factId);
  }

  deleteDocument(docId) {
    return this.getStore().deleteDocument(docId);
  }

  exportMarkdown({
    outputPath = null,
    outputDir = null,
    ns = null,
    occurredFrom = null,
    occurredTo = null,
    asOf = null,
    includeSuperseded = true,
    includeEvicted = false,
    frontmatter = true,
  } = {}) {
    const store = this.getStore();
    return exportMarkdown({
      dbPath: store.dbPath,
      outputPath,
      outputDir,
      namespace: ns || null,
      occurredFrom,
      occurredTo,
      asOf,
      includeSuperseded,
      includeEvicted,
      frontmatter,
    });
  }

  async backup(outputPath = null, { overwrite = false, verify = true, writeSha256 = false, pages = 256 } = {}) {
    const store = this.getStore();
    const task = this.beginActivity("backup", "备份中");
    try {
      return await backupDatabase({
        dbPath: store.dbPath,
        outputPath,
        overwrite,
        verify,
        writeSha256,
        pages,
      });
    } finally {
      task.end();
    }
  }
}
