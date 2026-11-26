/**
 * Native DSH Cordis tool registrations (`ctx.tools.register`).
 *
 * Invariants:
 * - Strictly lossless JSON outputs (no `undefined`, no `NaN`, no `Infinity` — DSH host rejects non-lossless values).
 * - 100% Fail-Open: catches SQLite/Ollama/API errors and returns clear structured `{ ok: false, error }` responses.
 * - Workspace-aware default namespace resolution via `exec?.agent?.session?.header?.cwd`.
 */

import path from "node:path";

export function deriveWorkspaceNamespace(cwd, cfg) {
  if (cfg?.namespaceMode === "fixed") {
    return String(cfg.defaultNamespace || "default").trim() || "default";
  }
  const raw = String(cwd || "").trim();
  if (!raw) return String(cfg?.defaultNamespace || "default").trim() || "default";
  const base = path.basename(raw).replace(/[^A-Za-z0-9\u4e00-\u9fff._-]+/g, "-").replace(/^-+|-+$/g, "");
  return base ? `project:${base.slice(0, 64)}` : String(cfg?.defaultNamespace || "default").trim() || "default";
}

function cleanLosslessHit(h) {
  const item = {
    fact_id: Number(h.fact_id),
    doc_id: String(h.doc_id || ""),
    namespace: String(h.namespace || "default"),
    text: String(h.text || ""),
    type: String(h.type || "world"),
    action: String(h.action || "pass"),
    mentioned_at: String(h.mentioned_at || ""),
    score: Number.isFinite(Number(h.score)) ? Number(h.score) : 0,
    entities: Array.isArray(h.entities) ? h.entities.map(String) : [],
    evidence: Array.isArray(h.evidence)
      ? h.evidence.map((e) => ({
          id: String(e.id || ""),
          text: String(e.text || ""),
        }))
      : [],
  };
  if (h.occurred_start) item.occurred_start = String(h.occurred_start);
  if (h.occurred_end) item.occurred_end = String(h.occurred_end);
  if (h.where) item.where = String(h.where);
  if (typeof h.supersedes_fact_id === "number" && Number.isInteger(h.supersedes_fact_id)) {
    item.supersedes_fact_id = h.supersedes_fact_id;
  }
  if (Array.isArray(h.superseded_by) && h.superseded_by.length) {
    item.superseded_by = h.superseded_by.map((x) => Number(x)).filter(Number.isInteger);
  }
  if (h.until_expiry) {
    item.until_expiry = {
      until: String(h.until_expiry.until),
      expired: true,
      expired_days: Number(h.until_expiry.expired_days || 0),
      label: String(h.until_expiry.label || ""),
    };
  }
  return item;
}

