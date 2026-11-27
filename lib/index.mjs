/**
 * @imliulian/dsh-zeromem — DeepSeek Harness Cordis plugin entry.
 *
 * Zero runtime third-party dependencies (Node built-in `node:sqlite` + FTS5 + HTTP/fetch).
 * Works across DSH Web, Official DSH Desktop (Electron), and Headless profiles.
 *
 * Boot safety invariant:
 *   DSH startup is all-or-nothing. Every service attachment here is isolated and 100% fail-open
 *   so missing services, offline Ollama, or bad config never prevent DSH from booting.
 */

import { attachZeroMemHooks } from "./hooks.mjs";
import { deduplicateRecallEvidence } from "./contracts.mjs";
import { ZeroMemEngine } from "./memory.mjs";
import { backupDatabase, exportMarkdown } from "./portability.mjs";
import { SQLiteMemoryStore } from "./store.mjs";
import { registerZeroMemTools } from "./tools.mjs";
import { mountWebServer, registerDesktopIndexInject } from "./web.mjs";

export const name = "zeromem";

export function apply(root, config = {}) {
  const disposers = [];

  // 1. Register Desktop Electron index-inject line synchronously BEFORE any root.inject()
  //    so official Desktop collects it during one-shot startup injection.
  try {
    disposers.push(registerDesktopIndexInject(root));
  } catch (err) {
    console.warn("[dsh-zeromem] desktop index-inject skipped:", err?.message || err);
  }

  let engine;
  try {
    engine = new ZeroMemEngine({
      configOptions: {
        initialOverrides: config && typeof config === "object" ? config : null,
      },
    });
  } catch (err) {
    console.warn("[dsh-zeromem] failed to initialize engine (degraded):", err?.message || err);
    return;
  }

  // 2. Native agent lifecycle hooks (pre-step recall + turn-stopping background remember)
  try {
    if (typeof root?.inject === "function") {
      root.inject(["agents"], (agentCtx) => {
        try {
          const dispose = attachZeroMemHooks(agentCtx, engine);
          if (typeof agentCtx?.effect === "function") {
            agentCtx.effect(() => dispose, "zeromem: agent hooks");
          } else {
            disposers.push(dispose);
          }
        } catch (err) {
          console.warn("[dsh-zeromem] agent hooks skipped:", err?.message || err);
        }
      });
    }
  } catch (err) {
    console.warn("[dsh-zeromem] agents inject failed:", err?.message || err);
  }

  // 3. Native DSH tools (zeromem_recall / remember / stats / evict / restore)
  try {
    if (typeof root?.inject === "function") {
      root.inject(["tools"], (toolCtx) => {
        try {
          const dispose = registerZeroMemTools(toolCtx, engine);
          if (typeof toolCtx?.effect === "function") {
            toolCtx.effect(() => dispose, "zeromem: tools");
          } else {
            disposers.push(dispose);
          }
        } catch (err) {
          console.warn("[dsh-zeromem] tools registration skipped:", err?.message || err);
        }
      });
    }
  } catch (err) {
    console.warn("[dsh-zeromem] tools inject failed:", err?.message || err);
  }

  // 4. Embedded Web Workbench & HTTP API (auto-skipped in headless profiles without webServer)
  try {
    if (typeof root?.inject === "function") {
      root.inject(["webServer"], (webCtx) => {
        try {
          const dispose = mountWebServer(webCtx, engine);
          if (typeof webCtx?.effect === "function") {
            webCtx.effect(() => dispose, "zeromem: web workbench");
          } else {
            disposers.push(dispose);
          }
        } catch (err) {
          console.warn("[dsh-zeromem] web workbench skipped:", err?.message || err);
        }
      });
    }
  } catch (err) {
    console.warn("[dsh-zeromem] webServer inject failed:", err?.message || err);
  }

  if (typeof root?.effect === "function") {
    root.effect(() => () => {
      for (const d of disposers) {
        if (typeof d === "function") {
          try {
            d();
          } catch {
            // ignore
          }
        }
      }
    }, "zeromem: root cleanup");
  }
}

export default { name, apply };
export { ZeroMemEngine, SQLiteMemoryStore, exportMarkdown, backupDatabase, deduplicateRecallEvidence };
