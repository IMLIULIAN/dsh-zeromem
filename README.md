<p align="right">
  <a href="README.zh.md">简体中文</a> | <strong>English</strong>
</p>

# @imliulian/dsh-zeromem

> **ZeroMem (零忆) — Local, Evidence-Grounded Memory System for DeepSeek Harness (DSH)** · AGPL-3.0  
> Author: **IMLIULIAN (B站IM榴莲)** · ZeroZoneX

`@imliulian/dsh-zeromem` brings a **self-contained, single-file local memory engine** directly into DeepSeek Harness — no cloud vector database, no Python runtime, no native C++ compilation (`node-gyp` / `better-sqlite3`), and no MCP subprocess overhead.

---

## Why ZeroMem (Core Memory System)

1. **Pure Local Single-File Engine (`<1ms` Recall, Zero Native Builds)**
   - Built directly on Node's built-in `node:sqlite` (`Node >= 22.19` / `Node 24`) with **dual-track CJK 2-gram + English FTS5** indexing over both extracted facts and original evidence segments.
   - Zero third-party runtime dependencies and zero `postinstall` build scripts — installs cleanly under `pnpm >= 10`.
   - **100% Fail-Open**: even if Ollama or your cloud API is offline, DSH startup and chat are never blocked and local FTS5 search remains available.

