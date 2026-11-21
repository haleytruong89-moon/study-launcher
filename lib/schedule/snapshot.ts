import type { TimetableData } from "@/lib/timetable/rules";
import type { ExtraClass } from "./rules";

/**
 * What a schedule change stores in audit_log as `before` (21/11/2026): exactly the columns
 * "Khôi phục bản trước" puts back. Pure.
 */
export const timetableSnapshot = (d: TimetableData & { validFrom: string }) => ({
  valid_from: d.validFrom,
  label: d.label,
  note: d.note,
  periods: d.periods,
  times: d.times,
  uniform: d.uniform,
});

export const extraSnapshot = (e: Omit<ExtraClass, "id" | "childId">) => ({
  subject: e.subject,
  sessions: e.sessions,
  place: e.place,
  bring: e.bring,
  note: e.note,
  app_slot_id: e.appSlotId,
  active: e.active,
});
