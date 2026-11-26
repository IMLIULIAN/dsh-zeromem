# Changelog

All notable changes to `@imliulian/dsh-zeromem` will be documented in this file.

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
