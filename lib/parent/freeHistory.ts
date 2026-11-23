/**
 * "Giờ tự do 7 ngày qua" on the parent's Thiết bị page (parent report 23/11/2026: An's laptop
 * did not lock after 45'). PURE display helpers: when free time ran each day, how long, how
 * much came from saved break minutes, and what the parent changed by hand that day. The day's
 * numbers come from computeDayState (the same rules the extension obeys); nothing here decides
 * locking.
 */
import type { DayState } from "@/lib/dayState";
import { localDate } from "@/lib/time";
import { vnTime } from "@/lib/today/view";

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

export interface FreeDay {
  date: string;
  /** "T7 22/11". */
  label: string;
  /** "22:58 → 23:53", or null when free time never started that day. */
  window: string | null;
  /** "45′ + 10′ để dành", "45′", "dừng lúc 00:00 (còn 12′)". */
  detail: string | null;
  /** What the parent changed by hand that day, oldest first: "21:05 Mở máy đến 22:00". */
  overrides: string[];
}

export interface OverrideRow {
  action: string;
  payload: unknown;
  created_at: string;
}

function weekdayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return `${WEEKDAY[d]} ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function record(p: unknown): Record<string, unknown> {
  return p && typeof p === "object" ? (p as Record<string, unknown>) : {};
}

/** The parent's own lock/open changes for one child, one line each, oldest first. */
export function overrideLines(rows: OverrideRow[], childId: string, date: string): string[] {
  return rows
    .filter((r) => record(r.payload).child_id === childId && localDate(new Date(r.created_at)) === date)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => {
      const p = record(r.payload);
      const until = typeof p.until === "string" ? ` đến ${vnTime(p.until)}` : "";
      const at = vnTime(r.created_at);
      switch (r.action) {
        case "override.open":
          return `${at} Bố mẹ mở máy${until}`;
        case "override.lock":
          return `${at} Bố mẹ khóa máy${until}`;
        case "override.extend":
          return `${at} Bố mẹ cộng ${typeof p.minutes === "number" ? `${p.minutes} phút` : "thêm giờ"}${until}`;
        case "override.clear":
          return `${at} Bố mẹ đưa máy về bình thường`;
        default:
          return null;
      }
    })
    .filter((l): l is string => l !== null);
}

/**
 * One day's line from that day's DayState (computed at the end of the day, or now for today).
 * `freeMinutes` is the family's free time; the stored day ends at free_started_at +
 * freeMinutes + the saved break minutes, cut at 00:00.
 */
export function freeDay(date: string, state: DayState | null, freeMinutes: number, overrides: string[]): FreeDay {
  const label = weekdayLabel(date);
  const f = state?.free;
  if (!f?.startedAt || !f.endsAt) return { date, label, window: null, detail: null, overrides };
  const ran = Math.max(0, Math.round((Date.parse(f.endsAt) - Date.parse(f.startedAt)) / 60_000));
  const planned = freeMinutes + f.bonusMinutes;
  const parts = f.bonusMinutes > 0 ? `${freeMinutes}′ + ${f.bonusMinutes}′ để dành` : `${freeMinutes}′`;
  const detail = ran < planned ? `${parts} · dừng lúc 00:00 (mất ${planned - ran}′)` : parts;
  return { date, label, window: `${vnTime(f.startedAt)} → ${vnTime(f.endsAt)}`, detail, overrides };
}
