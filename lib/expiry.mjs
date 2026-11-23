/**
 * Time-expiry tags (`until:YYYY-MM-DD` / `until:YYYYMMDD`) and adaptive dual-lane gating.
 *
 * Parity with Python ZeroMem (`v2mem/expiry.py`):
 * - Zero schema changes: inspects explicit `until:` markers in tags, entities, text, or bound evidence.
 * - Strict calendar validation (fail-open: invalid dates such as 2026-02-30 are ignored).
 * - Non-destructive annotation: never rewrites `text` or evidence quotes; expired records are
 *   stable-partitioned to the tail with structured `until_expiry` metadata.
 * - Adaptive relative-score gating: keeps hits within `[minLimit, cap]` above
 *   `score >= scoreRatio * leadingActiveScore`, with rollback via env `ZEROMEM_ADAPTIVE_LIMIT_DISABLED=1`.
 */

export const ADAPTIVE_MIN_LIMIT = 2;
export const ADAPTIVE_MAX_LIMIT = 8;
export const LEGACY_FIXED_LIMIT = 6;
export const ADAPTIVE_SCORE_RATIO = 0.35;

const UNTIL_TOKEN_RE = /^until:(\d{4})-?(\d{2})-?(\d{2})$/i;
const UNTIL_INLINE_RE = /(?<![A-Za-z0-9_])until:(\d{4})-?(\d{2})-?(\d{2})(?![0-9])/gi;
const DISABLED_VALUES = new Set(["0", "off", "false", "no"]);
const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function isUntilDisabled(env = process.env) {
  for (const key of ["ZEROMEM_UNTIL", "MEMORY_UNTIL"]) {
    const raw = env?.[key];
    if (typeof raw === "string" && DISABLED_VALUES.has(raw.trim().toLowerCase())) {
      return true;
    }
  }
  return false;
}

export function isAdaptiveLimitDisabled(env = process.env) {
  for (const key of ["ZEROMEM_ADAPTIVE_LIMIT_DISABLED", "EVENT_MEMORY_ADAPTIVE_LIMIT_DISABLED"]) {
    const raw = env?.[key];
    if (typeof raw === "string" && ENABLED_VALUES.has(raw.trim().toLowerCase())) {
      return true;
    }
  }
  return false;
}

export function resolveDefaultLimit(limit = null, { adaptive = true, env = process.env } = {}) {
  if (limit !== null && limit !== undefined) {
    const n = Number(limit);
    if (Number.isFinite(n)) return Math.max(1, Math.min(Math.trunc(n), 50));
  }
  if (!adaptive || isAdaptiveLimitDisabled(env)) {
    return LEGACY_FIXED_LIMIT;
  }
  return ADAPTIVE_MAX_LIMIT;
}

/**
 * Validate calendar date strictly and return canonical YYYY-MM-DD or null.
 */
