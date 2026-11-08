import { findWord, isQuad, type Quad } from "@/lib/binhYen/catalog";
import { addDays } from "@/lib/time";

/**
 * "Tuần của con" (R2, docs/MAN_CHINH_MOI.md §2.2 and §7): for each day Monday → Sunday, which
 * of the four areas the child did — Cảm xúc (a finished Góc bình yên visit), Học tập (Part 1
 * milestone), Kỹ năng (Part 2 milestone), Vui chơi (free time started).
 *
 * The feeling is shown ONLY to the child (parent decision 07/11/2026): this module is used by a
 * child-session route only, and it is never part of DayState / todayView / the weekly review,
 * which parent pages reuse. Pure: safe in tests and in the browser.
 */

export interface WeekFeel {
  quad: Quad;
  /** Catalog key of the word, and its label ("vui", "mệt"…). */
  word: string;
  label: string;
  /** Catalog key of the activity done on that visit, or null (named the feeling only). R6d. */
  activity: string | null;
}

export interface WeekDay {
  date: string;
  /** Days after today are listed (the strip always shows 7 days) but have nothing yet. */
  future: boolean;
  /** The LAST finished visit of that day, or null. Always null when Góc bình yên is off. */
  feel: WeekFeel | null;
  study: boolean;
  skill: boolean;
  play: boolean;
}

export interface WeekDaysBase {
  /** Góc bình yên is on for the family (else the Cảm xúc row is hidden). */
  byEnabled: boolean;
  weekStart: string;
  today: string;
  days: WeekDay[];
}

export interface WeekDaysView extends WeekDaysBase {
  /** R5: Nguyên's comic volume number of this week (Tập 1 = the week of the first record). */
  volume: number;
  /** R5: past weeks with at least one record, newest first, at most 12 (Kệ truyện). */
  shelf: { weekStart: string; volume: number }[];
}

export interface WeekSessionRow {
  local_date: string;
  part1_done_at: string | null;
  part2_done_at: string | null;
  free_started_at: string | null;
}

export interface WeekCheckinRow {
  local_date: string;
  quad: string;
  word_key: string;
  created_at: string;
  activity_key: string | null;
}

export function buildWeekDays(
  monday: string,
  today: string,
  sessions: WeekSessionRow[],
  checkins: WeekCheckinRow[] | null,
): WeekDaysBase {
  const byDate = new Map(sessions.map((s) => [s.local_date, s]));
  const lastFeel = new Map<string, WeekCheckinRow>();
  for (const c of checkins ?? []) {
    const prev = lastFeel.get(c.local_date);
    if (!prev || Date.parse(c.created_at) > Date.parse(prev.created_at)) lastFeel.set(c.local_date, c);
  }
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const future = date > today;
    const s = future ? undefined : byDate.get(date);
    const c = future ? undefined : lastFeel.get(date);
    let feel: WeekFeel | null = null;
    if (c && isQuad(c.quad)) {
      const w = findWord(c.word_key);
      feel = { quad: c.quad, word: c.word_key, label: w?.label ?? "", activity: c.activity_key ?? null };
    }
    days.push({
      date,
      future,
      feel,
      study: !!s?.part1_done_at,
      skill: !!s?.part2_done_at,
      play: !!s?.free_started_at,
    });
  }
  return { byEnabled: checkins !== null, weekStart: monday, today, days };
}
