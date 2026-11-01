/**
 * "Ngày đặc biệt" (S3d, SPEC section 8): the parent marks a day of one child as sick, exam
 * or holiday, and on exam / holiday days turns off some of that day's tasks
 * (`day_sessions.day_type` + `disabled_template_ids`). PURE: validation and labels only.
 *
 * The EFFECTS live in computeDayState (DESIGN section 5) and are not changed here:
 * - sick: OPEN_SICK (row 4, open until 00:00), the day counts as "đạt";
 * - holiday: the normal flow without the turned-off tasks, the day counts as "đạt";
 * - exam: the normal flow without the turned-off tasks, "đạt" only once the rest is done.
 *
 * Rules added by this slice (01/11/2026):
 * - only today or a day within SPECIAL_DAY_MAX_AHEAD days (server clock); a past day is
 *   never changed (it would rewrite the "đạt" history);
 * - only supplementary / skill tasks (task templates) can be turned off, and only the ones
 *   scheduled on that weekday; homework keeps its own deadline;
 * - "normal" and "sick" clear the turned-off list (it only matters on exam / holiday days).
 */
import type { DayType } from "@/lib/dayState";
import { addDays, isoWeekday, localDate } from "@/lib/time";

export type { DayType };

export const DAY_TYPES = ["normal", "sick", "exam", "holiday"] as const satisfies readonly DayType[];

/** How far ahead a parent can plan a special day (e.g. an exam week). */
export const SPECIAL_DAY_MAX_AHEAD = 60;

export const DAY_TYPE_INFO: Record<DayType, { label: string; sub: string }> = {
  normal: { label: "Ngày thường", sub: "Theo lịch việc như mọi ngày" },
  sick: { label: "Ngày ốm", sub: "Mở mọi trang cả ngày · tính là đạt" },
  exam: { label: "Ngày thi", sub: "Bớt việc · xong phần còn lại mới tính đạt" },
  holiday: { label: "Ngày lễ", sub: "Bớt việc · tính là đạt" },
};

/** Exam and holiday days may turn tasks off; normal and sick days never do. */
export function canTurnOffTasks(dayType: DayType): boolean {
  return dayType === "exam" || dayType === "holiday";
}

export interface TemplateForDay {
  id: string;
  part: "extra" | "skill";
  title: string;
  weekdays: number[];
  sort: number;
  active: boolean;
}

/** The child's active tasks scheduled on `date`'s weekday: Part 1 (extra) first, then Part 2. */
export function templatesForDate<T extends TemplateForDay>(templates: readonly T[], date: string): T[] {
  const wd = isoWeekday(date);
  return templates
    .filter((t) => t.active && t.weekdays.includes(wd))
    .sort((a, b) => {
      if (a.part !== b.part) return a.part === "extra" ? -1 : 1;
      if (a.sort !== b.sort) return a.sort - b.sort;
      return a.title.localeCompare(b.title, "vi");
    });
}

/** First and last local date a parent may set (inclusive), by the server clock. */
export function specialDayWindow(now: Date): { from: string; to: string } {
  const from = localDate(now);
  return { from, to: addDays(from, SPECIAL_DAY_MAX_AHEAD) };
}

export interface SpecialDayRequest {
  date: string;
  dayType: DayType;
  disabledTemplateIds: string[];
}

export type SpecialDayDecision =
  | { ok: true; row: { day_type: DayType; disabled_template_ids: string[] } }
  | { ok: false; error: string };

/** Checks a parent's request against the server clock and the child's own tasks. */
export function decideSpecialDay(req: SpecialDayRequest, now: Date, templates: readonly TemplateForDay[]): SpecialDayDecision {
  const { from, to } = specialDayWindow(now);
  if (req.date < from) return { ok: false, error: "Không đổi được ngày đã qua." };
  if (req.date > to) return { ok: false, error: `Chỉ đặt trước được tối đa ${SPECIAL_DAY_MAX_AHEAD} ngày.` };
  if (!canTurnOffTasks(req.dayType)) return { ok: true, row: { day_type: req.dayType, disabled_template_ids: [] } };

  const allowed = new Set(templatesForDate(templates, req.date).map((t) => t.id));
  const ids = [...new Set(req.disabledTemplateIds)];
  if (ids.some((id) => !allowed.has(id))) return { ok: false, error: "Có việc không nằm trong lịch của ngày đó. Tải lại trang rồi chọn lại." };
  return { ok: true, row: { day_type: req.dayType, disabled_template_ids: ids.sort() } };
}

/** Short line for the child's header (null on a normal day). The sick status pill already says "Ngày ốm". */
export function childDayTypeNote(dayType: DayType): string | null {
  switch (dayType) {
    case "sick":
      return "Ngày ốm · hôm nay tính là đạt";
    case "exam":
      return "Ngày thi · xong các việc còn lại là đạt";
    case "holiday":
      return "Ngày lễ · hôm nay tính là đạt";
    default:
      return null;
  }
}