export function parseCalendarDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1970 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function resolveAsOfDate(today = null) {
  if (today instanceof Date && Number.isFinite(today.getTime())) {
    return parseCalendarDate(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate());
  }
  if (typeof today === "string") {
    const m = /^\s*(\d{4})-?(\d{2})-?(\d{2})(?:$|T)/.exec(today);
    if (m) {
      const parsed = parseCalendarDate(Number(m[1]), Number(m[2]), Number(m[3]));
      if (parsed) return parsed;
    }
  }
  const now = new Date();
  return parseCalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function daysBetween(isoA, isoB) {
  const msA = Date.parse(`${isoA}T00:00:00Z`);
  const msB = Date.parse(`${isoB}T00:00:00Z`);
  return Math.round((msA - msB) / 86_400_000);
}

function extractDatesFromText(text) {
  const found = [];
  if (typeof text !== "string" || !text.toLowerCase().includes("until:")) return found;
  UNTIL_INLINE_RE.lastIndex = 0;
  let m;
  while ((m = UNTIL_INLINE_RE.exec(text)) !== null) {
    const parsed = parseCalendarDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (parsed) found.push(parsed);
  }
  return found;
}

/**
 * Return the latest valid `until:` YYYY-MM-DD date from tags, metadata, text, or bound evidence.
 */
export function parseUntilDate({ tags = null, metadata = null, text = null, evidence = null } = {}) {
  const candidates = [];

  let tokens = [];
  if (typeof tags === "string") {
    tokens = tags.trim().split(/[\s,]+/).filter(Boolean);
  } else if (Array.isArray(tags)) {
    tokens = tags.filter((t) => typeof t === "string");
  }

  for (const token of tokens) {
    const trimmed = token.trim().replace(/^[\[\]()]+|[\[\]()]+$/g, "");
    const m = UNTIL_TOKEN_RE.exec(trimmed);
    if (m) {
      const parsed = parseCalendarDate(Number(m[1]), Number(m[2]), Number(m[3]));
      if (parsed) candidates.push(parsed);
    } else {
      candidates.push(...extractDatesFromText(trimmed));
    }
  }

  if (metadata && typeof metadata === "object" && typeof metadata.until === "string" && metadata.until.trim()) {
    const trimmed = metadata.until.trim();
    const prefixed = trimmed.toLowerCase().startsWith("until:") ? trimmed : `until:${trimmed}`;
    const m = UNTIL_TOKEN_RE.exec(prefixed);
    if (m) {
      const parsed = parseCalendarDate(Number(m[1]), Number(m[2]), Number(m[3]));
      if (parsed) candidates.push(parsed);
    }
  }

  if (typeof text === "string") {
    candidates.push(...extractDatesFromText(text));
  }

  if (Array.isArray(evidence)) {
    for (const seg of evidence) {
      if (seg && typeof seg === "object" && typeof seg.text === "string") {
        candidates.push(...extractDatesFromText(seg.text));
      }
    }
  }

  if (!candidates.length) return null;
  candidates.sort();
  return candidates[candidates.length - 1];
}

export function evaluateExpiry(untilIso, asOfIso) {
  if (!untilIso || !asOfIso) return null;
  const expiredDays = daysBetween(asOfIso, untilIso);
  if (expiredDays <= 0) return null;
  return {
    until: untilIso,
    expired: true,
    expired_days: expiredDays,
    label: `已过期（until ${untilIso}）`,
  };
}

/**
 * Non-destructively stable-partition expired records to the tail.
 */
export function partitionExpired(records, { today = null, enabled = true, env = process.env } = {}) {
  if (!enabled || isUntilDisabled(env)) {
    return {
      items: records.map((r) => ({ ...r })),
      expiredCount: 0,
    };
  }
  const asOf = resolveAsOfDate(today);
  const active = [];
  const expired = [];
  for (const row of records) {
    const untilDate = parseUntilDate({
      tags: row.entities,
      text: row.text,
      evidence: row.evidence,
    });
    const info = evaluateExpiry(untilDate, asOf);
    if (info) {
      expired.push({ ...row, until_expiry: info });
    } else {
      const copy = { ...row };
      delete copy.until_expiry;
      active.push(copy);
    }
  }
  return {
    items: [...active, ...expired],
    expiredCount: expired.length,
  };
}

/**
 * Adaptive relative-score gating anchored on leading active hit.
 */
export function selectAdaptiveHits(
  records,
  {
    limit = ADAPTIVE_MAX_LIMIT,
    minLimit = ADAPTIVE_MIN_LIMIT,
    scoreRatio = ADAPTIVE_SCORE_RATIO,
    adaptive = true,
    env = process.env,
  } = {}
) {
  const cap = Math.max(1, Number(limit) || ADAPTIVE_MAX_LIMIT);
  if (!records.length) return [];
  if (!adaptive || isAdaptiveLimitDisabled(env)) {
    return records.slice(0, cap);
  }

  const floor = Math.max(1, Math.min(Number(minLimit) || ADAPTIVE_MIN_LIMIT, cap));
  const ratio = Math.max(0, Math.min(Number(scoreRatio) || ADAPTIVE_SCORE_RATIO, 1));

  let leading = 0;
  for (const row of records) {
    if (!row.until_expiry) {
      const sc = Number(row.score || 0);
      if (sc > leading) leading = sc;
    }
  }
  if (leading <= 0) {
    for (const row of records) {
      const sc = Number(row.score || 0);
      if (sc > leading) leading = sc;
    }
  }
  if (leading <= 0) {
    return records.slice(0, cap);
  }

  const cutoff = leading * ratio;
  const selected = [];
  for (const row of records) {
    if (selected.length >= cap) break;
    const sc = Number(row.score || 0);
    if (selected.length < floor || sc >= cutoff) {
      selected.push(row);
    } else {
      break;
    }
  }
  return selected;
}
