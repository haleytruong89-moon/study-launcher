import { addDays, weekStart } from "@/lib/time";

/**
 * Nguyên's comic volumes (R5): one volume per week (Monday → Sunday, Asia/Ho_Chi_Minh). Tập 1 is
 * the week of the child's first record; past weeks with a record stand on the shelf. PURE.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date "YYYY-MM-DD" that is a Monday (the only accepted ?week=). */
export function isMonday(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  try {
    // A date that rolls over (2026-02-30 → 03-02) is not the same string any more.
    return addDays(v, 0) === v && weekStart(v) === v;
  } catch {
    return false;
  }
}

/** Volume number of the week starting `monday`: whole weeks since the first record's Monday, plus 1 (min 1). */
export function volumeOf(firstMonday: string | null, monday: string): number {
  if (!firstMonday) return 1;
  const days = Math.round((Date.parse(`${monday}T00:00:00Z`) - Date.parse(`${firstMonday}T00:00:00Z`)) / 86_400_000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

export interface ShelfVolume {
  weekStart: string;
  volume: number;
}

export const SHELF_MAX = 12;

/**
 * The shelf: past weeks (before `thisMonday`) that have at least one record, newest first, at
 * most 12. `dates` are local dates of any record (duplicates and junk are fine).
 */
export function shelfOf(dates: readonly string[], firstMonday: string | null, thisMonday: string): ShelfVolume[] {
  if (!firstMonday) return [];
  const weeks = new Set<string>();
  for (const d of dates) {
    if (!DATE_RE.test(d)) continue;
    const w = weekStart(d);
    if (w >= firstMonday && w < thisMonday) weeks.add(w);
  }
  return [...weeks]
    .sort()
    .reverse()
    .slice(0, SHELF_MAX)
    .map((w) => ({ weekStart: w, volume: volumeOf(firstMonday, w) }));
}

/**
 * Which week a request may read (R5 GET /api/week/days?week=): no `wanted` = this week; else a
 * Monday from the first record's week up to this week. With no record yet only this week exists.
 * null = not allowed (the route answers 404).
 */
export function resolveWeek(wanted: string | null | undefined, thisMonday: string, firstMonday: string | null): string | null {
  if (!wanted || wanted === thisMonday) return thisMonday;
  if (wanted > thisMonday) return null;
  if (!firstMonday || wanted < firstMonday) return null;
  return wanted;
}
