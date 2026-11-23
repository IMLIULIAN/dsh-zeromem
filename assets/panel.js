/* ZeroMem (零忆) Embedded DSH Web Workbench — Light Frosted Glass, Spring Tactile UI, Processing Halo, Auto Local Setup */
(function () {
  if (window.__DSH_ZEROMEM_LOADED__) return;
  window.__DSH_ZEROMEM_LOADED__ = true;

  const API_BASE = "/dsh-zeromem/api";
  const POS_KEY = "dsh_zeromem_pill_pos_v1";
  const THEME_CACHE_KEY = "dsh_zeromem_theme_v2";

  const ICONS = {
    brain:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.54Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.54Z"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    plus:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
    refresh:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    restore:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    sliders:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/></svg>',
    cpu:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/></svg>',
    cloud:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    bolt:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    image:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    upload:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>',
    sun:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
    moon:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    download:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
    play:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    copy:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    external:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    chevron:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  };

  const NOISE_URI =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlightRedacted(text) {
    return esc(text).replace(/\[REDACTED\]/g, '<span class="zm-redact">[REDACTED]</span>');
  }

  function formatBytes(n) {
    const v = Number(n || 0);
    if (!Number.isFinite(v) || v <= 0) return "";
    if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(2)} GB`;
    if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(0)} MB`;
    return `${Math.round(v / 1024)} KB`;
  }

  function readCachedTheme() {
    try {
      const t = localStorage.getItem(THEME_CACHE_KEY);
      return t === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function writeCachedTheme(theme) {
    try {
      localStorage.setItem(THEME_CACHE_KEY, theme === "dark" ? "dark" : "light");
    } catch {}
  }

  async function api(path, opts) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
      ...opts,
    });
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || data?.result?.message || `HTTP ${res.status}`);
    }
    return data;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("读取图片失败"));
      reader.readAsDataURL(file);
    });
  }

  async function prepareImageDataUrl(file) {
    if (!file) throw new Error("未选择图片");
    const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
    if (file.type && !allowed.has(file.type.toLowerCase())) {
      throw new Error("仅支持 PNG / JPG / WebP / GIF / AVIF 图片");
    }
    if (file.type === "image/gif") {
      if (file.size > 5.8 * 1024 * 1024) throw new Error("GIF 超过 5.8 MB，请压缩后上传");
      return fileToDataUrl(file);
    }
    const rawUrl = await fileToDataUrl(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("图片解码失败"));
      i.src = rawUrl;
    });
    const maxSide = 1920;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const needsResize = Math.max(w, h) > maxSide;
    if (!needsResize && file.size <= 1.8 * 1024 * 1024 && allowed.has((file.type || "").toLowerCase())) {
      return rawUrl;
    }
    const scale = needsResize ? maxSide / Math.max(w, h) : 1;
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return rawUrl;
    ctx2d.imageSmoothingEnabled = true;
    ctx2d.imageSmoothingQuality = "high";
    ctx2d.drawImage(img, 0, 0, cw, ch);
    let out = canvas.toDataURL("image/webp", 0.88);
    if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg", 0.88);
    return out;
  }

  const host = document.createElement("div");
  host.id = "dsh-zeromem-root";
  host.dataset.zmRev = "c9f48efabf95";
  host.style.position = "fixed";
  host.style.zIndex = "2147483000";
  host.style.inset = "0";
  host.style.pointerEvents = "none";
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;

        --zm-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
        --zm-glider-ease: cubic-bezier(0.32, 1.22, 0.54, 1);
        --zm-ease: cubic-bezier(0.22, 1, 0.36, 1);

        /* Default Light Porcelain Liquid Glass */
        --zm-text: #0f172a;
        --zm-text-2: #334155;
        --zm-muted: #64748b;
        --zm-accent: #4f46e5;
        --zm-accent-grad: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
        --zm-accent-soft: rgba(79, 70, 229, 0.11);
        --zm-accent-border: rgba(99, 102, 241, 0.36);

        --zm-pill-bg: rgba(255, 255, 255, 0.84);
        --zm-pill-border: rgba(255, 255, 255, 0.92);
        --zm-pill-shadow: 0 10px 30px -6px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.96);

        --zm-drawer-border: rgba(255, 255, 255, 0.84);
        --zm-drawer-shadow: 0 28px 72px -14px rgba(15, 23, 42, 0.18), 0 8px 24px -6px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95);
        --zm-backdrop-bg: rgba(15, 23, 42, 0.14);

        --zm-veil-r: 255; --zm-veil-g: 255; --zm-veil-b: 255;
        --zm-veil-r2: 244; --zm-veil-g2: 248; --zm-veil-b2: 255;

        --zm-surface: rgba(255, 255, 255, 0.58);
        --zm-surface-strong: rgba(255, 255, 255, 0.82);
        --zm-surface-hover: rgba(255, 255, 255, 0.90);
        --zm-surface-border: rgba(15, 23, 42, 0.085);
        --zm-surface-highlight: rgba(255, 255, 255, 0.92);
        --zm-surface-outer: rgba(15, 23, 42, 0.075);
        --zm-divider: rgba(15, 23, 42, 0.075);

        --zm-input-bg: rgba(255, 255, 255, 0.76);
        --zm-input-border: rgba(15, 23, 42, 0.12);
        --zm-input-focus: rgba(79, 70, 229, 0.48);

        --zm-tag-bg: rgba(79, 70, 229, 0.09);
        --zm-tag-text: #4338ca;
        --zm-tag-border: rgba(99, 102, 241, 0.18);
        --zm-rev-bg: rgba(16, 185, 129, 0.13);
        --zm-rev-text: #047857;
        --zm-rev-border: rgba(16, 185, 129, 0.25);
        --zm-exp-bg: rgba(245, 158, 11, 0.14);
        --zm-exp-text: #b45309;
        --zm-exp-border: rgba(245, 158, 11, 0.28);

        --zm-danger: #e11d48;
        --zm-danger-soft: rgba(244, 63, 94, 0.12);
        --zm-danger-border: rgba(244, 63, 94, 0.35);

        --zm-toast-ok-bg: rgba(236, 253, 245, 0.92);
        --zm-toast-ok-border: rgba(16, 185, 129, 0.36);
        --zm-toast-ok-text: #065f46;
        --zm-toast-err-bg: rgba(255, 241, 242, 0.94);
        --zm-toast-err-border: rgba(244, 63, 94, 0.36);
        --zm-toast-err-text: #9f1239;

        --zm-ripple-color: rgba(79, 70, 229, 0.18);
        --zm-blur: 30px;
        --zm-tint-hi: 0.56;
        --zm-tint-lo: 0.44;
        --zm-scroll-thumb: rgba(100, 116, 139, 0.28);

        color: var(--zm-text);
      }

      :host([data-theme="dark"]) {
        --zm-text: #f1f5f9;
        --zm-text-2: #cbd5e1;
        --zm-muted: #94a3b8;
        --zm-accent: #818cf8;
        --zm-accent-grad: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%);
        --zm-accent-soft: rgba(56, 189, 248, 0.16);
        --zm-accent-border: rgba(99, 102, 241, 0.48);

        --zm-pill-bg: rgba(15, 23, 42, 0.78);
        --zm-pill-border: rgba(255, 255, 255, 0.16);
        --zm-pill-shadow: 0 12px 32px rgba(2, 6, 23, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.14);

        --zm-drawer-border: rgba(255, 255, 255, 0.14);
        --zm-drawer-shadow: 0 28px 72px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 255, 255, 0.14);
        --zm-backdrop-bg: rgba(2, 6, 23, 0.42);

        --zm-veil-r: 13; --zm-veil-g: 20; --zm-veil-b: 36;
        --zm-veil-r2: 18; --zm-veil-g2: 27; --zm-veil-b2: 48;

        --zm-surface: rgba(20, 31, 52, 0.56);
        --zm-surface-strong: rgba(24, 37, 62, 0.80);
        --zm-surface-hover: rgba(30, 46, 76, 0.82);
        --zm-surface-border: rgba(255, 255, 255, 0.14);
        --zm-surface-highlight: rgba(255, 255, 255, 0.12);
        --zm-surface-outer: rgba(0, 0, 0, 0.22);
        --zm-divider: rgba(255, 255, 255, 0.08);

        --zm-input-bg: rgba(11, 18, 34, 0.64);
        --zm-input-border: rgba(148, 163, 184, 0.24);
        --zm-input-focus: rgba(56, 189, 248, 0.55);

        --zm-tag-bg: rgba(56, 189, 248, 0.14);
        --zm-tag-text: #7dd3fc;
        --zm-tag-border: rgba(56, 189, 248, 0.24);
        --zm-rev-bg: rgba(16, 185, 129, 0.16);
        --zm-rev-text: #6ee7b7;
        --zm-rev-border: rgba(16, 185, 129, 0.3);
        --zm-exp-bg: rgba(245, 158, 11, 0.18);
        --zm-exp-text: #fcd34d;
        --zm-exp-border: rgba(245, 158, 11, 0.32);

        --zm-danger: #fb7185;
        --zm-danger-soft: rgba(244, 63, 94, 0.18);
        --zm-danger-border: rgba(251, 113, 133, 0.42);

        --zm-toast-ok-bg: rgba(6, 78, 59, 0.86);
        --zm-toast-ok-border: rgba(16, 185, 129, 0.42);
        --zm-toast-ok-text: #a7f3d0;
        --zm-toast-err-bg: rgba(76, 5, 25, 0.88);
        --zm-toast-err-border: rgba(244, 63, 94, 0.42);
        --zm-toast-err-text: #fecdd3;

        --zm-ripple-color: rgba(129, 140, 248, 0.28);
        --zm-scroll-thumb: rgba(148, 163, 184, 0.28);
      }

      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

      @keyframes zm-spin {
        from { transform: translate(-50%, -50%) rotate(0deg); }
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }
      @keyframes zm-breathe {
        0%, 100% { opacity: 0.42; transform: scale(0.99); }
        50% { opacity: 0.78; transform: scale(1.035); }
      }
      @keyframes zm-pulse-dot {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.26); opacity: 0.72; }
      }
      @keyframes zm-ripple-wave {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 0.55; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
      }
      @keyframes zm-pane-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes zm-shimmer {
        from { background-position: 200% 0; }
        to { background-position: -200% 0; }
      }
      @keyframes zm-bin-bounce {
        0% { transform: scale(1); }
        32% { transform: scale(1.18, 0.86); }
        62% { transform: scale(0.94, 1.08); }
        84% { transform: scale(1.04, 0.98); }
        100% { transform: scale(1); }
      }
      .zm-tab.bin-hit { animation: zm-bin-bounce 0.42s var(--zm-spring); }
      .zm-card.zm-collapsing {
        pointer-events: none;
        overflow: hidden;
        transition: height 0.26s var(--zm-ease), padding 0.26s var(--zm-ease), margin 0.26s var(--zm-ease), opacity 0.12s ease, border-width 0.26s ease;
      }

      .zm-ripple {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
        background: var(--zm-ripple-color);
        animation: zm-ripple-wave 0.44s var(--zm-ease) forwards;
        z-index: 4;
      }
      .zm-icon-btn.primary .zm-ripple { background: rgba(255, 255, 255, 0.34); }

      /* ===== Floating Pill + Luminous Processing Halo ===== */
      .zm-pill-shell {
        position: fixed; right: 20px; bottom: 88px; pointer-events: auto;
        border-radius: 999px; padding: 2.5px;
        transition: transform 0.26s var(--zm-spring);
      }
      .zm-pill-shell:hover { transform: translateY(-2px) scale(1.015); }
      .zm-pill-shell:active { transform: translateY(0) scale(0.955); transition-duration: 0.08s; }

      .zm-pill-aura, .zm-pill-ring {
        position: absolute; border-radius: 999px; pointer-events: none;
        opacity: 0; overflow: hidden; transition: opacity 0.32s ease;
      }
      .zm-pill-aura { inset: -6px; filter: blur(12px); }
      .zm-pill-ring { inset: 0; }
      .zm-pill-aura::before, .zm-pill-ring::before {
        content: ""; position: absolute; left: 50%; top: 50%; width: 240px; height: 240px;
        background: conic-gradient(from 0deg, #38bdf8, #6366f1, #a855f7, #f472b6, #06b6d4, #38bdf8);
        animation: zm-spin 2.0s linear infinite;
      }
      .zm-pill-shell.is-busy .zm-pill-ring { opacity: 1; }
      .zm-pill-shell.is-busy .zm-pill-aura { opacity: 0.65; animation: zm-breathe 2.2s ease-in-out infinite; }

      .zm-pill {
        position: relative; z-index: 1; overflow: hidden;
        display: inline-flex; align-items: center; gap: 7px;
        height: 36px; padding: 0 13px 0 11px; border-radius: 999px;
        background: var(--zm-pill-bg); color: var(--zm-text);
        border: 1px solid var(--zm-pill-border); box-shadow: var(--zm-pill-shadow);
        backdrop-filter: blur(20px) saturate(185%); -webkit-backdrop-filter: blur(20px) saturate(185%);
        cursor: pointer; user-select: none; font-size: 12.5px; font-weight: 600;
        transition: background 0.2s ease, border-color 0.2s ease;
      }
      .zm-pill-shell.is-busy .zm-pill { border-color: transparent; }
      .zm-pill-icon { display: inline-flex; color: var(--zm-accent); }
      .zm-pill-shell.is-busy .zm-pill-icon { animation: zm-pulse-dot 1.6s ease-in-out infinite; }

      .zm-dot { width: 7.5px; height: 7.5px; border-radius: 50%; flex: none; background: #94a3b8; transition: background 0.2s, box-shadow 0.2s; }
      .zm-dot.ok { background: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18); }
      .zm-dot.api { background: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
      .zm-dot.warn { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2); }
      .zm-dot.err { background: #f43f5e; box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.2); }
      .zm-dot.busy { background: #6366f1; box-shadow: 0 0 10px rgba(99, 102, 241, 0.72); animation: zm-pulse-dot 1.2s ease-in-out infinite; }

      .zm-pill-cnt { padding: 1px 7px; border-radius: 999px; background: var(--zm-accent-soft); color: var(--zm-accent); font-size: 11px; font-weight: 700; min-width: 22px; text-align: center; }
      .zm-pill-label { max-width: 82px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* ===== Backdrop & Frosted Glass Drawer ===== */
      .zm-backdrop {
        position: fixed; inset: 0; background: var(--zm-backdrop-bg);
        backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
        pointer-events: none; opacity: 0; transition: opacity 0.24s ease;
      }
      .zm-backdrop.open { opacity: 1; pointer-events: auto; }

      .zm-drawer {
        position: fixed; top: 14px; right: 14px; bottom: 14px;
        width: min(462px, calc(100vw - 24px)); border-radius: 22px;
        border: 1px solid var(--zm-drawer-border); box-shadow: var(--zm-drawer-shadow);
        pointer-events: none; opacity: 0;
        transform: translateX(26px) scale(0.98);
        transition: transform 0.3s var(--zm-ease), opacity 0.22s ease;
        display: flex; flex-direction: column; overflow: hidden; isolation: isolate;
      }
      .zm-drawer.open { opacity: 1; transform: translateX(0) scale(1); pointer-events: auto; }

      .zm-bg-layer {
        position: absolute; inset: -28px; z-index: 0; pointer-events: none;
        background:
          radial-gradient(circle at 12% 8%, rgba(125, 211, 252, 0.74) 0%, transparent 48%),
          radial-gradient(circle at 90% 14%, rgba(196, 181, 253, 0.70) 0%, transparent 46%),
          radial-gradient(circle at 86% 86%, rgba(253, 186, 116, 0.48) 0%, transparent 48%),
          radial-gradient(circle at 14% 88%, rgba(110, 231, 183, 0.48) 0%, transparent 46%),
          linear-gradient(148deg, #f5f9ff 0%, #eef4ff 48%, #f5f0ff 100%);
        background-size: cover; background-position: center; opacity: 0.80;
        transition: opacity 0.35s ease, filter 0.2s ease;
      }
      :host([data-theme="dark"]) .zm-bg-layer {
        background:
          radial-gradient(circle at 14% 12%, rgba(56, 189, 248, 0.32) 0%, transparent 46%),
          radial-gradient(circle at 86% 18%, rgba(129, 140, 248, 0.32) 0%, transparent 46%),
          radial-gradient(circle at 80% 88%, rgba(236, 72, 153, 0.18) 0%, transparent 44%),
          radial-gradient(circle at 18% 82%, rgba(16, 185, 129, 0.18) 0%, transparent 44%),
          linear-gradient(155deg, #0b1120 0%, #0f172a 52%, #131c36 100%);
        background-size: cover; background-position: center; opacity: 0.86;
      }
      .zm-bg-layer.has-custom { opacity: 1; filter: blur(var(--zm-blur)) saturate(1.45) contrast(1.04); transform: scale(1.06); }

      .zm-glass-veil {
        position: absolute; inset: 0; z-index: 1; pointer-events: none;
        background:
          radial-gradient(120% 55% at 15% 0%, rgba(255, 255, 255, 0.52) 0%, transparent 62%),
          linear-gradient(160deg, rgba(var(--zm-veil-r), var(--zm-veil-g), var(--zm-veil-b), var(--zm-tint-hi)) 0%, rgba(var(--zm-veil-r2), var(--zm-veil-g2), var(--zm-veil-b2), var(--zm-tint-lo)) 100%);
        backdrop-filter: blur(var(--zm-blur)) saturate(185%) brightness(1.03);
        -webkit-backdrop-filter: blur(var(--zm-blur)) saturate(185%) brightness(1.03);
      }
      :host([data-theme="dark"]) .zm-glass-veil {
        background:
          radial-gradient(120% 50% at 15% 0%, rgba(255, 255, 255, 0.08) 0%, transparent 58%),
          linear-gradient(160deg, rgba(var(--zm-veil-r), var(--zm-veil-g), var(--zm-veil-b), var(--zm-tint-hi)) 0%, rgba(var(--zm-veil-r2), var(--zm-veil-g2), var(--zm-veil-b2), var(--zm-tint-lo)) 100%);
        backdrop-filter: blur(var(--zm-blur)) saturate(165%) brightness(0.96);
        -webkit-backdrop-filter: blur(var(--zm-blur)) saturate(165%) brightness(0.96);
      }
      .zm-glass-veil::after {
        content: ""; position: absolute; inset: 0;
        background-image: url("${NOISE_URI}"); background-size: 160px 160px;
        opacity: 0.032; mix-blend-mode: overlay;
      }

      .zm-drawer-inner { position: relative; z-index: 2; display: flex; flex-direction: column; height: 100%; min-height: 0; }

      /* Header */
      .zm-head {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 12px 15px 11px; border-bottom: 1px solid var(--zm-divider);
      }
      .zm-brand { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 auto; }
      .zm-brand-orb {
        position: relative; width: 34px; height: 34px; border-radius: 50%; padding: 2px;
        flex: none; display: flex; align-items: center; justify-content: center;
      }
      .zm-orb-ring, .zm-orb-aura {
        position: absolute; border-radius: 50%; overflow: hidden; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
      }
      .zm-orb-ring { inset: 0; }
      .zm-orb-aura { inset: -5px; filter: blur(8px); }
      .zm-orb-ring::before, .zm-orb-aura::before {
        content: ""; position: absolute; left: 50%; top: 50%; width: 62px; height: 62px;
        background: conic-gradient(from 0deg, #38bdf8, #6366f1, #a855f7, #f472b6, #06b6d4, #38bdf8);
        animation: zm-spin 1.7s linear infinite;
      }
      .zm-brand-orb.is-busy .zm-orb-ring { opacity: 1; }
      .zm-brand-orb.is-busy .zm-orb-aura { opacity: 0.72; animation: zm-breathe 2s ease-in-out infinite; }
      .zm-orb-core {
        position: relative; z-index: 1; width: 100%; height: 100%; border-radius: 50%;
        background: var(--zm-surface-strong); border: 1px solid var(--zm-surface-border);
        color: var(--zm-accent); display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px var(--zm-surface-outer), inset 0 1px 0 var(--zm-surface-highlight);
      }
      .zm-brand-orb.is-busy .zm-orb-core { border-color: transparent; }

      .zm-brand-meta { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; flex: 1 1 auto; }
      .zm-title { font-size: 14px; font-weight: 700; line-height: 1.1; color: var(--zm-text); letter-spacing: -0.01em; white-space: nowrap; }
      .zm-mode-badge {
        display: inline-flex; align-items: center; gap: 5px; padding: 1.5px 8px; border-radius: 999px;
        font-size: 10.5px; font-weight: 600; line-height: 1.3;
        background: var(--zm-surface); border: 1px solid var(--zm-surface-border); color: var(--zm-text-2);
        max-width: 100%; overflow: hidden;
        box-shadow: 0 1px 3px var(--zm-surface-outer), inset 0 1px 0 var(--zm-surface-highlight);
      }
      #zmModeText { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .zm-head-actions { display: flex; align-items: center; gap: 5px; flex: none; }

      /* Spring Tactile Buttons */
      .zm-icon-btn {
        position: relative; overflow: hidden;
        display: inline-flex; align-items: center; justify-content: center; gap: 5px;
        height: 32px; min-width: 32px; padding: 0 11px; border-radius: 10px;
        border: 1px solid var(--zm-surface-border); background: var(--zm-surface); color: var(--zm-text-2);
        cursor: pointer; font-size: 12px; font-weight: 600; line-height: 1; white-space: nowrap; flex-shrink: 0;
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        box-shadow: 0 1px 4px var(--zm-surface-outer), inset 0 1px 0 var(--zm-surface-highlight);
        transition: transform 0.24s var(--zm-spring), background 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.18s ease;
      }
      .zm-icon-btn svg { flex: none; display: block; }
      .zm-icon-btn:hover { background: var(--zm-surface-hover); border-color: var(--zm-accent-border); color: var(--zm-text); transform: translateY(-1px); }
      .zm-icon-btn:active { transform: scale(0.945); transition-duration: 0.08s; box-shadow: 0 0 2px var(--zm-surface-outer); }
      .zm-icon-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
      .zm-icon-btn.square { padding: 0; width: 32px; min-width: 32px; }
      .zm-head-actions .zm-icon-btn { height: 30px; min-width: 30px; padding: 0 10px; border-radius: 9px; }
      .zm-head-actions .zm-icon-btn.square { width: 30px; padding: 0; }
      .zm-icon-btn.primary {
        background: var(--zm-accent-grad); border-color: transparent; color: #ffffff;
        box-shadow: 0 4px 14px -3px rgba(79, 70, 229, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35);
      }
      .zm-icon-btn.primary:hover { filter: brightness(1.06); color: #ffffff; }
      .zm-icon-btn.danger:hover, .zm-icon-btn.confirming {
        background: var(--zm-danger-soft); border-color: var(--zm-danger-border); color: var(--zm-danger);
      }
      .zm-icon-btn.confirming { width: auto !important; padding: 0 9px !important; }
      .zm-icon-btn.has-dot::after {
        content: ""; position: absolute; top: 4px; right: 4px; width: 6px; height: 6px; border-radius: 50%;
        background: var(--zm-accent); box-shadow: 0 0 0 2px var(--zm-surface-strong); z-index: 2;
      }

      /* Segmented Glass Tabs with Spring Glider */
      .zm-tabs-wrap { padding: 9px 15px 6px; }
      .zm-tabs {
        position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
        padding: 4px; border-radius: 13px;
        background: rgba(148, 163, 184, 0.14); border: 1px solid var(--zm-divider);
      }
      .zm-tab-glider {
        position: absolute; top: 4px; left: 4px; bottom: 4px;
        width: calc((100% - 16px) / 3); border-radius: 9.5px;
        background: var(--zm-surface-strong); border: 1px solid var(--zm-surface-border);
        box-shadow: 0 2px 10px var(--zm-surface-outer), inset 0 1px 0 var(--zm-surface-highlight);
        transform: translateX(calc(var(--zm-tab-idx, 0) * (100% + 4px)));
        transition: transform 0.32s var(--zm-glider-ease);
        pointer-events: none; z-index: 0;
      }
      .zm-tab {
        position: relative; z-index: 1; overflow: hidden;
        display: inline-flex; align-items: center; justify-content: center; gap: 5px;
        height: 31px; padding: 0 8px; border-radius: 9.5px; border: none; background: transparent;
        color: var(--zm-muted); font-size: 12px; font-weight: 600; white-space: nowrap; cursor: pointer;
        transition: color 0.18s ease, transform 0.22s var(--zm-spring);
      }
      .zm-tab:hover { color: var(--zm-text); }
      .zm-tab:active { transform: scale(0.955); transition-duration: 0.08s; }
      .zm-tab.active { color: var(--zm-text); }
      .zm-tab-cnt {
        font-size: 10.5px; font-weight: 700; color: var(--zm-accent); background: var(--zm-accent-soft);
        padding: 0 6px; height: 17px; line-height: 17px; border-radius: 999px;
      }

      /* Scrollable Body */
      .zm-body { flex: 1; overflow-y: auto; scrollbar-gutter: stable; padding: 8px 15px 16px; display: flex; flex-direction: column; gap: 10px; }
      .zm-body::-webkit-scrollbar { width: 5px; }
      .zm-body::-webkit-scrollbar-track { background: transparent; }
      .zm-body::-webkit-scrollbar-thumb { background: var(--zm-scroll-thumb); border-radius: 999px; }

      .zm-pane { display: none; flex-direction: column; gap: 9px; }
      .zm-pane.active { display: flex; animation: zm-pane-in 0.22s var(--zm-ease); }

      .zm-bar { display: flex; gap: 7px; align-items: center; min-width: 0; }
      .zm-bar > .zm-input { flex: 1 1 auto; min-width: 0; width: auto; }
      .zm-bar > .zm-search-wrap { flex: 1 1 auto; min-width: 0; }
      .zm-bar > .zm-select { flex: 0 0 auto; }
      .zm-bar > .zm-ns-dd { flex: 0 0 128px; width: 128px; }
      .zm-bar > .zm-switch { flex: 0 0 auto; white-space: nowrap; height: 34px; }
      .zm-bar > .zm-icon-btn { height: 34px; }
      .zm-bar > .zm-icon-btn.square { width: 34px; min-width: 34px; }

      /* Fixed-Width Frosted Glass Dropdown (zero layout shift on selection) */
      .zm-ns-dd { position: relative; }
      .zm-ns-trigger {
        position: relative; overflow: hidden; width: 100%; height: 34px;
        display: inline-flex; align-items: center; justify-content: space-between; gap: 6px;
        padding: 0 9px 0 11px; border-radius: 10px;
        background: var(--zm-input-bg); color: var(--zm-text);
        border: 1px solid var(--zm-input-border); font-size: 12px; font-weight: 600;
        cursor: pointer; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        transition: border-color 0.16s ease, background 0.16s ease, transform 0.22s var(--zm-spring), box-shadow 0.16s ease;
      }
      .zm-ns-trigger:hover { background: var(--zm-surface-strong); border-color: var(--zm-accent-border); }
      .zm-ns-trigger:active { transform: scale(0.965); transition-duration: 0.08s; }
      .zm-ns-dd.open .zm-ns-trigger {
        border-color: var(--zm-input-focus); background: var(--zm-surface-strong);
        box-shadow: 0 0 0 3px var(--zm-accent-soft);
      }
      .zm-ns-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; text-align: left; }
      .zm-ns-chev { display: inline-flex; flex: none; color: var(--zm-muted); transition: transform 0.22s var(--zm-ease); }
      .zm-ns-dd.open .zm-ns-chev { transform: rotate(180deg); color: var(--zm-accent); }

      .zm-ns-menu {
        position: absolute; top: calc(100% + 6px); right: 0; min-width: 172px; max-width: 240px; max-height: 220px;
        overflow-y: auto; padding: 5px; border-radius: 13px; z-index: 30;
        background: var(--zm-surface-strong); border: 1px solid var(--zm-surface-border);
        box-shadow: 0 16px 36px -8px rgba(15, 23, 42, 0.22), 0 4px 12px rgba(15, 23, 42, 0.08), inset 0 1px 0 var(--zm-surface-highlight);
        backdrop-filter: blur(24px) saturate(185%); -webkit-backdrop-filter: blur(24px) saturate(185%);
        display: flex; flex-direction: column; gap: 2px;
        opacity: 0; pointer-events: none; transform-origin: top right;
        transform: translateY(-6px) scale(0.96);
        transition: opacity 0.16s ease, transform 0.22s var(--zm-spring);
      }
      .zm-ns-dd.open .zm-ns-menu { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1); }
      .zm-ns-opt {
        position: relative; overflow: hidden; width: 100%; border: none; background: transparent;
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 7px 9px; border-radius: 8.5px; color: var(--zm-text-2);
        font-size: 12px; font-weight: 600; text-align: left; cursor: pointer;
        transition: background 0.14s ease, color 0.14s ease, transform 0.18s var(--zm-spring);
      }
      .zm-ns-opt:hover { background: var(--zm-accent-soft); color: var(--zm-text); }
      .zm-ns-opt:active { transform: scale(0.975); transition-duration: 0.07s; }
      .zm-ns-opt.active { background: var(--zm-accent-soft); color: var(--zm-accent); }
      .zm-ns-opt-txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .zm-ns-opt-chk { flex: none; display: inline-flex; opacity: 0; color: var(--zm-accent); }
      .zm-ns-opt.active .zm-ns-opt-chk { opacity: 1; }

      .zm-search-wrap { position: relative; flex: 1 1 auto; min-width: 0; display: flex; align-items: center; }
      .zm-search-ic { position: absolute; left: 10px; color: var(--zm-muted); display: inline-flex; pointer-events: none; }
      .zm-search-wrap .zm-input { padding-left: 31px; }

      .zm-input, .zm-select, .zm-textarea {
        width: 100%; background: var(--zm-input-bg); color: var(--zm-text);
        border: 1px solid var(--zm-input-border); border-radius: 10px; padding: 0 11px;
        font-size: 12.5px; outline: none; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
      }
      .zm-input, .zm-select { height: 34px; line-height: 32px; }
      .zm-input::placeholder, .zm-textarea::placeholder { color: var(--zm-muted); }
      .zm-input:focus, .zm-select:focus, .zm-textarea:focus {
        border-color: var(--zm-input-focus); background: var(--zm-surface-strong); box-shadow: 0 0 0 3px var(--zm-accent-soft);
      }
      .zm-select { width: auto; max-width: 136px; cursor: pointer; }
      .zm-textarea { min-height: 86px; padding: 9px 11px; resize: vertical; line-height: 1.5; }
      .zm-meta-row { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--zm-muted); padding: 0 2px; }

      /* Smooth Accordion Quick Add */
      .zm-add-wrap {
        display: grid; grid-template-rows: 0fr; opacity: 0; margin-top: -10px;
        transition: grid-template-rows 0.28s var(--zm-ease), opacity 0.2s ease, margin-top 0.24s ease;
      }
      .zm-add-wrap.open { grid-template-rows: 1fr; opacity: 1; margin-top: 0; }
      .zm-add-clip { overflow: hidden; }
      .zm-add-box {
        background: var(--zm-surface-strong); border: 1px solid var(--zm-accent-border);
        border-radius: 14px; padding: 10px 11px; display: flex; flex-direction: column; gap: 8px;
        box-shadow: 0 6px 20px -6px rgba(79, 70, 229, 0.16);
      }

      /* Secondary Frosted Cards + Smooth Evidence Expand */
      .zm-card {
        background: var(--zm-surface); border: 1px solid var(--zm-surface-border);
        border-radius: 14px; padding: 11px 12px; display: flex; flex-direction: column; gap: 6px;
        backdrop-filter: blur(14px) saturate(150%); -webkit-backdrop-filter: blur(14px) saturate(150%);
        box-shadow: 0 3px 14px -4px var(--zm-surface-outer), inset 0 1px 0 var(--zm-surface-highlight);
        transition: transform 0.24s var(--zm-spring), background 0.18s ease, border-color 0.18s ease, box-shadow 0.2s ease;
      }
      .zm-card:hover { background: var(--zm-surface-hover); border-color: var(--zm-accent-border); transform: translateY(-1px); }
      .zm-card-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
      .zm-tags { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
      .zm-tag {
        font-size: 10.5px; font-weight: 600; padding: 1.5px 7px; border-radius: 999px; white-space: nowrap;
        background: var(--zm-tag-bg); color: var(--zm-tag-text); border: 1px solid var(--zm-tag-border);
      }
      .zm-tag.rev { background: var(--zm-rev-bg); color: var(--zm-rev-text); border-color: var(--zm-rev-border); }
      .zm-tag.exp { background: var(--zm-exp-bg); color: var(--zm-exp-text); border-color: var(--zm-exp-border); }

      .zm-fact-text {
        font-size: 12.8px; line-height: 1.56; color: var(--zm-text); word-break: break-word; cursor: pointer;
        border-radius: 6px; transition: opacity 0.14s ease;
      }
      .zm-fact-text:active { opacity: 0.78; }

      .zm-evidence-wrap {
        display: grid; grid-template-rows: 0fr; opacity: 0; margin-top: 0;
        transition: grid-template-rows 0.26s var(--zm-ease), opacity 0.2s ease, margin-top 0.22s ease;
      }
      .zm-evidence-wrap.open { grid-template-rows: 1fr; opacity: 1; margin-top: 3px; }
      .zm-evidence-clip { overflow: hidden; }
      .zm-evidence {
        padding: 8px 10px; border-radius: 10px; background: var(--zm-input-bg);
        border: 1px solid var(--zm-divider); font-size: 11.5px; color: var(--zm-text-2); line-height: 1.5;
      }
      .zm-ev-item { margin-bottom: 5px; }
      .zm-ev-item:last-child { margin-bottom: 0; }
      .zm-ev-id { color: var(--zm-accent); font-weight: 700; margin-right: 5px; }
      .zm-redact {
        background: var(--zm-exp-bg); color: var(--zm-exp-text); border: 1px solid var(--zm-exp-border);
        padding: 0 4px; border-radius: 5px; font-weight: 700;
      }

      /* Minimal Appearance Card (Theme + Wallpaper Upload ONLY) */
      .zm-glass-section {
        background: var(--zm-surface); border: 1px solid var(--zm-surface-border);
        border-radius: 15px; padding: 11px 12px; display: flex; flex-direction: column; gap: 9px;
        backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
        box-shadow: 0 3px 14px -4px var(--zm-surface-outer), inset 0 1px 0 var(--zm-surface-highlight);
      }
      .zm-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .zm-section-title { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--zm-text); }

      .zm-theme-seg {
        position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 3px; border-radius: 10px;
        background: rgba(148, 163, 184, 0.16); border: 1px solid var(--zm-divider); gap: 2px; min-width: 104px;
      }
      .zm-theme-glider {
        position: absolute; top: 3px; left: 3px; bottom: 3px; width: calc((100% - 8px) / 2);
        border-radius: 7.5px; background: var(--zm-surface-strong); border: 1px solid var(--zm-surface-border);
        box-shadow: 0 1px 5px var(--zm-surface-outer);
        transform: translateX(calc(var(--zm-theme-idx, 0) * (100% + 2px)));
        transition: transform 0.3s var(--zm-glider-ease); pointer-events: none; z-index: 0;
      }
      .zm-theme-opt {
        position: relative; z-index: 1; overflow: hidden;
        display: inline-flex; align-items: center; justify-content: center; gap: 4px;
        height: 24px; padding: 0 9px; border-radius: 7.5px; border: none; background: transparent;
        color: var(--zm-muted); font-size: 11px; font-weight: 600; white-space: nowrap; cursor: pointer;
        transition: color 0.18s ease, transform 0.2s var(--zm-spring);
      }
      .zm-theme-opt:active { transform: scale(0.93); transition-duration: 0.08s; }
      .zm-theme-opt.active { color: var(--zm-text); }

      .zm-bg-drop {
        position: relative; height: 64px; border-radius: 12px;
        border: 1.5px dashed var(--zm-input-border); background: var(--zm-input-bg);
        overflow: hidden; display: flex; align-items: center; justify-content: space-between;
        padding: 8px 10px; gap: 8px; cursor: pointer;
        transition: border-color 0.18s ease, transform 0.24s var(--zm-spring), background 0.18s ease;
      }
      .zm-bg-drop:hover, .zm-bg-drop.dragover { border-color: var(--zm-accent); background: var(--zm-surface-hover); }
      .zm-bg-drop:active { transform: scale(0.985); transition-duration: 0.08s; }
      .zm-bg-preview { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.48; pointer-events: none; }
      .zm-bg-drop-info { position: relative; z-index: 1; display: flex; align-items: center; gap: 9px; min-width: 0; }
      .zm-bg-badge {
        width: 34px; height: 34px; border-radius: 10px; background: var(--zm-surface-strong);
        border: 1px solid var(--zm-surface-border); color: var(--zm-accent);
        display: flex; align-items: center; justify-content: center; flex: none;
      }
      .zm-bg-drop-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .zm-bg-drop-title { font-size: 12px; font-weight: 700; color: var(--zm-text); }
      .zm-bg-drop-sub { font-size: 10.5px; color: var(--zm-muted); }
      .zm-bg-drop-actions { position: relative; z-index: 1; display: flex; align-items: center; gap: 5px; flex: none; }

      /* Auto-Detect Local Setup Banner & Card */
      .zm-setup-banner, .zm-setup-card {
        background: var(--zm-surface-strong); border: 1px solid var(--zm-accent-border);
        border-radius: 13px; padding: 10px 11px; display: none; flex-direction: column; gap: 8px;
        box-shadow: 0 4px 16px -6px rgba(79, 70, 229, 0.2), inset 0 1px 0 var(--zm-surface-highlight);
      }
      .zm-setup-banner.show, .zm-setup-card.show { display: flex; animation: zm-pane-in 0.22s var(--zm-ease); }
      .zm-setup-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      .zm-setup-title { font-size: 12px; font-weight: 700; color: var(--zm-text); display: inline-flex; align-items: center; gap: 6px; }
      .zm-setup-sub { font-size: 11px; color: var(--zm-muted); line-height: 1.45; }
      .zm-setup-btns { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .zm-prog-track {
        width: 100%; height: 6px; border-radius: 999px; background: var(--zm-accent-soft); overflow: hidden;
      }
      .zm-prog-fill {
        height: 100%; width: 0%; border-radius: 999px;
        background: linear-gradient(90deg, #38bdf8, #6366f1, #a855f7, #38bdf8);
        background-size: 200% 100%; animation: zm-shimmer 2.2s linear infinite;
        transition: width 0.26s var(--zm-ease);
      }

      /* Provider Switch Cards (clean, no subtitle) */
      .zm-provider-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .zm-pcard {
        position: relative; overflow: hidden; padding: 11px 12px; border-radius: 13px;
        border: 1px solid var(--zm-surface-border); background: var(--zm-surface);
        cursor: pointer; color: var(--zm-text-2);
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        transition: transform 0.24s var(--zm-spring), background 0.16s ease, border-color 0.16s ease, box-shadow 0.18s ease;
      }
      .zm-pcard:hover { background: var(--zm-surface-hover); transform: translateY(-1px); }
      .zm-pcard:active { transform: scale(0.96); transition-duration: 0.08s; }
      .zm-pcard.active {
        border-color: var(--zm-accent-border); background: var(--zm-surface-strong); color: var(--zm-text);
        box-shadow: 0 4px 16px -4px rgba(79, 70, 229, 0.22), inset 0 0 0 1px var(--zm-accent-soft);
      }
      .zm-pcard-h { display: flex; align-items: center; gap: 7px; font-size: 12.8px; font-weight: 700; white-space: nowrap; }
      .zm-pcard.active .zm-pcard-h svg { color: var(--zm-accent); }

      /* Dedicated Local Model One-Click Install Option Row */
      .zm-install-opt {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 9px 11px; border-radius: 13px;
        background: var(--zm-surface-strong); border: 1px solid var(--zm-accent-border);
        box-shadow: 0 3px 12px -4px rgba(79, 70, 229, 0.16), inset 0 1px 0 var(--zm-surface-highlight);
      }
      .zm-install-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .zm-install-title { font-size: 12px; font-weight: 700; color: var(--zm-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .zm-install-author { font-size: 10.5px; font-weight: 600; color: var(--zm-accent); }

      /* Frosted Glass Confirm Modal inside Drawer */
      .zm-modal-mask {
        position: absolute; inset: 0; z-index: 40;
        background: rgba(15, 23, 42, 0.24);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center; padding: 18px;
        opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
      }
      .zm-modal-mask.open { opacity: 1; pointer-events: auto; }
      .zm-modal {
        width: 100%; max-width: 368px; border-radius: 18px; padding: 15px 15px 14px;
        background: var(--zm-surface-strong); border: 1px solid var(--zm-surface-border);
        box-shadow: 0 24px 56px -12px rgba(15, 23, 42, 0.28), inset 0 1px 0 var(--zm-surface-highlight);
        backdrop-filter: blur(26px) saturate(185%); -webkit-backdrop-filter: blur(26px) saturate(185%);
        display: flex; flex-direction: column; gap: 11px;
        transform: scale(0.93) translateY(8px);
        transition: transform 0.28s var(--zm-spring);
      }
      .zm-modal-mask.open .zm-modal { transform: scale(1) translateY(0); }
      .zm-modal-title { font-size: 14px; font-weight: 700; color: var(--zm-text); display: flex; align-items: center; gap: 7px; }
      .zm-modal-sub { font-size: 11.5px; color: var(--zm-text-2); line-height: 1.5; }
      .zm-ver-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
      .zm-ver-card {
        position: relative; overflow: hidden; padding: 9px 10px; border-radius: 12px;
        border: 1px solid var(--zm-surface-border); background: var(--zm-surface);
        color: var(--zm-text-2); text-align: left; cursor: pointer;
        display: flex; flex-direction: column; gap: 2px;
        transition: transform 0.22s var(--zm-spring), border-color 0.16s ease, background 0.16s ease;
      }
      .zm-ver-card:hover { background: var(--zm-surface-hover); }
      .zm-ver-card:active { transform: scale(0.96); transition-duration: 0.08s; }
      .zm-ver-card.active {
        border-color: var(--zm-accent-border); background: var(--zm-accent-soft); color: var(--zm-text);
        box-shadow: inset 0 0 0 1px var(--zm-accent-border);
      }
      .zm-ver-name { font-size: 12px; font-weight: 700; }
      .zm-ver-size { font-size: 10.5px; color: var(--zm-muted); }
      .zm-modal-note {
        font-size: 11px; color: var(--zm-muted); line-height: 1.45;
        padding: 7px 9px; border-radius: 10px; background: var(--zm-input-bg); border: 1px solid var(--zm-divider);
      }
      .zm-modal-foot { display: flex; align-items: center; justify-content: flex-end; gap: 7px; flex-wrap: wrap; }

      .zm-field { display: flex; flex-direction: column; gap: 4px; }
      .zm-label { font-size: 11px; font-weight: 600; color: var(--zm-muted); display: flex; justify-content: space-between; align-items: center; }
      .zm-presets { display: flex; flex-wrap: wrap; gap: 5px; }
      .zm-chip {
        position: relative; overflow: hidden; padding: 4px 10px; border-radius: 999px;
        border: 1px solid var(--zm-surface-border); background: var(--zm-surface); color: var(--zm-text-2);
        font-size: 11px; font-weight: 600; white-space: nowrap; cursor: pointer;
        transition: transform 0.22s var(--zm-spring), border-color 0.14s ease, background 0.14s ease, color 0.14s ease;
      }
      .zm-chip:hover { border-color: var(--zm-accent-border); background: var(--zm-surface-strong); color: var(--zm-accent); transform: translateY(-1px); }
      .zm-chip.active { border-color: var(--zm-accent-border); background: var(--zm-accent-soft); color: var(--zm-accent); }
      .zm-chip:active { transform: scale(0.93); transition-duration: 0.08s; }
      .zm-custom-hint { font-size: 10.5px; color: var(--zm-muted); line-height: 1.45; display: none; }
      .zm-custom-hint.show { display: block; animation: zm-pane-in 0.18s var(--zm-ease); }

      .zm-switches { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .zm-switch {
        display: flex; align-items: center; justify-content: space-between; gap: 6px;
        padding: 7.5px 10px; border-radius: 11px; background: var(--zm-surface);
        border: 1px solid var(--zm-surface-border); font-size: 11.5px; font-weight: 600;
        color: var(--zm-text-2); cursor: pointer;
        transition: background 0.14s ease, transform 0.2s var(--zm-spring);
      }
      .zm-switch:hover { background: var(--zm-surface-hover); color: var(--zm-text); }
      .zm-switch:active { transform: scale(0.97); transition-duration: 0.08s; }
      .zm-switch input { accent-color: var(--zm-accent); cursor: pointer; }

      .zm-toast {
        padding: 8px 11px; border-radius: 11px; font-size: 11.5px; font-weight: 600; line-height: 1.45;
        display: none; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      }
      .zm-toast.ok { display: block; animation: zm-pane-in 0.18s var(--zm-ease); background: var(--zm-toast-ok-bg); border: 1px solid var(--zm-toast-ok-border); color: var(--zm-toast-ok-text); }
      .zm-toast.err { display: block; animation: zm-pane-in 0.18s var(--zm-ease); background: var(--zm-toast-err-bg); border: 1px solid var(--zm-toast-err-border); color: var(--zm-toast-err-text); }

      .zm-empty {
        text-align: center; padding: 36px 14px; color: var(--zm-muted); font-size: 12px; line-height: 1.65;
        border-radius: 14px; background: var(--zm-surface); border: 1px dashed var(--zm-input-border);
      }

      details.zm-help {
        background: var(--zm-surface); border: 1px solid var(--zm-surface-border);
        border-radius: 12px; padding: 8px 11px; font-size: 11px; color: var(--zm-muted);
      }
      details.zm-help summary { cursor: pointer; color: var(--zm-text-2); font-weight: 600; }
      details.zm-help code { background: var(--zm-accent-soft); padding: 1px 5px; border-radius: 5px; color: var(--zm-accent); font-size: 10.5px; }

      @media (prefers-reduced-motion: reduce) {
        .zm-pill-ring::before, .zm-pill-aura::before, .zm-orb-ring::before, .zm-orb-aura::before { animation-duration: 12s; }
        .zm-ripple { display: none; }
      }
    </style>

    <!-- Floating Draggable Glass Pill with Processing Halo -->
    <div class="zm-pill-shell" id="zmPillShell">
      <div class="zm-pill-aura" aria-hidden="true"></div>
      <div class="zm-pill-ring" aria-hidden="true"></div>
      <button class="zm-pill" id="zmPill" type="button" aria-label="打开 ZeroMem 记忆工作台" title="ZeroMem 记忆工作台（可拖动）">
        <span class="zm-dot" id="zmPillDot"></span>
        <span class="zm-pill-icon">${ICONS.brain}</span>
        <span class="zm-pill-label" id="zmPillLabel">零忆</span>
        <span class="zm-pill-cnt" id="zmPillCnt">0</span>
      </button>
    </div>

    <div class="zm-backdrop" id="zmBackdrop"></div>

    <!-- Embedded Frosted Glass Drawer -->
    <aside class="zm-drawer" id="zmDrawer" role="dialog" aria-label="ZeroMem 记忆工作台">
      <div class="zm-bg-layer" id="zmBgLayer" aria-hidden="true"></div>
      <div class="zm-glass-veil" aria-hidden="true"></div>

      <div class="zm-drawer-inner">
        <header class="zm-head">
          <div class="zm-brand">
            <div class="zm-brand-orb" id="zmBrandOrb" aria-hidden="true">
              <div class="zm-orb-aura"></div>
              <div class="zm-orb-ring"></div>
              <div class="zm-orb-core">${ICONS.brain}</div>
            </div>
            <div class="zm-brand-meta">
              <span class="zm-title">ZeroMem</span>
              <span class="zm-mode-badge" id="zmModeBadge" title="当前后端状态">
                <span class="zm-dot" id="zmHeadDot"></span>
                <span id="zmModeText">加载中</span>
              </span>
            </div>
          </div>

          <div class="zm-head-actions">
            <button class="zm-icon-btn primary" id="zmAddToggle" type="button" aria-label="写入记忆" title="手动写入一条记忆">${ICONS.plus}<span>写入</span></button>
            <button class="zm-icon-btn square" id="zmBgQuickBtn" type="button" aria-label="上传背景图" title="上传自定义背景图">${ICONS.image}</button>
            <button class="zm-icon-btn square" id="zmThemeBtn" type="button" aria-label="切换亮暗主题" title="切换亮色 / 暗色">${ICONS.moon}</button>
            <button class="zm-icon-btn square" id="zmRefreshBtn" type="button" aria-label="刷新" title="刷新状态与列表">${ICONS.refresh}</button>
            <button class="zm-icon-btn square" id="zmCloseBtn" type="button" aria-label="关闭" title="关闭 (Esc)">${ICONS.close}</button>
          </div>
        </header>

        <input id="zmBgFileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" style="display:none;" />

        <div class="zm-tabs-wrap">
          <nav class="zm-tabs" id="zmTabsNav" role="tablist">
            <span class="zm-tab-glider" aria-hidden="true"></span>
            <button class="zm-tab active" data-tab="memories" data-idx="0" type="button" role="tab" aria-selected="true">${ICONS.search}<span>记忆</span><span class="zm-tab-cnt" id="zmTabMemCnt">0</span></button>
            <button class="zm-tab" data-tab="recycle" data-idx="1" type="button" role="tab" aria-selected="false">${ICONS.restore}<span>回收站</span><span class="zm-tab-cnt" id="zmTabRecCnt">0</span></button>
            <button class="zm-tab" data-tab="settings" data-idx="2" type="button" role="tab" aria-selected="false">${ICONS.sliders}<span>设置</span></button>
          </nav>
        </div>

        <div class="zm-body" id="zmBody">
          <div class="zm-toast" id="zmToast"></div>

          <!-- Smooth Accordion Quick Add -->
          <div class="zm-add-wrap" id="zmAddWrap">
            <div class="zm-add-clip">
              <section class="zm-add-box" id="zmAddBox">
                <textarea class="zm-textarea" id="zmAddText" placeholder="输入决议、配置或笔记（敏感密钥自动脱敏为 [REDACTED]）..."></textarea>
                <div class="zm-bar">
                  <input class="zm-input" id="zmAddNs" placeholder="空间名（默认 default）" />
                  <label class="zm-switch" style="padding:0 10px;" title="入库前 1 轮原文对照审校">
                    <span>审校</span>
                    <input type="checkbox" id="zmAddVerify" checked />
                  </label>
                  <button class="zm-icon-btn primary" id="zmAddSubmit" type="button">${ICONS.check}<span>入库</span></button>
                </div>
              </section>
            </div>
          </div>

          <!-- Tab 1: Memories -->
          <section id="zmPaneMemories" class="zm-pane active">
            <div class="zm-setup-banner" id="zmTopSetupBanner"></div>
            <div class="zm-bar">
              <div class="zm-search-wrap">
                <span class="zm-search-ic">${ICONS.search}</span>
                <input class="zm-input" id="zmSearchInput" placeholder="检索事实与原文..." />
              </div>
              <div class="zm-ns-dd" id="zmNsDd">
                <button class="zm-ns-trigger" id="zmNsTrigger" type="button" aria-haspopup="listbox" aria-expanded="false" title="全部空间">
                  <span class="zm-ns-label" id="zmNsLabel">全部空间</span>
                  <span class="zm-ns-chev">${ICONS.chevron}</span>
                </button>
                <div class="zm-ns-menu" id="zmNsMenu" role="listbox" aria-label="空间筛选"></div>
              </div>
            </div>
            <div class="zm-meta-row">
              <span id="zmSearchMeta">就绪</span>
              <span id="zmStatsMeta"></span>
            </div>
            <div id="zmList" style="display:flex;flex-direction:column;gap:8px;"></div>
          </section>

          <!-- Tab 2: Recycle Bin -->
          <section id="zmPaneRecycle" class="zm-pane">
            <div class="zm-meta-row">
              <span>软淘汰保留原文与 SHA-256 指纹</span>
              <button class="zm-icon-btn" id="zmEvictExpiredBtn" type="button" title="将已过期的 until: 记忆移入回收站">${ICONS.trash}<span>清过期</span></button>
            </div>
            <div id="zmRecycleList" style="display:flex;flex-direction:column;gap:8px;"></div>
          </section>

          <!-- Tab 3: Settings -->
          <section id="zmPaneSettings" class="zm-pane">
            <!-- Minimal Appearance Card: ONLY Light/Dark + Wallpaper Upload -->
            <div class="zm-glass-section">
              <div class="zm-section-head">
                <span class="zm-section-title">${ICONS.image}<span>外观</span></span>
                <div class="zm-theme-seg" id="zmThemeSeg" role="group" aria-label="主题模式">
                  <span class="zm-theme-glider" aria-hidden="true"></span>
                  <button class="zm-theme-opt active" id="zmThemeLightBtn" type="button" title="亮色模式">${ICONS.sun}<span>亮</span></button>
                  <button class="zm-theme-opt" id="zmThemeDarkBtn" type="button" title="暗色模式">${ICONS.moon}<span>暗</span></button>
                </div>
              </div>

              <div class="zm-bg-drop" id="zmBgDrop" role="button" tabindex="0" aria-label="上传或拖拽自定义背景图" title="点击选择或拖入背景图片">
                <div class="zm-bg-preview" id="zmBgPreview"></div>
                <div class="zm-bg-drop-info">
                  <div class="zm-bg-badge">${ICONS.upload}</div>
                  <div class="zm-bg-drop-text">
                    <span class="zm-bg-drop-title" id="zmBgDropTitle">上传背景图</span>
                    <span class="zm-bg-drop-sub" id="zmBgDropSub">点击或拖入 · 自动毛玻璃</span>
                  </div>
                </div>
                <div class="zm-bg-drop-actions">
                  <button class="zm-icon-btn square danger" id="zmClearBgBtn" type="button" aria-label="清除背景图" title="恢复默认毛玻璃" style="display:none;">${ICONS.trash}</button>
                </div>
              </div>
            </div>

            <!-- Dual Backend Switch -->
            <div class="zm-provider-grid">
              <button class="zm-pcard" id="zmPickOllama" type="button">
                <div class="zm-pcard-h">${ICONS.cpu}<span>本地 Ollama</span></div>
              </button>
              <button class="zm-pcard" id="zmPickApi" type="button">
                <div class="zm-pcard-h">${ICONS.cloud}<span>云端 API</span></div>
              </button>
            </div>

            <!-- Local Ollama Auto-Detect & Pull Progress Card -->
            <div class="zm-setup-card" id="zmLocalSetupCard"></div>

            <!-- Local Ollama Fields -->
            <div id="zmOllamaFields" style="display:flex;flex-direction:column;gap:8px;">
              <div class="zm-install-opt">
                <div class="zm-install-meta">
                  <span class="zm-install-title">一键安装开源专项小模型</span>
                  <span class="zm-install-author">作者 @B站IM榴莲</span>
                </div>
                <button class="zm-icon-btn primary" id="zmOpenInstallModalBtn" type="button">${ICONS.download}<span>一键安装</span></button>
              </div>
              <div class="zm-field">
                <label class="zm-label"><span>Ollama 地址（免代理直连）</span></label>
                <input class="zm-input" id="zmOllamaUrl" placeholder="http://127.0.0.1:11434" />
              </div>
              <div class="zm-field">
                <label class="zm-label"><span>模型名</span><span id="zmOllamaAvail"></span></label>
                <input class="zm-input" id="zmOllamaModel" list="zmOllamaModelList" placeholder="留空自动探测 V2" />
                <datalist id="zmOllamaModelList"></datalist>
              </div>
              <div class="zm-field">
                <label class="zm-label"><span>上下文 (num_ctx)</span></label>
                <select class="zm-select" id="zmNumCtx" style="max-width:none;width:100%;">
                  <option value="4096">4096（低显存）</option>
                  <option value="8192">8192（标准推荐）</option>
                  <option value="16384">16384（大显存/常驻）</option>
                </select>
              </div>
            </div>

            <!-- OpenAI-compatible API Fields -->
            <div id="zmApiFields" style="display:none;flex-direction:column;gap:8px;">
              <div class="zm-presets" id="zmPresets"></div>
              <div class="zm-custom-hint" id="zmCustomApiHint">支持任意 OpenAI 兼容网关（/v1 或完整 /chat/completions），本地回环地址可留空 Key</div>
              <div class="zm-field">
                <label class="zm-label"><span>API Base URL</span></label>
                <input class="zm-input" id="zmApiBaseUrl" placeholder="https://api.deepseek.com/v1" />
              </div>
              <div class="zm-field">
                <label class="zm-label"><span>模型名</span></label>
                <input class="zm-input" id="zmApiModel" placeholder="deepseek-chat" />
              </div>
              <div class="zm-field">
                <label class="zm-label">
                  <span>API Key（本机保存，不回显）</span>
                  <span id="zmApiKeyHint"></span>
                </label>
                <div class="zm-bar">
                  <input class="zm-input" id="zmApiKey" type="password" placeholder="输入新 Key（留空保持不变）" autocomplete="off" />
                  <button class="zm-icon-btn square danger" id="zmClearKeyBtn" type="button" aria-label="清除已存 Key" title="清除已存 Key">${ICONS.trash}</button>
                </div>
              </div>
            </div>

            <!-- Behavior Switches -->
            <div class="zm-switches">
              <label class="zm-switch" title="发消息前毫秒级 FTS5 自动注入相关历史"><span>自动召回</span><input type="checkbox" id="zmCfgAutoRecall" /></label>
              <label class="zm-switch" title="对话轮次结束后后台异步抽取沉淀"><span>自动沉淀</span><input type="checkbox" id="zmCfgAutoRemember" /></label>
              <label class="zm-switch" title="入库前运行 1 轮原文对照审校"><span>写前审校</span><input type="checkbox" id="zmCfgVerify" /></label>
              <label class="zm-switch" title="带 until:YYYY-MM-DD 过期记忆自动后移"><span>时效后移</span><input type="checkbox" id="zmCfgUntil" /></label>
              <label class="zm-switch" title="检索按头名 0.35 相对分数动态保留 2-8 条"><span>动态 2-8</span><input type="checkbox" id="zmCfgAdaptive" /></label>
              <label class="zm-switch" title="按当前工作目录自动隔离命名空间"><span>按项目分库</span><input type="checkbox" id="zmCfgWsNs" /></label>
            </div>

            <div class="zm-bar" style="justify-content:space-between;">
              <button class="zm-icon-btn" id="zmTestBtn" type="button">${ICONS.bolt}<span>测试连接</span></button>
              <button class="zm-icon-btn primary" id="zmSaveCfgBtn" type="button">${ICONS.check}<span>保存配置</span></button>
            </div>

            <details class="zm-help">
              <summary>数据路径与脱敏说明</summary>
              <div style="margin-top:6px;line-height:1.6;">
                <div>• 数据路径：<code id="zmDbPathText">~/.zeromem/memory.db</code></div>
                <div>• 隐私保护：云端 API 模式下常见密钥在离开本机前自动替换为 <code>[REDACTED]</code>。</div>
              </div>
            </details>
          </section>
        </div>
      </div>

      <!-- Frosted Glass Confirm Modal for One-Click Open-Source Model Install -->
      <div class="zm-modal-mask" id="zmInstallModal" role="dialog" aria-modal="true" aria-label="确认安装开源专项小模型">
        <div class="zm-modal">
          <div class="zm-modal-title">${ICONS.download}<span>确认安装开源专项小模型</span></div>
          <div class="zm-modal-sub">
            作者 <strong>@B站IM榴莲</strong> · 开源仓库 <code>IMLIULIAN/qwen3.5-4b-memory-v2</code>
          </div>
          <div class="zm-ver-grid" id="zmInstallVerGrid">
            <button class="zm-ver-card active" data-model="hf.co/IMLIULIAN/qwen3.5-4b-memory-v2:Q8_0" type="button">
              <span class="zm-ver-name">Q8_0 标准版</span>
              <span class="zm-ver-size">约 4.5 GB · 推荐精度</span>
            </button>
            <button class="zm-ver-card" data-model="hf.co/IMLIULIAN/qwen3.5-4b-memory-v2:Q4_K_M" type="button">
              <span class="zm-ver-name">Q4_K_M 轻量版</span>
              <span class="zm-ver-size">约 2.7 GB · 低显存</span>
            </button>
          </div>
          <div class="zm-modal-note" id="zmInstallModalNote">确认后将通过本机 Ollama 下载模型，期间显示实时进度并可随时取消。</div>
          <div class="zm-modal-foot" id="zmInstallModalFoot">
            <button class="zm-icon-btn" id="zmInstallCancelBtn" type="button">取消</button>
            <button class="zm-icon-btn primary" id="zmInstallConfirmBtn" type="button">${ICONS.check}<span>确认安装</span></button>
          </div>
        </div>
      </div>
    </aside>
  `;

  const $ = (id) => shadow.getElementById(id);
  const state = {
    open: false,
    tab: "memories",
    config: null,
    providerDraft: "ollama",
    clearApiKeyFlag: false,
    searchTimer: null,
    selectedNs: "",
    namespaces: [],
    selectedInstallModel: "hf.co/IMLIULIAN/qwen3.5-4b-memory-v2:Q8_0",
    activePresetId: "deepseek",
    customApiBaseUrl: "",
    customApiModel: "",
    theme: readCachedTheme(),
    bgUrl: "",
    hasCustomBg: false,
    lastProviderStatus: null,
    lastModeLabel: "加载中",
    serverActivity: { busy: false, phase: "idle", label: "" },
    setupState: { active: false, status: "idle", percent: null },
    uiBusyCount: 0,
    uiBusyLabel: "",
    evicting: false,
    eventSource: null,
    sseRetryTimer: null,
  };

  // Tactile glass ripple on pointerdown across interactive elements
  shadow.addEventListener("pointerdown", (e) => {
    const target = e.target?.closest?.(".zm-icon-btn, .zm-tab, .zm-pcard, .zm-chip, .zm-theme-opt, .zm-bg-drop, .zm-pill, .zm-ns-trigger, .zm-ns-opt, .zm-ver-card");
    if (!target || target.disabled) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.1;
    const ripple = document.createElement("span");
    ripple.className = "zm-ripple";
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    target.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    setTimeout(() => ripple.remove(), 520);
  });

  function showToast(msg, ok = true) {
    const el = $("zmToast");
    el.textContent = msg;
    el.className = `zm-toast ${ok ? "ok" : "err"}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.className = "zm-toast";
    }, 4200);
  }

  function applyAppearance() {
    const theme = state.theme === "dark" ? "dark" : "light";
    host.setAttribute("data-theme", theme);
    $("zmThemeSeg").style.setProperty("--zm-theme-idx", theme === "dark" ? "1" : "0");

    // Curated golden frosted-glass defaults (30px blur; 50% frost on aurora / 62% on custom wallpaper)
    const tint = state.hasCustomBg ? 62 : 50;
    host.style.setProperty("--zm-blur", "30px");
    host.style.setProperty("--zm-tint-hi", Math.min(0.92, (tint + 6) / 100).toFixed(2));
    host.style.setProperty("--zm-tint-lo", Math.max(0.28, (tint - 6) / 100).toFixed(2));

    const themeBtn = $("zmThemeBtn");
    themeBtn.innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
    themeBtn.title = theme === "dark" ? "切换到亮色模式" : "切换到暗色模式";
    $("zmThemeLightBtn").classList.toggle("active", theme === "light");
    $("zmThemeDarkBtn").classList.toggle("active", theme === "dark");

    const bgLayer = $("zmBgLayer");
    const preview = $("zmBgPreview");
    const clearBtn = $("zmClearBgBtn");
    const quickBtn = $("zmBgQuickBtn");

    if (state.hasCustomBg && state.bgUrl) {
      const safeCssUrl = `url("${state.bgUrl.replace(/"/g, "%22")}")`;
      bgLayer.style.backgroundImage = safeCssUrl;
      bgLayer.classList.add("has-custom");
      preview.style.backgroundImage = safeCssUrl;
      clearBtn.style.display = "inline-flex";
      quickBtn.classList.add("has-dot");
      $("zmBgDropTitle").textContent = "更换背景图";
      $("zmBgDropSub").textContent = "已应用毛玻璃壁纸";
    } else {
      bgLayer.style.backgroundImage = "";
      bgLayer.classList.remove("has-custom");
      preview.style.backgroundImage = "";
      clearBtn.style.display = "none";
      quickBtn.classList.remove("has-dot");
      $("zmBgDropTitle").textContent = "上传背景图";
      $("zmBgDropSub").textContent = "点击或拖入 · 自动毛玻璃";
    }
    writeCachedTheme(theme);
  }

  function applyStatusDot(el, pStatus, busy) {
    el.className = "zm-dot";
    if (busy) {
      el.classList.add("busy");
      return;
    }
    if (!pStatus) return;
    if (pStatus.ok) {
      el.classList.add(pStatus.provider === "openai-compatible" ? "api" : "ok");
    } else if (["missing_model", "missing_key", "ollama_stopped"].includes(pStatus.state)) {
      el.classList.add("warn");
    } else {
      el.classList.add("err");
    }
  }

  function renderBusyHalo() {
    const busy = Boolean(state.serverActivity?.busy || state.uiBusyCount > 0 || state.setupState?.active);
    const label =
      state.uiBusyCount > 0
        ? state.uiBusyLabel || "处理中"
        : state.serverActivity?.busy
          ? state.serverActivity.label || "处理中"
          : state.setupState?.active
            ? "安装中"
            : "";

    $("zmPillShell").classList.toggle("is-busy", busy);
    $("zmBrandOrb").classList.toggle("is-busy", busy);
    $("zmPillLabel").textContent = busy ? label : "零忆";
    $("zmModeText").textContent = busy ? label : state.lastModeLabel;
    applyStatusDot($("zmPillDot"), state.lastProviderStatus, busy);
    applyStatusDot($("zmHeadDot"), state.lastProviderStatus, busy);
  }

  async function withUiBusy(label, fn, minMs = 360) {
    const started = Date.now();
    state.uiBusyCount += 1;
    state.uiBusyLabel = label || "处理中";
    renderBusyHalo();
    try {
      return await fn();
    } finally {
      const remain = Math.max(0, minMs - (Date.now() - started));
      const done = () => {
        state.uiBusyCount = Math.max(0, state.uiBusyCount - 1);
        if (state.uiBusyCount === 0) state.uiBusyLabel = "";
        renderBusyHalo();
      };
      if (remain > 0) setTimeout(done, remain);
      else done();
    }
  }

  async function triggerStartOllama() {
    await withUiBusy("启动 Ollama", async () => {
      try {
        const res = await api("/local-setup", {
          method: "POST",
          body: JSON.stringify({ action: "start-ollama" }),
        });
        showToast(res.result?.message || "本地 Ollama 已启动");
        await refreshStatus(false);
      } catch (err) {
        showToast(`启动失败：${err.message}`, false);
      }
    });
  }

  async function triggerPullModel(modelId) {
    try {
      const res = await api("/local-setup", {
        method: "POST",
        body: JSON.stringify({ action: "pull-model", model: modelId }),
      });
      if (res.setup) state.setupState = res.setup;
      renderBusyHalo();
      renderLocalSetupGuides();
      showToast("已开始后台拉取本地 V2 模型");
    } catch (err) {
      showToast(`拉取启动失败：${err.message}`, false);
    }
  }

  async function triggerCancelPull() {
    try {
      await api("/local-setup", {
        method: "POST",
        body: JSON.stringify({ action: "cancel" }),
      });
      showToast("已取消模型下载");
    } catch (err) {
      showToast(`取消失败：${err.message}`, false);
    }
  }

  function renderLocalSetupGuides() {
    const ps = state.lastProviderStatus || {};
    const setup = state.setupState || {};
    const card = $("zmLocalSetupCard");
    const banner = $("zmTopSetupBanner");
    const isOllamaMode = (state.config?.provider || state.providerDraft) !== "openai-compatible";

    // Active pull progress takes priority in both card and top banner
    if (setup.active && setup.action === "pull-model") {
      const pct = Number.isFinite(setup.percent) ? setup.percent : 12;
      const sizeStr = setup.total > 0 ? `${formatBytes(setup.completed)} / ${formatBytes(setup.total)}` : setup.status || "准备中";
      const html = `
        <div class="zm-setup-row">
          <span class="zm-setup-title">${ICONS.download}<span>正在下载本地模型 · ${pct}%</span></span>
          <button class="zm-icon-btn danger" data-setup-act="cancel" type="button">${ICONS.close}<span>取消</span></button>
        </div>
        <div class="zm-prog-track"><div class="zm-prog-fill" style="width:${Math.max(4, pct)}%;"></div></div>
        <div class="zm-setup-sub">${esc(setup.model)} · ${esc(sizeStr)}</div>
      `;
      card.innerHTML = html;
      card.classList.add("show");
      banner.innerHTML = html;
      banner.classList.add("show");
      bindSetupButtons(card);
      bindSetupButtons(banner);
      return;
    }

    // Only show install/start prompts when local Ollama is selected and not ready
    if (!isOllamaMode || ps.ok || !ps.state || ps.state === "unchecked") {
      card.classList.remove("show");
      banner.classList.remove("show");
      return;
    }

    const models = Array.isArray(ps.recommended_models) && ps.recommended_models.length
      ? ps.recommended_models
      : [
          { id: "hf.co/IMLIULIAN/qwen3.5-4b-memory-v2:Q8_0", shortLabel: "一键下载 V2 (Q8)", sizeHint: "4.5 GB" },
          { id: "hf.co/IMLIULIAN/qwen3.5-4b-memory-v2:Q4_K_M", shortLabel: "轻量 Q4", sizeHint: "2.7 GB" },
        ];

    if (ps.state === "missing_model") {
      const m0 = models[0];
      const m1 = models[1];
      const html = `
        <div class="zm-setup-row">
          <span class="zm-setup-title">${ICONS.cpu}<span>Ollama 已就绪 · 一键安装零忆 V2</span></span>
        </div>
        <div class="zm-setup-sub">自动检测到尚未下载零忆专用模型，可一键拉取（免费离线）</div>
        <div class="zm-setup-btns">
          <button class="zm-icon-btn primary" data-setup-act="pull" data-model="${esc(m0.id)}" type="button">${ICONS.download}<span>${esc(m0.shortLabel)} · ${esc(m0.sizeHint)}</span></button>
          ${m1 ? `<button class="zm-icon-btn" data-setup-act="pull" data-model="${esc(m1.id)}" type="button">${ICONS.download}<span>${esc(m1.shortLabel)}</span></button>` : ""}
        </div>
      `;
      card.innerHTML = html;
      card.classList.add("show");
      banner.innerHTML = `
        <div class="zm-setup-row">
          <span class="zm-setup-title">${ICONS.cpu}<span>Ollama 已就绪，尚未安装 V2 模型</span></span>
          <button class="zm-icon-btn primary" data-setup-act="pull" data-model="${esc(m0.id)}" type="button">${ICONS.download}<span>一键下载</span></button>
        </div>
      `;
      banner.classList.add("show");
    } else if (ps.state === "ollama_stopped") {
      const html = `
        <div class="zm-setup-row">
          <span class="zm-setup-title">${ICONS.cpu}<span>已检测到本机 Ollama（未启动）</span></span>
          <button class="zm-icon-btn primary" data-setup-act="start" type="button">${ICONS.play}<span>一键启动</span></button>
        </div>
        <div class="zm-setup-sub">后台静默拉起 Ollama 服务后即可自动检测或一键拉取 V2 模型</div>
      `;
      card.innerHTML = html;
      card.classList.add("show");
      banner.innerHTML = html;
      banner.classList.add("show");
    } else if (ps.state === "ollama_not_installed") {
      const guide = ps.install_guide || { command: "winget install Ollama.Ollama", downloadUrl: "https://ollama.com/download" };
      const html = `
        <div class="zm-setup-row">
          <span class="zm-setup-title">${ICONS.cpu}<span>未检测到本机 Ollama</span></span>
        </div>
        <div class="zm-setup-sub">安装 Ollama 后重启检测即可一键拉取免费本地模型，或直接改用云端 API</div>
        <div class="zm-setup-btns">
          <button class="zm-icon-btn primary" data-setup-act="open-url" data-url="${esc(guide.downloadUrl)}" type="button">${ICONS.external}<span>下载 Ollama</span></button>
          <button class="zm-icon-btn" data-setup-act="copy-cmd" data-cmd="${esc(guide.command)}" type="button">${ICONS.copy}<span>复制安装命令</span></button>
          <button class="zm-icon-btn" data-setup-act="switch-api" type="button">${ICONS.cloud}<span>切云端 API</span></button>
        </div>
      `;
      card.innerHTML = html;
      card.classList.add("show");
      banner.innerHTML = `
        <div class="zm-setup-row">
          <span class="zm-setup-title">${ICONS.cpu}<span>未检测到 Ollama</span></span>
          <div class="zm-setup-btns">
            <button class="zm-icon-btn primary" data-setup-act="go-settings" type="button">${ICONS.sliders}<span>一键向导</span></button>
          </div>
        </div>
      `;
      banner.classList.add("show");
    } else {
      card.classList.remove("show");
      banner.classList.remove("show");
      return;
    }

    bindSetupButtons(card);
    bindSetupButtons(banner);
  }

  function bindSetupButtons(rootEl) {
    rootEl.querySelectorAll("[data-setup-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const act = btn.getAttribute("data-setup-act");
        if (act === "start") {
          await triggerStartOllama();
        } else if (act === "pull") {
          const picked = btn.getAttribute("data-model") || state.selectedInstallModel;
          state.selectedInstallModel = picked;
          $("zmInstallVerGrid")
            .querySelectorAll(".zm-ver-card")
            .forEach((c) => c.classList.toggle("active", c.getAttribute("data-model") === picked));
          openInstallModal();
        } else if (act === "cancel") {
          await triggerCancelPull();
        } else if (act === "open-url") {
          window.open(btn.getAttribute("data-url") || "https://ollama.com/download", "_blank", "noopener,noreferrer");
        } else if (act === "copy-cmd") {
          const cmd = btn.getAttribute("data-cmd") || "";
          try {
            await navigator.clipboard.writeText(cmd);
            showToast(`已复制：${cmd}`);
          } catch {
            showToast(`请手动运行：${cmd}`);
          }
        } else if (act === "switch-api") {
          switchTab("settings");
          state.providerDraft = "openai-compatible";
          renderProviderFields();
          $("zmApiKey").focus();
        } else if (act === "go-settings") {
          switchTab("settings");
        }
      });
    });
  }

  function connectEvents() {
    if (typeof EventSource !== "function") return;
    if (state.eventSource) {
      try {
        state.eventSource.close();
      } catch {}
    }
    try {
      const es = new EventSource(`${API_BASE}/events`);
      state.eventSource = es;
      es.addEventListener("activity", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          if (payload.activity) state.serverActivity = payload.activity;
          if (payload.setup) {
            const wasActive = state.setupState?.active;
            state.setupState = payload.setup;
            if (wasActive && !payload.setup.active) {
              if (payload.setup.status === "success") {
                showToast("本地 V2 模型下载完成，已自动就绪");
                refreshStatus(false);
              } else if (payload.setup.status === "error" && payload.setup.error) {
                showToast(`下载失败：${payload.setup.error}`, false);
                refreshStatus(false);
              }
            }
          }
          renderBusyHalo();
          renderLocalSetupGuides();
          if (payload.stats_dirty && !state.evicting) {
            refreshStatus(true);
            if (state.open && state.tab === "memories") loadMemories();
            if (state.open && state.tab === "recycle") loadRecycleBin();
          }
        } catch {}
      });
      es.onerror = () => {
        try {
          es.close();
        } catch {}
        state.eventSource = null;
        clearTimeout(state.sseRetryTimer);
        state.sseRetryTimer = setTimeout(connectEvents, 8000);
      };
    } catch {
      // fail-open
    }
  }

  function renderProviderFields() {
    const isApi = state.providerDraft === "openai-compatible";
    $("zmPickOllama").classList.toggle("active", !isApi);
    $("zmPickApi").classList.toggle("active", isApi);
    $("zmOllamaFields").style.display = isApi ? "none" : "flex";
    $("zmApiFields").style.display = isApi ? "flex" : "none";
    renderLocalSetupGuides();
  }

  function detectPresetId(baseUrl, presets) {
    const norm = String(baseUrl || "").trim().replace(/\/+$/, "").toLowerCase();
    for (const p of presets || []) {
      if (p.isCustom || p.id === "custom") continue;
      if (String(p.baseUrl || "").trim().replace(/\/+$/, "").toLowerCase() === norm) {
        return p.id;
      }
    }
    return "custom";
  }

  function updateApiPresetUi(presetId) {
    state.activePresetId = presetId || "custom";
    const isCustom = state.activePresetId === "custom";
    $("zmPresets")
      .querySelectorAll(".zm-chip")
      .forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-pid") === state.activePresetId);
      });
    $("zmCustomApiHint").classList.toggle("show", isCustom);
    $("zmApiBaseUrl").placeholder = isCustom ? "https://your-gateway.example/v1" : "https://api.deepseek.com/v1";
    $("zmApiModel").placeholder = isCustom ? "输入自定义模型 ID（如 qwen-plus / gpt-4.1-mini）" : "deepseek-chat";
  }

  function populateConfigForm(cfg, probe) {
    state.config = cfg;
    state.providerDraft = cfg.provider || "ollama";
    state.clearApiKeyFlag = false;
    state.customApiBaseUrl = cfg.customApiBaseUrl || state.customApiBaseUrl || "";
    state.customApiModel = cfg.customApiModel || state.customApiModel || "";
    renderProviderFields();

    if (cfg.uiTheme === "dark" || cfg.uiTheme === "light") state.theme = cfg.uiTheme;
    state.hasCustomBg = Boolean(cfg.uiHasBackground && cfg.uiBackgroundUrl);
    state.bgUrl = state.hasCustomBg ? cfg.uiBackgroundUrl : "";
    applyAppearance();

    $("zmOllamaUrl").value = cfg.ollamaUrl || "http://127.0.0.1:11434";
    $("zmOllamaModel").value = cfg.ollamaModel || "";
    $("zmNumCtx").value = String(cfg.numCtx || 8192);
    $("zmApiBaseUrl").value = cfg.apiBaseUrl || "https://api.deepseek.com/v1";
    $("zmApiModel").value = cfg.apiModel || "deepseek-chat";
    $("zmApiKey").value = "";
    $("zmApiKeyHint").textContent = cfg.apiKeySet ? `已配置 ${cfg.apiKeyMasked}` : "未配置";

    $("zmCfgAutoRecall").checked = Boolean(cfg.autoRecall);
    $("zmCfgAutoRemember").checked = Boolean(cfg.autoRemember);
    $("zmCfgVerify").checked = Boolean(cfg.verify);
    $("zmCfgUntil").checked = Boolean(cfg.untilExpiry);
    $("zmCfgAdaptive").checked = Boolean(cfg.adaptive);
    $("zmCfgWsNs").checked = cfg.namespaceMode !== "fixed";
    $("zmAddVerify").checked = Boolean(cfg.verify);
    $("zmDbPathText").textContent = cfg.dbPath || "~/.zeromem/memory.db";

    const rawPresets = Array.isArray(cfg.presets) && cfg.presets.length ? [...cfg.presets] : [];
    if (!rawPresets.some((p) => p.id === "custom" || p.isCustom)) {
      rawPresets.push({ id: "custom", label: "自定义 API", baseUrl: "", model: "", isCustom: true });
    }
    const presetBox = $("zmPresets");
    presetBox.innerHTML = "";
    for (const p of rawPresets) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zm-chip";
      btn.setAttribute("data-pid", p.id);
      btn.textContent = p.label;
      btn.onclick = () => {
        if (p.id === "custom" || p.isCustom) {
          updateApiPresetUi("custom");
          const curMatch = detectPresetId($("zmApiBaseUrl").value, rawPresets);
          if (curMatch !== "custom") {
            $("zmApiBaseUrl").value = state.customApiBaseUrl || "";
            $("zmApiModel").value = state.customApiModel || "";
          }
          $("zmApiBaseUrl").focus();
        } else {
          if (state.activePresetId === "custom") {
            const curU = $("zmApiBaseUrl").value.trim();
            const curM = $("zmApiModel").value.trim();
            if (curU) state.customApiBaseUrl = curU;
            if (curM) state.customApiModel = curM;
          }
          $("zmApiBaseUrl").value = p.baseUrl;
          $("zmApiModel").value = p.model;
          updateApiPresetUi(p.id);
        }
      };
      presetBox.appendChild(btn);
    }
    const matched = detectPresetId($("zmApiBaseUrl").value, rawPresets);
    if (matched === "custom") {
      state.customApiBaseUrl = $("zmApiBaseUrl").value.trim();
      state.customApiModel = $("zmApiModel").value.trim();
    }
    updateApiPresetUi(matched);

    const dl = $("zmOllamaModelList");
    dl.innerHTML = "";
    const models = probe?.available_models || [];
    $("zmOllamaAvail").textContent = models.length ? `已发现 ${models.length} 个` : "";
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m;
      dl.appendChild(opt);
    }
  }

  async function refreshStatus(quick = false) {
    try {
      const data = await api(`/status${quick ? "?quick=1" : ""}`);
      const st = data.stats || {};
      const ps = data.provider_status || {};
      const cfg = data.config || {};

      $("zmPillCnt").textContent = String(st.facts || 0);
      $("zmTabMemCnt").textContent = String(st.facts || 0);
      $("zmTabRecCnt").textContent = String(st.evicted_records || 0);
      $("zmStatsMeta").textContent = `文档 ${st.documents || 0} · 纠错 ${st.revised_facts || 0}`;

      if (!quick || !state.lastProviderStatus) state.lastProviderStatus = ps;
      state.lastModeLabel =
        cfg.provider === "openai-compatible"
          ? `API · ${cfg.apiModel || "未设"}`
          : `本地 · ${ps.model || cfg.ollamaModel || "V2"}`;
      $("zmModeBadge").title = ps.message || state.lastModeLabel;
      if (data.activity) state.serverActivity = data.activity;
      if (data.setup) state.setupState = data.setup;
      renderBusyHalo();

      const nextNamespaces = Array.isArray(st.namespaces) ? st.namespaces : [];
      state.namespaces = nextNamespaces;
      if (state.selectedNs && !nextNamespaces.includes(state.selectedNs)) {
        state.selectedNs = "";
      }
      renderNamespaceMenu();

      if (!quick || !state.config) {
        populateConfigForm(cfg, ps);
      }
      renderLocalSetupGuides();
    } catch (err) {
      state.lastProviderStatus = { ok: false, state: "offline" };
      state.lastModeLabel = "未连接";
      renderBusyHalo();
      if (state.open) showToast(`状态获取失败：${err.message}`, false);
    }
  }

  function bindTwoStepConfirm(btn, onConfirm) {
    let armed = false;
    let timer = null;
    const origHtml = btn.innerHTML;
    const origTitle = btn.title;
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!armed) {
        armed = true;
        btn.classList.add("confirming");
        btn.innerHTML = `${ICONS.check}<span>确认</span>`;
        btn.title = "再次点击确认操作";
        clearTimeout(timer);
        timer = setTimeout(() => {
          armed = false;
          btn.classList.remove("confirming");
          btn.innerHTML = origHtml;
          btn.title = origTitle;
        }, 3000);
        return;
      }
      clearTimeout(timer);
      armed = false;
      btn.classList.remove("confirming");
      btn.innerHTML = origHtml;
      btn.title = origTitle;
      await onConfirm();
    });
  }

  function setNsMenuOpen(flag) {
    const dd = $("zmNsDd");
    const open = Boolean(flag);
    dd.classList.toggle("open", open);
    $("zmNsTrigger").setAttribute("aria-expanded", open ? "true" : "false");
  }

  function renderNamespaceMenu() {
    const labelText = state.selectedNs || "全部空间";
    $("zmNsLabel").textContent = labelText;
    $("zmNsTrigger").title = labelText;

    const menu = $("zmNsMenu");
    const opts = [{ value: "", label: "全部空间" }, ...state.namespaces.map((ns) => ({ value: ns, label: ns }))];
    menu.innerHTML = opts
      .map(
        (o) => `
        <button class="zm-ns-opt ${o.value === state.selectedNs ? "active" : ""}" data-ns="${esc(o.value)}" type="button" role="option" aria-selected="${o.value === state.selectedNs ? "true" : "false"}" title="${esc(o.label)}">
          <span class="zm-ns-opt-txt">${esc(o.label)}</span>
          <span class="zm-ns-opt-chk">${ICONS.check}</span>
        </button>
      `
      )
      .join("");

    menu.querySelectorAll(".zm-ns-opt").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nextVal = btn.getAttribute("data-ns") || "";
        const changed = nextVal !== state.selectedNs;
        state.selectedNs = nextVal;
        renderNamespaceMenu();
        setNsMenuOpen(false);
        if (changed) loadMemories();
      });
    });
  }

  /**
   * High-craft 3D textured crumpled-paper deletion animation (zero external deps):
   * 1. Snapshots the real card content (tags + wrapped text) onto an offscreen paper texture canvas.
   * 2. Phase 1 (0..350ms): In-place hand-crumple — creases form first, corners fold inward,
   *    affine-textured 3D triangles deform into a sharp faceted paper ball with directional lighting + crease AO.
   * 3. Phase 2 (350..460ms): Secondary palm squeeze + elastic settle pause (DOM slot begins collapsing smoothly).
   * 4. Phase 3 (460..790ms): Parabolic tumble-toss with subtle arc trail into Recycle Bin tab -> Q-bounce & flecks.
   */
  function renderCardPaperTexture(cardEl, width, height, isDark) {
    const tex = document.createElement("canvas");
    const scale = 1.5;
    tex.width = Math.max(64, Math.round(width * scale));
    tex.height = Math.max(48, Math.round(height * scale));
    const tctx = tex.getContext("2d");
    if (!tctx) return null;
    tctx.scale(scale, scale);

    // Paper sheet base with subtle fibrous warmth
    tctx.fillStyle = isDark ? "#1e2b45" : "#fbfcff";
    tctx.fillRect(0, 0, width, height);
    const sheen = tctx.createLinearGradient(0, 0, width, height);
    sheen.addColorStop(0, isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)");
    sheen.addColorStop(1, isDark ? "rgba(9,14,28,0.22)" : "rgba(226,232,248,0.45)");
    tctx.fillStyle = sheen;
    tctx.fillRect(0, 0, width, height);

    // Subtle paper border
    tctx.strokeStyle = isDark ? "rgba(148,163,184,0.28)" : "rgba(148,163,184,0.34)";
    tctx.lineWidth = 1.2;
    tctx.strokeRect(0.6, 0.6, width - 1.2, height - 1.2);

    // Render real tag pills from card DOM
    let tx = 12;
    const ty = 11;
    tctx.font = '600 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif';
    tctx.textBaseline = "middle";
    const tags = [...cardEl.querySelectorAll(".zm-tag")].slice(0, 4);
    for (const tagEl of tags) {
      const label = (tagEl.textContent || "").trim().slice(0, 22);
      if (!label) continue;
      const tw = Math.min(130, tctx.measureText(label).width + 14);
      if (tx + tw > width - 36) break;
      const isRev = tagEl.classList.contains("rev");
      const isExp = tagEl.classList.contains("exp");
      tctx.fillStyle = isRev
        ? isDark ? "rgba(16,185,129,0.28)" : "rgba(16,185,129,0.18)"
        : isExp
          ? isDark ? "rgba(245,158,11,0.28)" : "rgba(245,158,11,0.20)"
          : isDark ? "rgba(99,102,241,0.28)" : "rgba(79,70,229,0.14)";
      tctx.beginPath();
      tctx.roundRect ? tctx.roundRect(tx, ty, tw, 17, 8.5) : tctx.rect(tx, ty, tw, 17);
      tctx.fill();
      tctx.fillStyle = isRev ? (isDark ? "#6ee7b7" : "#047857") : isExp ? (isDark ? "#fcd34d" : "#b45309") : (isDark ? "#a5b4fc" : "#4338ca");
      tctx.fillText(label, tx + 7, ty + 8.8, tw - 10);
      tx += tw + 5;
    }

    // Render real memory text wrapped across lines
    const rawText = (cardEl.querySelector(".zm-fact-text")?.textContent || "").trim();
    tctx.fillStyle = isDark ? "#e2e8f0" : "#1e293b";
    tctx.font = '400 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif';
    tctx.textBaseline = "top";
    const maxW = Math.max(60, width - 24);
    let line = "";
    let y = 36;
    const lineH = 19;
    for (let i = 0; i < rawText.length && y < height - 10; i++) {
      const ch = rawText[i];
      const test = line + ch;
      if (ch === "\n" || tctx.measureText(test).width > maxW) {
        tctx.fillText(line, 12, y);
        line = ch === "\n" ? "" : ch;
        y += lineH;
      } else {
        line = test;
      }
    }
    if (line && y < height - 8) tctx.fillText(line, 12, y);
    return { tex, scale };
  }

  function drawTexturedTriangle(ctx, img, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
    const denom = u0 * (v1 - v2) - v0 * (u1 - u2) + (u1 * v2 - u2 * v1);
    if (Math.abs(denom) < 1e-4) return;
    // Slight 0.35px outward expansion prevents subpixel hairline seams between adjacent facets
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    const ex = (x, y) => {
      const dx = x - cx, dy = y - cy;
      const l = Math.hypot(dx, dy) || 1;
      return [x + (dx / l) * 0.45, y + (dy / l) * 0.45];
    };
    const [px0, py0] = ex(x0, y0);
    const [px1, py1] = ex(x1, y1);
    const [px2, py2] = ex(x2, y2);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(px0, py0);
    ctx.lineTo(px1, py1);
    ctx.lineTo(px2, py2);
    ctx.closePath();
    ctx.clip();

    const m11 = (x0 * (v1 - v2) - v0 * (x1 - x2) + (x1 * v2 - x2 * v1)) / denom;
    const m12 = (u0 * (x1 - x2) - x0 * (u1 - u2) + (u1 * x2 - u2 * x1)) / denom;
    const m13 = (u0 * (v1 * x2 - v2 * x1) - v0 * (u1 * x2 - u2 * x1) + x0 * (u1 * v2 - u2 * v1)) / denom;
    const m21 = (y0 * (v1 - v2) - v0 * (y1 - y2) + (y1 * v2 - y2 * v1)) / denom;
    const m22 = (u0 * (y1 - y2) - y0 * (u1 - u2) + (u1 * y2 - u2 * y1)) / denom;
    const m23 = (u0 * (v1 * y2 - v2 * y1) - v0 * (u1 * y2 - u2 * y1) + y0 * (u1 * v2 - u2 * v1)) / denom;

    ctx.transform(m11, m21, m12, m22, m13, m23);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function playPaperCrumpleToTrash(cardEl) {
    return new Promise((resolve) => {
      if (!cardEl || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        if (cardEl) cardEl.remove();
        resolve();
        return;
      }
      const rect = cardEl.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 12) {
        cardEl.remove();
        resolve();
        return;
      }

      const binTab = shadow.querySelector('.zm-tab[data-tab="recycle"]');
      const binRect = binTab ? binTab.getBoundingClientRect() : { left: rect.left + rect.width * 0.5, top: 80, width: 80, height: 30 };
      const startCx = rect.left + rect.width * 0.5;
      const startCy = rect.top + rect.height * 0.5;
      const targetCx = binRect.left + binRect.width * 0.5;
      const targetCy = binRect.top + binRect.height * 0.5;

      const isDark = state.theme === "dark";
      const snap = renderCardPaperTexture(cardEl, rect.width, rect.height, isDark);

      // Keep DOM slot occupied until the crumpled paper ball clears this card's slot, preventing lower cards from sliding underneath it
      const origH = rect.height;
      const parentStyle = cardEl.parentElement ? getComputedStyle(cardEl.parentElement) : null;
      const listGap = Math.max(0, parseFloat(parentStyle?.rowGap || parentStyle?.gap || "8") || 8);
      const hasNext = Boolean(cardEl.nextElementSibling);
      const hasPrev = Boolean(cardEl.previousElementSibling);
      cardEl.style.visibility = "hidden";
      cardEl.style.pointerEvents = "none";
      cardEl.style.backdropFilter = "none";
      cardEl.style.webkitBackdropFilter = "none";
      cardEl.style.boxShadow = "none";
      let collapseStarted = false;
      const startCollapse = () => {
        if (collapseStarted) return;
        collapseStarted = true;
        cardEl.style.height = `${origH}px`;
        cardEl.style.marginTop = "0px";
        cardEl.style.marginBottom = "0px";
        void cardEl.offsetHeight;
        cardEl.classList.add("zm-collapsing");
        requestAnimationFrame(() => {
          cardEl.style.opacity = "0";
          cardEl.style.height = "0px";
          cardEl.style.paddingTop = "0px";
          cardEl.style.paddingBottom = "0px";
          cardEl.style.borderWidth = "0px";
          if (hasNext) cardEl.style.marginBottom = `-${listGap}px`;
          else if (hasPrev) cardEl.style.marginTop = `-${listGap}px`;
        });
      };

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483005;";
      shadow.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        canvas.remove();
        cardEl.remove();
        resolve();
        return;
      }
      ctx.scale(dpr, dpr);

      const COLS = 9;
      const ROWS = 5;
      const ballR = Math.max(22, Math.min(34, rect.height * 0.34, rect.width * 0.14));
      const seed = (((Math.round(rect.top * 11 + rect.height * 17) ^ 0x494d ^ 0x4c4c) % 997) + 997) % 997;
      const rand = (k) => {
        const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
        return x - Math.floor(x);
      };

      // Build flat sheet -> mid-crumple creased fold -> jagged polyhedral 3D paper ball
      const verts = [];
      for (let r = 0; r <= ROWS; r++) {
        for (let c = 0; c <= COLS; c++) {
          const u = c / COLS;
          const v = r / ROWS;
          const fx = (u - 0.5) * rect.width;
          const fy = (v - 0.5) * rect.height;
          const idx = r * (COLS + 1) + c;

          // Mid-stage sharp origami-like creases before full ball compression (tucked inward within card bounds)
          const zig = ((r + c) % 2 === 0 ? 1 : -1) * (9 + rand(idx * 5 + 1) * 15);
          const mx = fx * 0.56 + (rand(idx * 5 + 2) - 0.5) * 14;
          const my = fy * 0.54 + (rand(idx * 5 + 3) - 0.5) * 10;
          const mz = zig + Math.sin(u * 9.4 + v * 7.2) * 12;

          // Final irregular polyhedral paper ball (distinct faceted ridges & valleys)
          const dx = u - 0.5;
          const dy = v - 0.5;
          const radial = Math.min(1, Math.hypot(dx * 2, dy * 2));
          const ang = Math.atan2(dy, dx) + (rand(idx * 5 + 4) - 0.5) * 0.65;
          const polar = radial * Math.PI * 0.96 + (rand(idx * 5 + 5) - 0.5) * 0.28;
          const ridge =
            0.66 +
            0.34 * Math.abs(Math.sin(u * 14.5 + v * 10.2 + seed)) +
            0.22 * Math.abs(Math.cos(v * 12.7 - u * 8.9)) +
            (rand(idx * 7 + 2) - 0.5) * 0.24;
          const rr = ballR * ridge;
          const bx = rr * Math.sin(polar) * Math.cos(ang);
          const by = rr * Math.sin(polar) * Math.sin(ang) * 0.92;
          const bz = rr * Math.cos(polar);

          // Corners fold ahead of center
          const delay = Math.max(0, (1.15 - radial) * 0.22);
          verts.push({
            fx, fy, mx, my, mz, bx, by, bz, delay,
            ridge,
            tu: snap ? u * snap.tex.width : 0,
            tv: snap ? v * snap.tex.height : 0,
          });
        }
      }

      const tris = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const i00 = r * (COLS + 1) + c;
          const i10 = i00 + 1;
          const i01 = i00 + (COLS + 1);
          const i11 = i01 + 1;
          // Alternate diagonal orientation like real criss-cross paper creases
          if ((r + c) % 2 === 0) {
            tris.push({ a: i00, b: i10, c: i11 });
            tris.push({ a: i00, b: i11, c: i01 });
          } else {
            tris.push({ a: i00, b: i10, c: i01 });
            tris.push({ a: i10, b: i11, c: i01 });
          }
        }
      }

      const flecks = Array.from({ length: 8 }, (_, i) => {
        const ang = (Math.PI * 2 * i) / 8 + (rand(500 + i) - 0.5) * 0.45;
        const spd = 26 + rand(600 + i) * 34;
        return { vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 16, size: 3.5 + rand(700 + i) * 3.5, rot: rand(800 + i) * 6 };
      });

      const T_CRUMPLE = 320;
      const T_PAUSE = 420;
      const T_TOSS = 740;
      const T_END = 940;
      const tStart = performance.now();
      let binHitTriggered = false;
      const trail = [];

      // Crisp studio top-left key light
      const lx = -0.46, ly = -0.60, lz = 0.65;

      function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

      function renderFrame(now) {
        const elapsed = now - tStart;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        if (elapsed <= T_TOSS) {
          let cx = startCx;
          let cy = startCy;
          let scale = 1;
          let rx = 0, ry = 0, rz = 0;
          let alpha = 1;
          let shadowAlpha = 0.18;
          let shadowDropY = Math.min(ballR * 0.72, Math.max(8, rect.height * 0.5 - 12));

          if (elapsed < T_CRUMPLE) {
            const p = elapsed / T_CRUMPLE;
            // Energetic double-grip crumple tremor (contained strictly inside card slot)
            const shake = Math.sin(p * Math.PI * 6) * (1 - p) * 2.8;
            cx += shake;
            cy += Math.cos(p * Math.PI * 5) * (1 - p) * 1.4;
            rx = p * p * 0.42;
            ry = p * p * 0.58;
            rz = Math.sin(p * Math.PI) * 0.06;
            shadowAlpha = 0.11 + 0.14 * p;
          } else if (elapsed < T_PAUSE) {
            // Secondary palm squeeze -> elastic pop settle (still cleanly inside own slot)
            const p = (elapsed - T_CRUMPLE) / (T_PAUSE - T_CRUMPLE);
            if (p < 0.45) {
              const sp = p / 0.45;
              scale = 1 - Math.sin(sp * Math.PI) * 0.11; // crisp squeeze inward
            } else {
              const bp = (p - 0.45) / 0.55;
              scale = 1 + Math.sin(bp * Math.PI) * 0.07; // light elastic rebound
            }
            rx = 0.42 + p * 0.16;
            ry = 0.58 + p * 0.24;
            rz = -0.05 * Math.sin(p * Math.PI);
            shadowAlpha = 0.24;
          } else {
            // Snappy wrist-flick parabolic toss with 3D spin into Recycle Bin
            const p = Math.min(1, (elapsed - T_PAUSE) / (T_TOSS - T_PAUSE));
            const ep = 1 - Math.pow(1 - p, 1.9);
            const ctrlX = (startCx + targetCx) * 0.5 + (targetCx >= startCx ? 38 : -38);
            const ctrlY = Math.min(startCy, targetCy) - 68;
            const omt = 1 - ep;
            cx = omt * omt * startCx + 2 * omt * ep * ctrlX + ep * ep * targetCx;
            cy = omt * omt * startCy + 2 * omt * ep * ctrlY + ep * ep * targetCy;
            scale = 1 - ep * 0.66;
            rx = 0.58 + ep * 4.8;
            ry = 0.82 + ep * 5.6;
            rz = ep * 4.2;
            alpha = p > 0.84 ? Math.max(0, 1 - (p - 0.84) / 0.16) : 1;
            // Fade ground shadow out quickly on liftoff so it never casts over cards below
            shadowAlpha = 0.18 * Math.max(0, 1 - p * 3.5);
            shadowDropY = Math.min(ballR * 0.78, Math.max(8, rect.height * 0.5 - 12));

            // Only collapse the empty card slot once the paper ball has physically cleared above rect.top
            if (cy + ballR * scale * 1.2 <= rect.top || elapsed >= T_PAUSE + 100) {
              startCollapse();
            }

            if (p > 0.08) {
              trail.push({ x: cx, y: cy, r: Math.max(3, ballR * 0.34 * scale) });
              if (trail.length > 6) trail.shift();
            }
          }

          // Subtle motion arc trail during toss
          if (trail.length > 2) {
            ctx.save();
            ctx.lineCap = "round";
            for (let i = 1; i < trail.length; i++) {
              const frac = i / trail.length;
              const fade = frac * frac;
              ctx.strokeStyle = isDark
                ? `rgba(129, 140, 248, ${(fade * 0.22 * alpha).toFixed(3)})`
                : `rgba(99, 102, 241, ${(fade * 0.18 * alpha).toFixed(3)})`;
              ctx.lineWidth = trail[i].r * frac * 0.68;
              ctx.beginPath();
              ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
              ctx.lineTo(trail[i].x, trail[i].y);
              ctx.stroke();
            }
            ctx.restore();
          }

          // Compact drop shadow kept inside card slot (never spills onto lower cards)
          if (shadowAlpha > 0.01) {
            ctx.save();
            ctx.globalAlpha = shadowAlpha * alpha;
            const sw = (elapsed < T_CRUMPLE ? rect.width * (0.40 - 0.26 * (elapsed / T_CRUMPLE)) : ballR * 1.08) * scale;
            const sh = Math.max(7, Math.min(12, ballR * 0.34 * scale));
            const maxDrop = Math.max(6, rect.height * 0.5 - sh - 3);
            const sx = cx + 3;
            const sy = cy + Math.min(shadowDropY, maxDrop) * scale;
            const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, sw);
            grad.addColorStop(0, isDark ? "rgba(0,0,0,0.62)" : "rgba(15,23,42,0.28)");
            grad.addColorStop(0.55, isDark ? "rgba(0,0,0,0.22)" : "rgba(15,23,42,0.09)");
            grad.addColorStop(1, "rgba(15,23,42,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(sx, sy, sw, sh, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          const cosX = Math.cos(rx), sinX = Math.sin(rx);
          const cosY = Math.cos(ry), sinY = Math.sin(ry);
          const cosZ = Math.cos(rz), sinZ = Math.sin(rz);

          // Project vertices via 2-stage spline: flat -> creased fold -> polyhedral ball
          const proj = new Array(verts.length);
          const persp = 540;
          const rawP = Math.min(1, elapsed / T_CRUMPLE);
          for (let i = 0; i < verts.length; i++) {
            const vt = verts[i];
            const lp = Math.max(0, Math.min(1, (rawP - vt.delay) / Math.max(0.24, 1 - vt.delay)));
            const e = easeOutCubic(lp);
            // Quadratic Bezier interpolation through creased midpoint (mx, my, mz)
            const omt = 1 - e;
            let x = omt * omt * vt.fx + 2 * omt * e * vt.mx + e * e * vt.bx;
            let y = omt * omt * vt.fy + 2 * omt * e * vt.my + e * e * vt.by;
            let z = 2 * omt * e * vt.mz + e * e * vt.bz;

            let x1 = x * cosY + z * sinY;
            let z1 = -x * sinY + z * cosY;
            let y2 = y * cosX - z1 * sinX;
            let z2 = y * sinX + z1 * cosX;
            let x3 = x1 * cosZ - y2 * sinZ;
            let y3 = x1 * sinZ + y2 * cosZ;

            const pf = (persp / (persp - z2 * scale)) * scale;
            proj[i] = { x: cx + x3 * pf, y: cy + y3 * pf, x3, y3, z3: z2, ridge: vt.ridge, tu: vt.tu, tv: vt.tv };
          }

          // Painter's depth sort (back-to-front)
          const drawList = [];
          for (let i = 0; i < tris.length; i++) {
            const t = tris[i];
            const pa = proj[t.a], pb = proj[t.b], pc = proj[t.c];
            drawList.push({ pa, pb, pc, depth: (pa.z3 + pb.z3 + pc.z3) / 3 });
          }
          drawList.sort((m, n) => m.depth - n.depth);

          ctx.save();
          ctx.globalAlpha = alpha;
          const crumpleStrength = Math.min(1, elapsed / (T_CRUMPLE * 0.85));
          for (let i = 0; i < drawList.length; i++) {
            const { pa, pb, pc } = drawList[i];
            const ux = pb.x3 - pa.x3, uy = pb.y3 - pa.y3, uz = pb.z3 - pa.z3;
            const vx = pc.x3 - pa.x3, vy = pc.y3 - pa.y3, vz = pc.z3 - pa.z3;
            let nx = uy * vz - uz * vy;
            let ny = uz * vx - ux * vz;
            let nz = ux * vy - uy * vx;
            const len = Math.hypot(nx, ny, nz) || 1;
            nx /= len; ny /= len; nz /= len;
            if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }

            // 1. Draw real affine-mapped card texture on this 3D paper facet
            if (snap) {
              drawTexturedTriangle(
                ctx, snap.tex,
                pa.x, pa.y, pb.x, pb.y, pc.x, pc.y,
                pa.tu, pa.tv, pb.tu, pb.tv, pc.tu, pc.tv
              );
            } else {
              ctx.fillStyle = isDark ? "#233250" : "#f8fafc";
              ctx.beginPath();
              ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.lineTo(pc.x, pc.y);
              ctx.closePath();
              ctx.fill();
            }

            // 2. Overlay crisp directional flat-shading + valley Ambient Occlusion (creates iconic 3D paper creases)
            const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
            const avgRidge = (pa.ridge + pb.ridge + pc.ridge) / 3;
            const aoValley = Math.max(0, 1.02 - avgRidge) * 0.58; // deeper shadows inside fold valleys
            const darkness = Math.min(0.68, ((1 - diff) * 0.44 + aoValley) * crumpleStrength);
            const highlight = Math.max(0, (diff - 0.68) * 0.62 * crumpleStrength);

            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.lineTo(pc.x, pc.y);
            ctx.closePath();
            if (darkness > 0.015) {
              ctx.fillStyle = isDark
                ? `rgba(4, 8, 20, ${Math.min(0.76, darkness * 1.15).toFixed(3)})`
                : `rgba(24, 34, 62, ${darkness.toFixed(3)})`;
              ctx.fill();
            }
            if (highlight > 0.015) {
              ctx.fillStyle = `rgba(255, 255, 255, ${highlight.toFixed(3)})`;
              ctx.fill();
            }
            // Delicate paper crease edge
            if (crumpleStrength > 0.08) {
              ctx.strokeStyle = isDark
                ? `rgba(255,255,255,${(0.06 * crumpleStrength).toFixed(3)})`
                : `rgba(15,23,42,${(0.08 * crumpleStrength).toFixed(3)})`;
              ctx.lineWidth = 0.55;
              ctx.stroke();
            }
          }
          ctx.restore();
        } else {
          startCollapse();
        }

        if (elapsed >= T_TOSS - 25 && !binHitTriggered) {
          binHitTriggered = true;
          if (binTab) {
            binTab.classList.remove("bin-hit");
            void binTab.offsetWidth;
            binTab.classList.add("bin-hit");
            setTimeout(() => binTab.classList.remove("bin-hit"), 460);
          }
        }
        if (elapsed >= T_TOSS - 15 && elapsed <= T_END) {
          const fp = (elapsed - (T_TOSS - 15)) / (T_END - (T_TOSS - 15));
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - fp);
          for (let i = 0; i < flecks.length; i++) {
            const fl = flecks[i];
            const fx = targetCx + fl.vx * fp;
            const fy = targetCy + fl.vy * fp + 24 * fp * fp;
            ctx.save();
            ctx.translate(fx, fy);
            ctx.rotate(fl.rot + fp * 5.0);
            ctx.fillStyle = i % 3 === 0 ? "#6366f1" : (isDark ? "#cbd5e1" : "#f1f5f9");
            ctx.strokeStyle = isDark ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.18)";
            ctx.lineWidth = 0.5;
            ctx.fillRect(-fl.size * 0.5, -fl.size * 0.35, fl.size, fl.size * 0.7);
            ctx.strokeRect(-fl.size * 0.5, -fl.size * 0.35, fl.size, fl.size * 0.7);
            ctx.restore();
          }
          ctx.restore();
        }

        if (elapsed < T_END) {
          requestAnimationFrame(renderFrame);
        } else {
          canvas.remove();
          cardEl.remove();
          resolve();
        }
      }

      requestAnimationFrame(renderFrame);
    });
  }

  async function loadMemories() {
    const q = $("zmSearchInput").value.trim();
    const ns = state.selectedNs;
    const qs = new URLSearchParams({ q, limit: "50" });
    if (ns) qs.set("ns", ns);
    try {
      const data = await api(`/memories?${qs.toString()}`);
      const list = $("zmList");
      $("zmSearchMeta").textContent = q
        ? `命中 ${data.count} 条 · ${data.elapsed_ms}ms`
        : `最新 ${data.count} 条`;

      if (!data.items || !data.items.length) {
        list.innerHTML = '<div class="zm-empty">暂无匹配记忆<br/>点右上角「写入」或在对话中自然沉淀</div>';
        return;
      }

      list.innerHTML = data.items
        .map((item) => {
          const evHtml = (item.evidence || [])
            .map((ev) => `<div class="zm-ev-item"><span class="zm-ev-id">${esc(ev.id)}</span>${highlightRedacted(ev.text)}</div>`)
            .join("");
          return `
            <article class="zm-card">
              <div class="zm-card-top">
                <div class="zm-tags">
                  <span class="zm-tag">#${item.fact_id}</span>
                  <span class="zm-tag">${esc(item.namespace)}</span>
                  ${item.action === "revise" ? '<span class="zm-tag rev">已纠错</span>' : ""}
                  ${item.until_expiry ? `<span class="zm-tag exp">${esc(item.until_expiry.label)}</span>` : ""}
                </div>
                <button class="zm-icon-btn square danger zm-evict-btn" data-fid="${item.fact_id}" type="button" aria-label="移入回收站" title="软淘汰至回收站（可恢复）">${ICONS.trash}</button>
              </div>
              <div class="zm-fact-text" data-toggle-ev="1" title="点击展开 / 收起原文">${highlightRedacted(item.text)}</div>
              <div class="zm-evidence-wrap">
                <div class="zm-evidence-clip">
                  <div class="zm-evidence">${evHtml || '<span style="color:var(--zm-muted)">无绑定原文片段</span>'}</div>
                </div>
              </div>
            </article>
          `;
        })
        .join("");

      list.querySelectorAll("[data-toggle-ev]").forEach((el) => {
        el.addEventListener("click", () => {
          el.nextElementSibling?.classList.toggle("open");
        });
      });

      list.querySelectorAll(".zm-evict-btn").forEach((btn) => {
        const fid = Number(btn.getAttribute("data-fid"));
        const cardEl = btn.closest(".zm-card");
        bindTwoStepConfirm(btn, async () => {
          await withUiBusy("移入回收站", async () => {
            try {
              state.evicting = true;
              await api("/evict", {
                method: "POST",
                body: JSON.stringify({ fact_id: fid, reason: "web-ui", force: true }),
              });
              await playPaperCrumpleToTrash(cardEl);
              await refreshStatus(true);
              if (!list.querySelector(".zm-card")) {
                await loadMemories();
              } else {
                const remain = list.querySelectorAll(".zm-card").length;
                $("zmSearchMeta").textContent = $("zmSearchInput").value.trim() ? `命中 ${remain} 条` : `最新 ${remain} 条`;
              }
            } catch (err) {
              showToast(`操作失败：${err.message}`, false);
            } finally {
              state.evicting = false;
            }
          });
        });
      });
    } catch (err) {
      showToast(`检索失败：${err.message}`, false);
    }
  }

  async function loadRecycleBin() {
    try {
      const data = await api("/evicted");
      const box = $("zmRecycleList");
      if (!data.batches || !data.batches.length) {
        box.innerHTML = '<div class="zm-empty">回收站为空</div>';
        return;
      }
      box.innerHTML = data.batches
        .map(
          (b) => `
          <article class="zm-card">
            <div class="zm-card-top">
              <div class="zm-tags">
                <span class="zm-tag">${esc(b.batch_id)}</span>
                <span class="zm-tag">${b.record_count} 项</span>
                <span class="zm-tag">${esc(b.reason)}</span>
              </div>
              <button class="zm-icon-btn primary zm-restore-btn" data-bid="${esc(b.batch_id)}" type="button" title="校验 SHA-256 并原子恢复">${ICONS.restore}<span>恢复</span></button>
            </div>
            <div style="font-size:11px;color:var(--zm-muted);">${esc((b.evicted_at || "").replace("T", " ").slice(0, 19))} · ${esc((b.namespaces || []).join(", "))}</div>
            ${(b.samples || []).map((s) => `<div style="font-size:11.5px;color:var(--zm-text-2);">• ${esc(s.preview)}</div>`).join("")}
          </article>
        `
        )
        .join("");

      box.querySelectorAll(".zm-restore-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const bid = btn.getAttribute("data-bid");
          await withUiBusy("恢复中", async () => {
            try {
              const res = await api("/restore", {
                method: "POST",
                body: JSON.stringify({ batch_id: bid }),
              });
              showToast(`指纹通过，已恢复 ${res.result.restored_facts} 条记忆`);
              await Promise.all([refreshStatus(true), loadRecycleBin()]);
            } catch (err) {
              showToast(`恢复失败：${err.message}`, false);
            }
          });
        });
      });
    } catch (err) {
      showToast(`加载回收站失败：${err.message}`, false);
    }
  }

  function readDraftConfig() {
    const apiBaseUrl = $("zmApiBaseUrl").value.trim();
    const apiModel = $("zmApiModel").value.trim();
    if (state.activePresetId === "custom" && apiBaseUrl) {
      state.customApiBaseUrl = apiBaseUrl;
      state.customApiModel = apiModel;
    }
    return {
      provider: state.providerDraft,
      ollamaUrl: $("zmOllamaUrl").value.trim(),
      ollamaModel: $("zmOllamaModel").value.trim(),
      numCtx: Number($("zmNumCtx").value || 8192),
      apiBaseUrl,
      apiModel,
      customApiBaseUrl: state.customApiBaseUrl || "",
      customApiModel: state.customApiModel || "",
      apiKey: $("zmApiKey").value.trim(),
      clearApiKey: state.clearApiKeyFlag,
      autoRecall: $("zmCfgAutoRecall").checked,
      autoRemember: $("zmCfgAutoRemember").checked,
      verify: $("zmCfgVerify").checked,
      untilExpiry: $("zmCfgUntil").checked,
      adaptive: $("zmCfgAdaptive").checked,
      namespaceMode: $("zmCfgWsNs").checked ? "workspace" : "fixed",
      uiTheme: state.theme,
    };
  }

  function openInstallModal() {
    const ps = state.lastProviderStatus || {};
    const note = $("zmInstallModalNote");
    const confirmBtn = $("zmInstallConfirmBtn");
    if (ps.state === "ollama_not_installed") {
      const guide = ps.install_guide || { command: "winget install Ollama.Ollama", downloadUrl: "https://ollama.com/download" };
      note.innerHTML = `未检测到本机 Ollama，请先安装 Ollama（命令：<code>${esc(guide.command)}</code>）后再确认下载。`;
      confirmBtn.innerHTML = `${ICONS.external}<span>前往下载 Ollama</span>`;
      confirmBtn.dataset.mode = "open-ollama-url";
      confirmBtn.dataset.url = guide.downloadUrl;
    } else if (ps.state === "ollama_stopped") {
      note.textContent = "检测到本机 Ollama 尚未启动：确认后将先自动后台启动 Ollama，再拉取开源专项小模型。";
      confirmBtn.innerHTML = `${ICONS.check}<span>确认启动并安装</span>`;
      confirmBtn.dataset.mode = "start-and-pull";
    } else {
      note.textContent = "确认后将通过本机 Ollama 下载开源专项小模型（作者 @B站IM榴莲），期间可实时查看进度并随时取消。";
      confirmBtn.innerHTML = `${ICONS.check}<span>确认安装</span>`;
      confirmBtn.dataset.mode = "pull";
    }
    $("zmInstallModal").classList.add("open");
  }

  function closeInstallModal() {
    $("zmInstallModal").classList.remove("open");
  }

  async function handleWallpaperFile(file) {
    if (!file) return;
    await withUiBusy("换壁纸", async () => {
      try {
        const dataUrl = await prepareImageDataUrl(file);
        state.hasCustomBg = true;
        state.bgUrl = dataUrl;
        applyAppearance();

        const res = await api("/background", {
          method: "POST",
          body: JSON.stringify({ dataUrl }),
        });
        if (res.config?.uiBackgroundUrl) {
          state.hasCustomBg = true;
          state.bgUrl = res.config.uiBackgroundUrl;
          applyAppearance();
        }
        showToast("背景图已更新并应用毛玻璃");
      } catch (err) {
        showToast(`背景图设置失败：${err.message}`, false);
      }
    });
  }

  function switchTab(tab) {
    state.tab = tab;
    const idxMap = { memories: 0, recycle: 1, settings: 2 };
    $("zmTabsNav").style.setProperty("--zm-tab-idx", String(idxMap[tab] ?? 0));
    shadow.querySelectorAll(".zm-tab").forEach((btn) => {
      const active = btn.getAttribute("data-tab") === tab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    $("zmPaneMemories").classList.toggle("active", tab === "memories");
    $("zmPaneRecycle").classList.toggle("active", tab === "recycle");
    $("zmPaneSettings").classList.toggle("active", tab === "settings");
    if (tab === "memories") loadMemories();
    if (tab === "recycle") loadRecycleBin();
    if (tab === "settings") refreshStatus(false);
  }

  function setOpen(flag) {
    state.open = Boolean(flag);
    $("zmDrawer").classList.toggle("open", state.open);
    $("zmBackdrop").classList.toggle("open", state.open);
    if (state.open) {
      refreshStatus(false);
      if (state.tab === "memories") loadMemories();
      if (state.tab === "recycle") loadRecycleBin();
    }
  }

  // Draggable pill shell with click detection
  (function initPillDrag() {
    const shell = $("zmPillShell");
    const pill = $("zmPill");
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (saved && typeof saved.right === "number" && typeof saved.bottom === "number") {
        shell.style.right = `${Math.max(8, Math.min(window.innerWidth - 104, saved.right))}px`;
        shell.style.bottom = `${Math.max(8, Math.min(window.innerHeight - 52, saved.bottom))}px`;
      }
    } catch {}

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startRight = 20;
    let startBottom = 88;

    pill.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = shell.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
      pill.setPointerCapture(e.pointerId);
    });

    pill.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      if (!moved) return;
      const r = Math.max(8, Math.min(window.innerWidth - 104, startRight - dx));
      const b = Math.max(8, Math.min(window.innerHeight - 52, startBottom - dy));
      shell.style.right = `${r}px`;
      shell.style.bottom = `${b}px`;
    });

    pill.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        try {
          localStorage.setItem(
            POS_KEY,
            JSON.stringify({ right: parseFloat(shell.style.right) || 20, bottom: parseFloat(shell.style.bottom) || 88 })
          );
        } catch {}
      } else {
        setOpen(!state.open);
      }
    });
  })();

  $("zmBackdrop").addEventListener("click", () => setOpen(false));
  $("zmCloseBtn").addEventListener("click", () => setOpen(false));
  $("zmRefreshBtn").addEventListener("click", () => {
    withUiBusy("刷新中", async () => {
      await refreshStatus(false);
      if (state.tab === "memories") await loadMemories();
      if (state.tab === "recycle") await loadRecycleBin();
    });
  });

  async function setTheme(next) {
    state.theme = next === "dark" ? "dark" : "light";
    applyAppearance();
    try {
      await api("/config", { method: "POST", body: JSON.stringify({ uiTheme: state.theme }) });
    } catch {
      // fail-open
    }
  }
  $("zmThemeBtn").addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));
  $("zmThemeLightBtn").addEventListener("click", () => setTheme("light"));
  $("zmThemeDarkBtn").addEventListener("click", () => setTheme("dark"));

  const fileInput = $("zmBgFileInput");
  const openFilePicker = () => {
    fileInput.value = "";
    fileInput.click();
  };
  $("zmBgQuickBtn").addEventListener("click", openFilePicker);
  $("zmBgDrop").addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    openFilePicker();
  });
  $("zmBgDrop").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) handleWallpaperFile(file);
  });

  const bgDrop = $("zmBgDrop");
  bgDrop.addEventListener("dragover", (e) => {
    e.preventDefault();
    bgDrop.classList.add("dragover");
  });
  bgDrop.addEventListener("dragleave", () => bgDrop.classList.remove("dragover"));
  bgDrop.addEventListener("drop", (e) => {
    e.preventDefault();
    bgDrop.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleWallpaperFile(file);
  });

  $("zmClearBgBtn").addEventListener("click", async (e) => {
    e.stopPropagation();
    await withUiBusy("重置壁纸", async () => {
      try {
        await api("/background", { method: "DELETE" });
        state.hasCustomBg = false;
        state.bgUrl = "";
        applyAppearance();
        showToast("已恢复默认毛玻璃");
      } catch (err) {
        showToast(`清除失败：${err.message}`, false);
      }
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if ($("zmInstallModal").classList.contains("open")) {
        closeInstallModal();
        return;
      }
      if ($("zmNsDd").classList.contains("open")) {
        setNsMenuOpen(false);
        return;
      }
      if (state.open) setOpen(false);
    }
  });

  $("zmOpenInstallModalBtn").addEventListener("click", () => {
    openInstallModal();
  });
  $("zmInstallCancelBtn").addEventListener("click", closeInstallModal);
  $("zmInstallModal").addEventListener("click", (e) => {
    if (e.target === $("zmInstallModal")) closeInstallModal();
  });
  $("zmInstallVerGrid").querySelectorAll(".zm-ver-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedInstallModel = card.getAttribute("data-model") || state.selectedInstallModel;
      $("zmInstallVerGrid").querySelectorAll(".zm-ver-card").forEach((c) => {
        c.classList.toggle("active", c === card);
      });
    });
  });
  $("zmInstallConfirmBtn").addEventListener("click", async () => {
    const mode = $("zmInstallConfirmBtn").dataset.mode || "pull";
    if (mode === "open-ollama-url") {
      window.open($("zmInstallConfirmBtn").dataset.url || "https://ollama.com/download", "_blank", "noopener,noreferrer");
      closeInstallModal();
      return;
    }
    closeInstallModal();
    if (mode === "start-and-pull") {
      await triggerStartOllama();
    }
    await triggerPullModel(state.selectedInstallModel);
  });

  $("zmApiBaseUrl").addEventListener("input", () => {
    const matched = detectPresetId($("zmApiBaseUrl").value, state.config?.presets || []);
    updateApiPresetUi(matched);
    if (matched === "custom") {
      state.customApiBaseUrl = $("zmApiBaseUrl").value.trim();
    }
  });
  $("zmApiModel").addEventListener("input", () => {
    if (state.activePresetId === "custom") {
      state.customApiModel = $("zmApiModel").value.trim();
    }
  });

  shadow.addEventListener("click", (e) => {
    if (!e.target?.closest?.("#zmNsDd")) setNsMenuOpen(false);
  });

  $("zmNsTrigger").addEventListener("click", (e) => {
    e.stopPropagation();
    setNsMenuOpen(!$("zmNsDd").classList.contains("open"));
  });

  shadow.querySelectorAll(".zm-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
  });

  $("zmSearchInput").addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(loadMemories, 150);
  });

  $("zmAddToggle").addEventListener("click", () => {
    const wrap = $("zmAddWrap");
    const open = wrap.classList.toggle("open");
    if (open) setTimeout(() => $("zmAddText").focus(), 140);
  });

  $("zmAddSubmit").addEventListener("click", async () => {
    const content = $("zmAddText").value.trim();
    if (!content) {
      showToast("请先输入内容", false);
      return;
    }
    const btn = $("zmAddSubmit");
    btn.disabled = true;
    await withUiBusy("沉淀中", async () => {
      try {
        const res = await api("/remember", {
          method: "POST",
          body: JSON.stringify({
            content,
            namespace: $("zmAddNs").value.trim() || undefined,
            verify: $("zmAddVerify").checked,
          }),
        });
        const r = res.result;
        showToast(
          r.deduplicated
            ? `已去重（${r.doc_id}）`
            : `入库 ${r.saved} 条事实（纠错 ${r.revised}，拦截 ${r.dropped}）`
        );
        $("zmAddText").value = "";
        $("zmAddWrap").classList.remove("open");
        await Promise.all([refreshStatus(true), loadMemories()]);
      } catch (err) {
        showToast(`写入失败：${err.message}`, false);
      } finally {
        btn.disabled = false;
      }
    });
  });

  bindTwoStepConfirm($("zmEvictExpiredBtn"), async () => {
    await withUiBusy("清理中", async () => {
      try {
        const res = await api("/evict", {
          method: "POST",
          body: JSON.stringify({ expired: true, reason: "expired-cleanup", force: true }),
        });
        showToast(
          res.result.total_records
            ? `已清理 ${res.result.total_records} 条过期记忆（${res.result.batch_id}）`
            : "当前无已过期记忆"
        );
        await Promise.all([refreshStatus(true), loadRecycleBin()]);
      } catch (err) {
        showToast(`清理失败：${err.message}`, false);
      }
    });
  });

  $("zmPickOllama").addEventListener("click", () => {
    state.providerDraft = "ollama";
    renderProviderFields();
  });
  $("zmPickApi").addEventListener("click", () => {
    state.providerDraft = "openai-compatible";
    renderProviderFields();
  });

  $("zmClearKeyBtn").addEventListener("click", () => {
    state.clearApiKeyFlag = true;
    $("zmApiKey").value = "";
    $("zmApiKeyHint").textContent = "保存后清除";
  });

  $("zmTestBtn").addEventListener("click", async () => {
    const btn = $("zmTestBtn");
    btn.disabled = true;
    await withUiBusy("检测中", async () => {
      try {
        const draft = readDraftConfig();
        const data = await api("/test-provider", {
          method: "POST",
          body: JSON.stringify({ ...draft, liveChat: draft.provider === "openai-compatible" }),
        });
        const p = data.probe || {};
        state.lastProviderStatus = p;
        renderBusyHalo();
        renderLocalSetupGuides();
        showToast(p.message || (p.ok ? "连接正常" : "连接失败"), Boolean(p.ok));
        if (p.available_models?.length && draft.provider === "ollama") {
          const dl = $("zmOllamaModelList");
          dl.innerHTML = "";
          for (const m of p.available_models) {
            const opt = document.createElement("option");
            opt.value = m;
            dl.appendChild(opt);
          }
          $("zmOllamaAvail").textContent = `已发现 ${p.available_models.length} 个`;
        }
      } catch (err) {
        showToast(`测试失败：${err.message}`, false);
      } finally {
        btn.disabled = false;
      }
    });
  });

  $("zmSaveCfgBtn").addEventListener("click", async () => {
    const btn = $("zmSaveCfgBtn");
    btn.disabled = true;
    await withUiBusy("保存中", async () => {
      try {
        const data = await api("/config", {
          method: "POST",
          body: JSON.stringify(readDraftConfig()),
        });
        populateConfigForm(data.config, null);
        showToast("配置已保存并立即生效");
        await refreshStatus(false);
      } catch (err) {
        showToast(`保存失败：${err.message}`, false);
      } finally {
        btn.disabled = false;
      }
    });
  });

  function mount() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", mount, { once: true });
      return;
    }
    applyAppearance();
    renderNamespaceMenu();
    if (!document.getElementById("dsh-zeromem-root")) {
      document.body.appendChild(host);
    }
    connectEvents();
    // Run automatic detection immediately on mount so first-time users see one-click setup guidance
    refreshStatus(false);
    setInterval(() => {
      if (!state.open && !state.setupState?.active) refreshStatus(true);
    }, 30_000);
  }

  mount();
})();