2. **Evidence-Grounded Extraction + Pre-Write Admission Verification**
   - Uses a two-stage pipeline (**short-window chunking → structured extraction → 1-round source-grounded admission check → deterministic guard**) tuned for the open-source 4B specialist model **[Qwen3.5-4B-Memory-V2](https://huggingface.co/IMLIULIAN/qwen3.5-4b-memory-v2)** (runs 100% locally via Ollama at $0 cloud cost).
   - Every stored fact remains **hard-bound to original evidence segments** (`evidence_ids`), eliminating black-box drift and allowing instant verification against the source text.
   - **Automatic Pre-Send Credential Redaction**: common secrets (`sk-...`, `ghp_...`, `AKIA...`, `Bearer ...`, etc.) are masked to `[REDACTED]` *before* extraction or storage — including when using external APIs.

3. **Long-Horizon Memory Governance (Anti-Decay & Reversible)**
   - **Time-Expiry Demotion (`until:YYYY-MM-DD`)**: expired temporary rules/plans are strictly calendar-validated and non-destructively demoted to the tail of search results instead of polluting active context.
   - **Adaptive `2–8` Relative-Score Gating**: dynamically trims low-relevance tail noise based on relative BM25 score ratio (`0.35`, toggleable).
   - **Lossless Soft-Eviction & SHA-256 Tamper-Checked Restore**: deleting a memory archives its facts, segments, and canonical SHA-256 fingerprint into the `evicted_records` side table; restoring verifies integrity before atomically rebuilding FTS5 indexes.

4. **Flexible Dual Backend (Local Ollama ↔ OpenAI-Compatible API)**
   - **Local Ollama (Default)**: connects directly to `127.0.0.1:11434` (bypassing system proxy for loopback), auto-detects local Ollama / `Qwen3.5-4B-Memory-V2`, and supports one-click background model pulling (`Q8_0` / `Q4_K_M`) with confirmation.
   - **Cloud / Custom OpenAI-Compatible API**: switch live anytime without restarting DSH — built-in presets for DeepSeek, OpenAI, SiliconFlow, OpenRouter, plus persistent **Custom API** (Base URL + Model ID) for vLLM, LM Studio, or private gateways. API keys stay strictly local (`~/.zeromem/dsh-zeromem.json`, mode `0600`) and are never echoed to the browser.

5. **Native DSH Integration & Cross-Tool Interop**
   - **5 Native DSH Tools** (strict lossless JSON): `zeromem_recall`, `zeromem_remember`, `zeromem_stats`, `zeromem_evict`, `zeromem_restore`.
   - **Automatic Session Lifecycle Hooks** (live-toggleable): `agent/pre-step` (`<1ms` recall with anti-loop markers) and `agent/turn-stopping` (non-blocking background extraction, automatically skips subagents).
   - **Shared Database with Python ZeroMem**: reads and writes the exact same `~/.zeromem/memory.db` (`schema_version = 1`) as [IMLIULIAN/zeromem](https://github.com/IMLIULIAN/zeromem), sharing local memory seamlessly across DSH, Cursor, Claude Code, and Codex.

---

## Installation

### Via DSH CLI
```bash
# Install into your web or desktop profile
dsh plugin --profile web add @imliulian/dsh-zeromem
```

### Via DSH Plugin Market
Open **Settings → Plugin Market** in DeepSeek Harness, search `@imliulian/dsh-zeromem` (or `dsh-zeromem`), and click Install.

### Isolated Local Development / Testing
```bash
dsh plugin --profile zeromem-dev add link:/path/to/dsh-zeromem
```

---

## Model Setup

### Option A: Local Ollama (Recommended, 100% Offline & Free)
Pull the companion specialist 4B model (or use any local Ollama model):
```bash
# High precision (recommended, ~4.5 GB)
ollama pull hf.co/IMLIULIAN/qwen3.5-4b-memory-v2:Q8_0

# Lightweight (~2.7 GB)
ollama pull hf.co/IMLIULIAN/qwen3.5-4b-memory-v2:Q4_K_M
```
*(You can also trigger detection, silent startup, and versioned pull directly from the plugin's Settings tab.)*

### Option B: OpenAI-Compatible API (No Dedicated GPU Required)
Configure via `~/.zeromem/dsh-zeromem.json`, environment variables, or the Settings tab. Credentials are masked to `[REDACTED]` before requests leave your machine.

---

## Configuration & Environment Overrides

Default config path: `~/.zeromem/dsh-zeromem.json` (`0600` on POSIX). Supports `cordis.patch.yml` overrides under `config:` or environment variables:

| Variable | Purpose |
| :--- | :--- |
| `ZEROMEM_DB` | Custom SQLite database path (default `~/.zeromem/memory.db`) |
| `ZEROMEM_DSH_CONFIG` | Custom plugin config JSON path |
| `ZEROMEM_PROVIDER` | `ollama` (default) or `openai-compatible` |
| `ZEROMEM_OLLAMA_URL` / `ZEROMEM_MODEL` / `ZEROMEM_NUM_CTX` | Local Ollama endpoint, model tag, and context window |
| `ZEROMEM_API_BASE_URL` / `ZEROMEM_API_MODEL` / `ZEROMEM_API_KEY` | OpenAI-compatible endpoint, model ID, and key |
| `ZEROMEM_UNTIL=0` | Disable `until:` expiry demotion |
| `ZEROMEM_ADAPTIVE_LIMIT_DISABLED=1` | Fall back from adaptive `2–8` gating to fixed top-6 |

---

## Bonus: Embedded Web & Desktop Management Workbench

As an optional convenience on top of the local memory engine, the plugin injects a lightweight Shadow DOM management panel in DSH Web and DSH Desktop (automatically skipped in headless profiles, protected by loopback + same-origin security fences):

- Browse and search local facts, filter by namespace, expand bound original evidence, and inspect `[REDACTED]` highlights.
- Manually write facts, soft-evict outdated entries (with recycle bin preview & SHA-256 restore), and clear expired `until:` records.
- Switch Local Ollama / Cloud API live, test connectivity, and optionally toggle light/dark frosted-glass styling or custom wallpaper.

---

## Testing

```bash
npm run check
npm test
```

## License, Attribution & Disambiguation
- **License**: **GNU Affero General Public License v3.0 (`AGPL-3.0-only`)** — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Any redistributed modifications or network-accessible deployments derived from this plugin must remain open-source under AGPL-3.0 with original copyright notices preserved.
- **Author & Companion Projects**: **IMLIULIAN (B站IM榴莲)** · **ZeroZoneX** — [IMLIULIAN/zeromem](https://github.com/IMLIULIAN/zeromem) · [Qwen3.5-4B-Memory-V2 (Hugging Face, separately Apache-2.0)](https://huggingface.co/IMLIULIAN/qwen3.5-4b-memory-v2)
- **Schema Lineage & Compatibility**: The fact schema conventions shared with ZeroMem (`bank`, `type: world | experience | observation`, `occurred_start` / `occurred_end` / `mentioned_at`, `where`, `entities`) are inspired by and conceptually compatible with [**Vectorize Hindsight**](https://github.com/vectorize-io/hindsight) (MIT License). This plugin's `node:sqlite` + dual-track FTS5 engine, pre-write admission guardrails, governance/restore layer, and DSH UI/hooks are independent implementations containing no Hindsight source code.
- **Name Disambiguation**: **ZeroMem (零忆)** / `@imliulian/dsh-zeromem` is an independent local memory system and is **not** affiliated with or derived from the academic paper *Zero-Mem: Zero-Token Memory Operations for LLM Agents* (Yilin Xiao et al., [arXiv:2607.29377](https://arxiv.org/abs/2607.29377), July 2026).
