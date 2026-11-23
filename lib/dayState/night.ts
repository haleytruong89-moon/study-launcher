import { MINUTE_MS } from "./instants";

/** family_settings defaults (0027, parent decision 23/11/2026): no opening from 00:00 to 07:00. */
export const DEFAULT_NIGHT_FROM = "00:00";
export const DEFAULT_NIGHT_TO = "07:00";
const DAY_MS = 24 * 60 * MINUTE_MS;

/** "HH:MM" or "HH:MM:SS" → minutes after 00:00; anything else → null. */
export function clockMinutes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export interface NightWindow {
  /** Inside the night window right now. */
  active: boolean;
  /** When the current night ends (active), else null. */
  untilMs: number | null;
  /** Today's night start if it is still ahead (open windows stop there), else null. */
  nextStartMs: number | null;
  from: string;
  to: string;
}

/**
 * The night lock (parent decision 23/11/2026, "Khóa đêm", family-wide, data in family_settings):
 * from `from` to `to` (local time; may wrap past 00:00, e.g. 22:30 → 07:00) nothing OPENS the
 * laptop — no free time, break, pass, trust or sick-day opening; study pages stay open as in any
 * locked status. A parent's open override still wins. from === to → no night lock. Malformed →
 * the defaults. Both absent (an input built without the 0027 settings) → no night lock: the
 * loader always passes the family's values or the defaults. Pure.
 */
export function nightWindow(fromRaw: unknown, toRaw: unknown, dayStartMs: number, nowMs: number): NightWindow {
  if (fromRaw === undefined && toRaw === undefined) return { active: false, untilMs: null, nextStartMs: null, from: "00:00", to: "00:00" };
  const f = clockMinutes(fromRaw) ?? (clockMinutes(DEFAULT_NIGHT_FROM) as number);
  const t = clockMinutes(toRaw) ?? (clockMinutes(DEFAULT_NIGHT_TO) as number);
  const hhmm = (x: number) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  const base = { from: hhmm(f), to: hhmm(t) };
  if (f === t) return { active: false, untilMs: null, nextStartMs: null, ...base };
  const m = Math.floor((nowMs - dayStartMs) / MINUTE_MS);
  const wraps = f > t;
  const active = wraps ? m >= f || m < t : m >= f && m < t;
  const untilMs = !active ? null : wraps && m >= f ? dayStartMs + DAY_MS + t * MINUTE_MS : dayStartMs + t * MINUTE_MS;
  const startToday = dayStartMs + f * MINUTE_MS;
  return { active, untilMs, nextStartMs: !active && startToday > nowMs ? startToday : null, ...base };
}
