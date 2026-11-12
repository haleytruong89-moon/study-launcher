import { MINUTE_MS } from "./instants";

// ---------------------------------------------------------------------------
// Break bank (R8b, interpretation 19). Pure, exported for tests.
// ---------------------------------------------------------------------------

/** `[focusMinutes, breakMinutes]`: from `focusMinutes` of focus in one block, `breakMinutes` of break. */
export type BreakTier = readonly [number, number];

/** family_settings.break_tiers default (0014). */
export const DEFAULT_BREAK_TIERS: readonly BreakTier[] = [
  [45, 10],
  [90, 30],
  [120, 45],
  [180, 60],
];
/** family_settings.break_max_per_day default (0014). */
export const DEFAULT_BREAK_MAX_PER_DAY = 6;
/** family_settings.break_run_cap_minutes default (0014, parent decision 09/11/2026). */
export const DEFAULT_BREAK_RUN_CAP_MINUTES = 180;
/** A break may start only with at least this many minutes in the bank (rule 1). */
export const MIN_BREAK_MINUTES = 5;
/** At most this many tiers are accepted. */
export const MAX_BREAK_TIERS = 8;

/** 1-8 pairs of positive integers (<= 1440), both columns strictly ascending. */
export function validBreakTiers(value: unknown): value is BreakTier[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BREAK_TIERS) return false;
  let prevFocus = 0;
  let prevBreak = 0;
  for (const t of value) {
    if (!Array.isArray(t) || t.length !== 2) return false;
    const [f, b] = t as unknown[];
    if (!Number.isInteger(f) || !Number.isInteger(b)) return false;
    const fi = f as number;
    const bi = b as number;
    if (fi <= prevFocus || bi <= prevBreak || fi > 1440 || bi > 1440) return false;
    prevFocus = fi;
    prevBreak = bi;
  }
  return true;
}

/** The tiers to use: `value` when valid, else the defaults (malformed data never crashes the day). */
export function breakTiersOf(value: unknown): readonly BreakTier[] {
  return validBreakTiers(value) ? value : DEFAULT_BREAK_TIERS;
}

export function breakRunCapOf(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 30 && (value as number) <= 600 ? (value as number) : DEFAULT_BREAK_RUN_CAP_MINUTES;
}

export function breakMaxOf(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 12 ? (value as number) : DEFAULT_BREAK_MAX_PER_DAY;
}

/**
 * Break minutes earned by `focusMinutes` of focus in ONE block: the highest tier with
 * focusMinutes <= F; from the top tier on, the rest counts again as a new block
 * (default tiers: 44 -> 0, 45 -> 10, 90 -> 30, 180 -> 60, 225 -> 70, 360 -> 120).
 */
export function earnBreak(focusMinutes: number, tiers: unknown = DEFAULT_BREAK_TIERS): number {
  if (!Number.isFinite(focusMinutes) || focusMinutes <= 0) return 0;
  const t = breakTiersOf(tiers);
  const [topFocus, topBreak] = t[t.length - 1] as BreakTier;
  let rest = Math.floor(focusMinutes);
  let earned = Math.floor(rest / topFocus) * topBreak;
  rest %= topFocus;
  for (let i = t.length - 1; i >= 0; i--) {
    const [f, b] = t[i] as BreakTier;
    if (f <= rest) {
      earned += b;
      break;
    }
  }
  return earned;
}

/** A half-open interval [start, end) in ms. */
export type Interval = readonly [number, number];

/** Sorted, merged, non-empty intervals. */
function unionOf(list: readonly Interval[]): Interval[] {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

function lengthWithin(list: readonly Interval[], lo: number, hi: number): number {
  let ms = 0;
  for (const [a, b] of list) ms += Math.max(0, Math.min(b, hi) - Math.max(a, lo));
  return ms;
}

/**
 * Focus (rule 19): the union of the run intervals, clipped to [dayStartMs, untilMs), minus the
 * union of the excluded intervals. Overlapping runs count once.
 */
export function focusIntervals(runs: readonly Interval[], excluded: readonly Interval[], dayStartMs: number, untilMs: number): Interval[] {
  const base = unionOf(runs.map(([a, b]): Interval => [Math.max(a, dayStartMs), Math.min(b, untilMs)]));
  const cut = unionOf(excluded);
  const out: Interval[] = [];
  for (const [a, b] of base) {
    let start = a;
    for (const [x, y] of cut) {
      if (y <= start || x >= b) continue;
      if (x > start) out.push([start, x]);
      start = Math.max(start, y);
      if (start >= b) break;
    }
    if (start < b) out.push([start, b]);
  }
  return out;
}

/** A break for the bank: its start and the instant it really ended (ended_at, planned end, free time). */
export interface BankBreak {
  startMs: number;
  endMs: number;
}

export interface BankResult {
  /** max(0, earned - used). */
  bankMinutes: number;
  /** Earned by every block (closed ones + the current one). */
  earnedMinutes: number;
  /** Used in the breaks started up to `atMs`. */
  usedMinutes: number;
  /** Focus minutes of the current block (since the latest break started). */
  blockFocusMinutes: number;
}

/**
 * The bank at `atMs` (rule 19): breaks started up to `atMs` close the blocks; each block earns
 * earnBreak(floor(its focus minutes)); each break used floor((min(endMs, atMs) - startMs) / 1').
 * `extraUsedMinutes` = a legacy break_skipped with no start.
 */
export function breakBank(focus: readonly Interval[], breaks: readonly BankBreak[], tiers: unknown, dayStartMs: number, atMs: number, extraUsedMinutes = 0): BankResult {
  const started = breaks.filter((b) => b.startMs <= atMs).sort((x, y) => x.startMs - y.startMs);
  let earned = 0;
  let used = extraUsedMinutes;
  let from = dayStartMs;
  for (const b of started) {
    earned += earnBreak(Math.floor(lengthWithin(focus, from, b.startMs) / MINUTE_MS), tiers);
    used += Math.max(0, Math.floor((Math.min(b.endMs, atMs) - b.startMs) / MINUTE_MS));
    from = Math.max(from, b.startMs);
  }
  const block = Math.floor(lengthWithin(focus, from, atMs) / MINUTE_MS);
  earned += earnBreak(block, tiers);
  return { bankMinutes: Math.max(0, earned - used), earnedMinutes: earned, usedMinutes: used, blockFocusMinutes: block };
}

/** The next block length (> blockMinutes) that earns more, and the bank then; null if none in a day. */
export function nextTierOf(blockMinutes: number, rawBankMinutes: number, tiers: unknown): { atFocus: number; minutes: number } | null {
  const now = earnBreak(blockMinutes, tiers);
  for (let f = blockMinutes + 1; f <= blockMinutes + 1440; f++) {
    const e = earnBreak(f, tiers);
    if (e > now) return { atFocus: f, minutes: Math.max(0, rawBankMinutes + e - now) };
  }
  return null;
}
