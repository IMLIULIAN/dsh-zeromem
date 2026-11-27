# Changelog

All notable changes to `@imliulian/dsh-zeromem` will be documented in this file.

## [0.2.1] - 2026-11-27

### Fixed & Improved
- **Pure Native Pre-Write Admission + Gated Standalone Supersession (`lib/contracts.mjs`, `lib/memory.mjs`)**:
  - Restored `_admitWindow` to the 100% pure native 3-field `FACT_ADMISSION_SYSTEM` prompt (removing out-of-distribution `prior_facts` and 4-field JSON Schema pollution during admission that caused admission drift and noisy supersession edges in v0.2.0).
  - Extracted supersession linking into a lightweight gated standalone pass (`FACT_SUPERSESSION_SYSTEM` + `buildSupersessionSchema`, `num_predict = 128`) that triggers only on admitted & guarded facts containing explicit state-change/migration cues (`hasSupersessionCue`) and passing size-independent token-overlap and boilerplate-echo filters (`FACT_ADMISSION_SUPERSEDE_ADDENDUM` kept as a compatibility export).
- **No-Op Revision Isolation (`isNoopRevision`)**:
  - Intercepts `decision === "revise"` outputs that return empty strings or materially unchanged copies of the candidate (ignoring whitespace, casing, and trailing `| Involving:` suffixes) and routes them into `hold` isolation rather than storing stale/leaked facts.
- **Recall Evidence Deduplication & Verbatim Folding (`deduplicateRecallEvidence`, `isEvidenceVerbatimInFact`, `lib/hooks.mjs`, `lib/tools.mjs`)**:
  - Deduplicates shared `(doc_id, seg_id)` evidence segments across recall hits and folds segments already contained verbatim inside the fact text into compact segment references in both `formatRecallInjection` (`agent/pre-step` auto-injection) and `zeromem_recall` tool output—while preserving full lossless `hit.evidence` on underlying engine/store APIs.
- **Full Python Parity & 52k-Char Ablation Verification**:
  - Keeps `schema_version = 1`, `SCHEMA_SIG = 42e7ab99494de6a6b4e88eb2`, `APP_FORMAT_ID = 0x494D4C4C`, and all 5 native DSH tool names unchanged (100% cross-runtime interoperable with Python `zeromem` v0.2.1).
  - Verified on the controlled 52k-char (71 docs × 12 Qs) ablation benchmark (`L3 v0.2.0 -> L3-FIX v0.2.1`): deterministic rule defect rate `1.07% -> 0.00%`, prior template leaks `4/6 -> 0/0`, full-DB combined error rate `8.31% -> 6.79%`, supersession false positives `-83.3%` (`12 -> 3` with core TP `sig_05 -> sig_02` lifting Top-1 hit rate `90% -> 100%`), context characters `-17.0%` (`12/12` questions reduced), and single-step cloud input tokens `-13.9%`.

## [0.2.0] - 2026-11-26

### Added
- **Timeline Evolution & Supersession Lineage (`fact_supersessions`)**: Full feature and SQLite schema parity with Python [ZeroMem](https://github.com/IMLIULIAN/zeromem) (`schema_version = 1`, `SCHEMA_SIG = 42e7ab99494de6a6b4e88eb2`, `APP_FORMAT_ID = 0x494D4C4C` unchanged). Before admission, same-namespace active facts are recalled via `<1ms` FTS5 as `prior_facts` with Ollama JSON Schema constraints (`supersedes_fact_id`) to link replacements without breaking existing records.
- **Event Time Interval Filtering (`occurred_from` / `occurred_to` / `include_superseded`)**: Supports `YYYY`, `YYYY-MM`, and `YYYY-MM-DD` bounds with fail-closed validation across `SQLiteMemoryStore.search()`, `ZeroMemEngine.recall()`, `zeromem_recall` tool, `/dsh-zeromem/api/memories`, and the CLI; active facts automatically rank ahead of superseded history; `guardFact` adds conservative single-date grounding backfill without leaking record dates or `until:` tags.
- **Read-Only Markdown Export (`exportMarkdown` / `dsh-zeromem export --md` / `GET /dsh-zeromem/api/export.md`)**: 100% read-only SQLite access (`readOnly: true` + `PRAGMA query_only = ON`), zero LLM calls, supporting stdout, single file (`-o`), or per-namespace Obsidian/Git directory (`--dir` with `INDEX.md`), preserving YAML frontmatter, bound original evidence quotes, supersession badges, and `until:` expiry labels.
- **SQLite Online Safe Backup (`backupDatabase` / `dsh-zeromem backup` / `POST /dsh-zeromem/api/backup`)**: Powered by Node's built-in `node:sqlite` Online Backup API (`backup()`), safely snapshots live WAL databases, flattens snapshots to `journal_mode = DELETE` (zero `-wal`/`-shm` sidecars for OneDrive/BaiduSyncdisk/iCloud), verifies `PRAGMA integrity_check == ok`, and optionally writes `.sha256` checksum files.
- **Lossless Soft-Eviction & Restore Lineage Parity**: `softEvict` / `restoreEvicted` now snapshot and restore `fact_supersessions` edges with canonical JSON SHA-256 parity across Python and Node runtimes.
- **Zero-Dependency CLI & Workbench Controls**: Added `dsh-zeromem` CLI (`search` / `export` / `backup` / `stats`) and compact icon controls in the embedded Shadow DOM workbench for timeline date filtering, one-click Markdown export download, and one-click online snapshot backup.

## [0.1.0] - 2026-11-23

### Added
- **Local Single-File SQLite Memory Engine (`node:sqlite` + FTS5)**: Zero third-party runtime dependencies and zero native C++ build scripts; dual-track CJK 2-gram + English full-text search over extracted facts and bound original evidence segments; full schema parity (`schema_version = 1`) with Python [ZeroMem](https://github.com/IMLIULIAN/zeromem).
- **Evidence-Grounded Extraction & Pre-Write Admission Pipeline**: Short-window chunking, Chinese-priority structured extraction, optional 1-round source-grounded admission verification, deterministic rule guard, and pre-send/pre-store `[REDACTED]` credential masking.
- **Memory Governance**: Strict `until:YYYY-MM-DD` calendar expiry demotion, adaptive `2–8` relative-score gating, and lossless soft-eviction into `evicted_records` with canonical SHA-256 tamper-checked atomic restore.
- **Dual LLM Backend (Local Ollama ↔ OpenAI-Compatible API)**: Loopback proxy-bypass Ollama integration with automatic detection, silent local startup, and confirmed background pulling of `Qwen3.5-4B-Memory-V2` (`Q8_0` / `Q4_K_M`), plus live-switchable DeepSeek / OpenAI / SiliconFlow / OpenRouter / persistent Custom API support.
- **Native DeepSeek Harness Integration**: 5 lossless-JSON native tools (`zeromem_recall`, `zeromem_remember`, `zeromem_stats`, `zeromem_evict`, `zeromem_restore`) and fail-open `agent/pre-step` / `agent/turn-stopping` hooks with anti-loop markers.
- **Embedded Web & Desktop Workbench (Bonus)**: Shadow DOM floating pill and slide-over management drawer protected by loopback + same-origin security fences, supporting live search, evidence inspection, recycle bin restore, local/API switching, light/dark frosted glass styling, and custom wallpaper upload.
