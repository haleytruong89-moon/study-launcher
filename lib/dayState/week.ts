/** day_sessions: the empty session, "Ngày đạt" (rule 7) and the week strip result (rule 6). */

import { atLocalTime } from "../time";
import { toMs } from "./instants";
import type { DaySessionInput, WeekResult } from "./types";

export function emptySession(date: string): DaySessionInput {
  return {
    localDate: date,
    dayType: "normal",
    disabledTemplateIds: [],
    breakStartedAt: null,
    breakEndedAt: null,
    breakSkipped: false,
    part1DoneAt: null,
    part2DoneAt: null,
    freeStartedAt: null,
    passUsedAt: null,
  };
}

/** "Ngày đạt" for a day_sessions row (DESIGN section 5). */
export function isDayOk(s: DaySessionInput, bedtime: string): boolean {
  if (s.dayType === "sick" || s.dayType === "holiday") return true;
  if (s.passUsedAt !== null) return true;
  // Interpretation 7 (R1): both parts done before bedtime (they may finish in any order).
  if (s.part1DoneAt === null || s.part2DoneAt === null) return false;
  const bed = atLocalTime(s.localDate, bedtime).getTime();
  return toMs(s.part1DoneAt, "day_sessions.part1_done_at") < bed && toMs(s.part2DoneAt, "day_sessions.part2_done_at") < bed;
}

export function weekResult(s: DaySessionInput | undefined, bedtime: string, isToday: boolean): WeekResult {
  if (s !== undefined) {
    if (s.dayType === "sick") return "sick";
    if (s.passUsedAt !== null) return "pass";
    if (isDayOk(s, bedtime)) return "ok";
  }
  return isToday ? "today" : "miss";
}