function renderRecall(value) {
  if (!value?.ok) return [{ type: "text", text: value?.error || "ZeroMem 检索失败。" }];
  if (!value.count) {
    return [{ type: "text", text: "ZeroMem 本地记忆库中未找到匹配记录。" }];
  }
  const lines = value.items.map((item, idx) => {
    const badges = [];
    if (item.occurred_start) {
      const occ = item.occurred_end && item.occurred_end !== item.occurred_start
        ? `${item.occurred_start}~${item.occurred_end}`
        : item.occurred_start;
      badges.push(occ);
    }
    if (item.action === "revise") badges.push("已纠错");
    if (item.supersedes_fact_id) badges.push(`替代 #${item.supersedes_fact_id}`);
    if (Array.isArray(item.superseded_by) && item.superseded_by.length) {
      badges.push(`已被 ${item.superseded_by.map((x) => `#${x}`).join(",")} 替代`);
    }
    if (item.until_expiry?.label) badges.push(item.until_expiry.label);
    const badgeStr = badges.length ? ` [${badges.join(" | ")}]` : "";
    const evText = item.evidence?.length
      ? `\n   原文(${item.evidence.map((e) => e.id).join(",")}): ${item.evidence.map((e) => e.text).join(" / ").slice(0, 220)}`
      : "";
    return `${idx + 1}. (#${item.fact_id} · ${item.namespace}${badgeStr}) ${item.text}${evText}`;
  });
  return [{ type: "text", text: lines.join("\n") }];
}

export function registerZeroMemTools(toolCtx, engine) {
  const disposers = [];
  if (!toolCtx?.tools || typeof toolCtx.tools.register !== "function") return () => {};

  const reg = (spec) => {
    const d = toolCtx.tools.register(spec);
    if (typeof d === "function") disposers.push(d);
  };

  reg({
    name: "zeromem_recall",
    description:
      "Search ZeroMem local SQLite memory by concise keywords across both verified facts and bound original evidence (Chinese/English FTS5, <1ms, zero LLM cost). " +
      "For multi-topic questions, issue 2 short keyword calls in parallel instead of one long sentence.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "Concise keywords for one topic (empty string returns most recent facts).",
        },
        namespace: {
          type: "string",
          description: "Optional namespace filter; omit to search across all namespaces.",
        },
        limit: {
          type: "integer",
          description: "Optional max results (1-20; omit for adaptive 2-8 score gating).",
        },
        adaptive: {
          type: "boolean",
          description: "Enable adaptive relative-score tail pruning (default from config).",
        },
        as_of: {
          type: "string",
          description: "Optional YYYY-MM-DD date for evaluating until: expiry demotion.",
        },
        occurred_from: {
          type: "string",
          description: "Optional event time lower bound (YYYY, YYYY-MM, or YYYY-MM-DD).",
        },
        occurred_to: {
          type: "string",
          description: "Optional event time upper bound (YYYY, YYYY-MM, or YYYY-MM-DD).",
        },
        include_superseded: {
          type: "boolean",
          description: "Include historical facts superseded by newer facts (default true; active facts rank first).",
        },
      },
    },
    timeoutMs: 15_000,
    isConcurrencySafe: true,
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ok", "count", "items"],
        properties: {
          ok: { type: "boolean" },
          count: { type: "integer" },
          expired_count: { type: "integer" },
          superseded_count: { type: "integer" },
          items: { type: "array", items: { type: "object" } },
          error: { type: "string" },
        },
      },
      render(_args, value) {
        return renderRecall(value);
      },
    },
    async execute(args) {
      try {
        const query = String(args?.query ?? "");
        const ns = args?.namespace ? String(args.namespace).trim() : null;
        const limit = args?.limit !== undefined && args?.limit !== null ? Number(args.limit) : null;
        const adaptive = args?.adaptive !== undefined ? Boolean(args.adaptive) : null;
        const asOf = args?.as_of ? String(args.as_of).trim() : null;
        const occurredFrom = args?.occurred_from ? String(args.occurred_from).trim() : null;
        const occurredTo = args?.occurred_to ? String(args.occurred_to).trim() : null;
        const includeSuperseded =
          args?.include_superseded !== undefined ? Boolean(args.include_superseded) : true;
        const hits = engine.recall(query, {
          ns,
          limit,
          adaptive,
          asOf,
          occurredFrom,
          occurredTo,
          includeSuperseded,
        });
        const items = hits.map(cleanLosslessHit);
        const expiredCount = items.filter((i) => Boolean(i.until_expiry)).length;
        const supersededCount = items.filter((i) => Array.isArray(i.superseded_by) && i.superseded_by.length > 0).length;
        return {
          ok: true,
          count: items.length,
          expired_count: expiredCount,
          superseded_count: supersededCount,
          items,
        };
      } catch (err) {
        return {
          ok: false,
          count: 0,
          expired_count: 0,
          superseded_count: 0,
          items: [],
          error: `ZeroMem 检索失败：${String(err?.message || err).slice(0, 240)}`,
        };
      }
    },
  });

  reg({
    name: "zeromem_remember",
    description:
      "Store important decisions, configurations, facts, or notes into local ZeroMem SQLite. " +
      "Redacts credentials before extraction, runs structured fact extraction + 1-round pre-write verification via the configured local Ollama model or OpenAI-compatible API, and binds original evidence segments.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["content"],
      properties: {
        content: {
          type: "string",
          description: "Text or note to remember. Long content is auto-chunked into <1400-char windows.",
        },
        namespace: {
          type: "string",
          description: "Optional namespace (defaults to current workspace namespace).",
        },
        source_id: {
          type: "string",
          description: "Optional source label or file path.",
        },
        mentioned_at: {
          type: "string",
          description: "Optional ISO-8601 record timestamp.",
        },
        verify: {
          type: "boolean",
          description: "Run 1-round pre-write admission/revision check (default from config).",
        },
        link_supersessions: {
          type: "boolean",
          description: "Detect and link superseded historical facts in the same namespace during admission (default true).",
        },
      },
    },
    timeoutMs: 120_000,
    isConcurrencySafe: false,
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ok"],
        properties: {
          ok: { type: "boolean" },
          doc_id: { type: "string" },
          namespace: { type: "string" },
          deduplicated: { type: "boolean" },
          extracted: { type: "integer" },
          saved: { type: "integer" },
          revised: { type: "integer" },
          superseded: { type: "integer" },
          dropped: { type: "integer" },
          held: { type: "integer" },
          provider: { type: "string" },
          model: { type: "string" },
          error: { type: "string" },
        },
      },
      render(_args, value) {
        if (!value?.ok) return [{ type: "text", text: value?.error || "ZeroMem 写入失败。" }];
        if (value.deduplicated) {
          return [{ type: "text", text: `内容已存在于 ZeroMem（${value.namespace} · ${value.doc_id}），跳过重复写入。` }];
        }
        const supPart = value.superseded ? `，替代旧事实 ${value.superseded}` : "";
        return [
          {
            type: "text",
            text: `已写入 ZeroMem（${value.namespace} · ${value.doc_id}）：抽取 ${value.extracted} 条，入库 ${value.saved} 条（纠错 ${value.revised}${supPart}，拦截 ${value.dropped}，挂起 ${value.held}），后端 ${value.provider}/${value.model || "auto"}。`,
          },
        ];
      },
    },
    async execute(args, exec) {
      try {
        const content = String(args?.content ?? "").trim();
        if (!content) return { ok: false, error: "content 不能为空。" };
        const cfg = engine.getConfig();
        const cwd = exec?.agent?.session?.header?.cwd || process.cwd();
        const ns = args?.namespace
          ? String(args.namespace).trim()
          : deriveWorkspaceNamespace(cwd, cfg);
        const res = await engine.remember(content, {
          ns,
          sourceId: args?.source_id ? String(args.source_id) : null,
          mentionedAt: args?.mentioned_at ? String(args.mentioned_at) : null,
          verify: args?.verify !== undefined ? Boolean(args.verify) : null,
          linkSupersessions:
            args?.link_supersessions !== undefined ? Boolean(args.link_supersessions) : true,
        });
        return {
          ok: true,
          doc_id: String(res.doc_id || ""),
          namespace: String(res.namespace || ns),
          deduplicated: Boolean(res.deduplicated),
          extracted: Number(res.extracted || 0),
          saved: Number(res.saved || 0),
          revised: Number(res.revised || 0),
          superseded: Number(res.superseded || 0),
          dropped: Number(res.dropped || 0),
          held: Number(res.held || 0),
          provider: String(res.provider || cfg.provider),
          model: String(res.model || ""),
        };
      } catch (err) {
        return {
          ok: false,
          error: `ZeroMem 写入失败：${String(err?.message || err).slice(0, 300)}`,
        };
      }
    },
  });

  reg({
    name: "zeromem_stats",
    description:
      "Inspect local ZeroMem database statistics (documents, facts, revised facts, soft-evicted records, namespaces) and current backend mode (Ollama or API) without invoking an LLM.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        namespace: {
          type: "string",
          description: "Optional namespace filter.",
        },
      },
    },
    timeoutMs: 15_000,
    isConcurrencySafe: true,
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ok"],
        properties: {
          ok: { type: "boolean" },
          provider: { type: "string" },
          db_path: { type: "string" },
          documents: { type: "integer" },
          segments: { type: "integer" },
          facts: { type: "integer" },
          revised_facts: { type: "integer" },
          supersessions: { type: "integer" },
          evicted_records: { type: "integer" },
          namespaces: { type: "array", items: { type: "string" } },
          error: { type: "string" },
        },
      },
      render(_args, value) {
        if (!value?.ok) return [{ type: "text", text: value?.error || "读取统计失败。" }];
        const supText = value.supersessions ? ` · 演化链 ${value.supersessions}` : "";
        return [
          {
            type: "text",
            text:
              `ZeroMem (${value.provider}) · ${value.db_path}\n` +
              `文档 ${value.documents} · 原文段 ${value.segments} · 事实 ${value.facts}（已纠错 ${value.revised_facts}）${supText} · 回收站 ${value.evicted_records}\n` +
              `空间：${value.namespaces.length ? value.namespaces.join(", ") : "(空)"}`,
          },
        ];
      },
    },
    async execute(args) {
      try {
        const ns = args?.namespace ? String(args.namespace).trim() : null;
        const st = engine.stats(ns);
        const cfg = engine.getConfig();
        return {
          ok: true,
          provider: String(cfg.provider),
          db_path: String(st.db_path),
          documents: Number(st.documents),
          segments: Number(st.segments),
          facts: Number(st.facts),
          revised_facts: Number(st.revised_facts),
          supersessions: Number(st.supersessions || 0),
          evicted_records: Number(st.evicted_records),
          namespaces: st.namespaces.map(String),
        };
      } catch (err) {
        return {
          ok: false,
          error: `读取 ZeroMem 统计失败：${String(err?.message || err).slice(0, 240)}`,
        };
      }
    },
  });

  reg({
    name: "zeromem_evict",
    description:
      "Losslessly soft-evict outdated or incorrect facts/documents into ZeroMem's same-DB recycle table (evicted_records) with SHA-256 fingerprints so they can be restored anytime via zeromem_restore.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        fact_id: { type: "integer", description: "Numeric fact_id to soft-evict." },
        doc_id: { type: "string", description: "Document ID (doc-...) to soft-evict." },
        expired: { type: "boolean", description: "Soft-evict all facts with expired until: tags." },
        namespace: { type: "string", description: "Optional namespace scope." },
        reason: { type: "string", description: "Short reason recorded in the eviction batch." },
        force: { type: "boolean", description: "Allow emptying all active facts in scope." },
      },
    },
    timeoutMs: 15_000,
    isConcurrencySafe: false,
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ok"],
        properties: {
          ok: { type: "boolean" },
          batch_id: { type: "string" },
          moved_facts: { type: "integer" },
          moved_documents: { type: "integer" },
          total_records: { type: "integer" },
          error: { type: "string" },
        },
      },
      render(_args, value) {
        if (!value?.ok) return [{ type: "text", text: value?.error || "软淘汰失败。" }];
        if (!value.total_records) return [{ type: "text", text: "没有符合条件的活跃记忆需要软淘汰。" }];
        return [
          {
            type: "text",
            text: `已无损软淘汰 ${value.total_records} 项（事实 ${value.moved_facts}、文档 ${value.moved_documents}），批次号 ${value.batch_id}（可随时用 zeromem_restore 或 Web 回收站恢复）。`,
          },
        ];
      },
    },
    async execute(args) {
      try {
        const res = engine.softEvict({
          factIds: args?.fact_id !== undefined && args?.fact_id !== null ? [Number(args.fact_id)] : [],
          docIds: args?.doc_id ? [String(args.doc_id)] : [],
          expired: Boolean(args?.expired),
          namespace: args?.namespace ? String(args.namespace).trim() : null,
          reason: args?.reason ? String(args.reason) : "tool-evict",
          force: Boolean(args?.force),
        });
        return {
          ok: true,
          batch_id: String(res.batch_id),
          moved_facts: Number(res.moved_facts || 0),
          moved_documents: Number(res.moved_documents || 0),
          total_records: Number(res.total_records || 0),
        };
      } catch (err) {
        return {
          ok: false,
          error: `软淘汰失败：${String(err?.message || err).slice(0, 240)}`,
        };
      }
    },
  });

  reg({
    name: "zeromem_restore",
    description:
      "Verify SHA-256 fingerprints and atomically restore a soft-evicted batch back into active ZeroMem tables and FTS5 index.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["batch_id"],
      properties: {
        batch_id: { type: "string", description: "Batch ID returned by zeromem_evict or listed in the Web recycle bin." },
      },
    },
    timeoutMs: 15_000,
    isConcurrencySafe: false,
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ok"],
        properties: {
          ok: { type: "boolean" },
          batch_id: { type: "string" },
          restored_facts: { type: "integer" },
          restored_documents: { type: "integer" },
          verified_rows: { type: "integer" },
          error: { type: "string" },
        },
      },
      render(_args, value) {
        if (!value?.ok) return [{ type: "text", text: value?.error || "恢复失败。" }];
        return [
          {
            type: "text",
            text: `已通过 ${value.verified_rows} 项 SHA-256 校验并恢复批次 ${value.batch_id}（事实 ${value.restored_facts}，文档 ${value.restored_documents}）。`,
          },
        ];
      },
    },
    async execute(args) {
      try {
        const res = engine.restoreEvicted(String(args?.batch_id || ""));
        return {
          ok: true,
          batch_id: String(res.batch_id),
          restored_facts: Number(res.restored_facts || 0),
          restored_documents: Number(res.restored_documents || 0),
          verified_rows: Number(res.verified_rows || 0),
        };
      } catch (err) {
        return {
          ok: false,
          error: `恢复失败：${String(err?.message || err).slice(0, 240)}`,
        };
      }
    },
  });

  return () => {
    for (const d of disposers) {
      try {
        d();
      } catch {
        // ignore dispose errors
      }
    }
  };
}
