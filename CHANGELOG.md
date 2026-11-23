# Changelog

All notable changes to `@imliulian/dsh-zeromem` will be documented in this file.

## [0.1.0] - 2026-11-23

### Added
- **Local Single-File SQLite Memory Engine (`node:sqlite` + FTS5)**: Zero third-party runtime dependencies and zero native C++ build scripts; dual-track CJK 2-gram + English full-text search over extracted facts and bound original evidence segments; full schema parity (`schema_version = 1`) with Python [ZeroMem](https://github.com/IMLIULIAN/zeromem).
- **Evidence-Grounded Extraction & Pre-Write Admission Pipeline**: Short-window chunking, Chinese-priority structured extraction, optional 1-round source-grounded admission verification, deterministic rule guard, and pre-send/pre-store `[REDACTED]` credential masking.
- **Memory Governance**: Strict `until:YYYY-MM-DD` calendar expiry demotion, adaptive `2–8` relative-score gating, and lossless soft-eviction into `evicted_records` with canonical SHA-256 tamper-checked atomic restore.
- **Dual LLM Backend (Local Ollama ↔ OpenAI-Compatible API)**: Loopback proxy-bypass Ollama integration with automatic detection, silent local startup, and confirmed background pulling of `Qwen3.5-4B-Memory-V2` (`Q8_0` / `Q4_K_M`), plus live-switchable DeepSeek / OpenAI / SiliconFlow / OpenRouter / persistent Custom API support.
- **Native DeepSeek Harness Integration**: 5 lossless-JSON native tools (`zeromem_recall`, `zeromem_remember`, `zeromem_stats`, `zeromem_evict`, `zeromem_restore`) and fail-open `agent/pre-step` / `agent/turn-stopping` hooks with anti-loop markers.
- **Embedded Web & Desktop Workbench (Bonus)**: Shadow DOM floating pill and slide-over management drawer protected by loopback + same-origin security fences, supporting live search, evidence inspection, recycle bin restore, local/API switching, light/dark frosted glass styling, and custom wallpaper upload.
