import "server-only";
import type { DayType, TaskTemplateInput } from "@/lib/dayState";
import { localDate, startOfLocalDay } from "@/lib/time";
import { buildCalendar, type CalendarHomeworkRow, type CalendarSessionRow, type CalendarView } from "./calendar";
import type { ChildContext } from "./service";

type Res = { data: unknown; error: { message: string } | null };

function rows<T>(res: Res, what: string): T[] {
  if (res.error) throw new Error(`calendar: ${what}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}

interface TemplateRow {
  id: string;
  part: "extra" | "skill";
  title: string;
  subject: string | null;
  app_slot_id: string | null;
  weekdays: number[] | null;
  min_minutes: number | null;
  deep_link: string | null;
  sort: number;
  active: boolean;
}

/**
 * Reads "Lịch của con" for THE CHILD OF THE REQUEST with the child's own session (`ctx.db`, RLS:
 * SELECT of their own rows only; never service_role). Four reads in parallel, one round trip.
 * `range` must already be clamped (clampRange). Throws on any error (the route answers 500).
 */
export async function readCalendar(ctx: ChildContext, range: { from: string; to: string }, now = new Date()): Promise<CalendarView> {
  const today = localDate(now);
  const startOfToday = startOfLocalDay(today).toISOString();
  const [homework, sessions, templates, slots] = await Promise.all([
    ctx.db
      .from("homework_items")
      .select("id, subject, due_date, note, done_at, archived_at, created_at")
      .eq("child_id", ctx.childId)
      .is("archived_at", null)
      .gte("due_date", range.from)
      .lte("due_date", range.to)
      .or(`done_at.is.null,done_at.gte.${startOfToday}`),
    ctx.db.from("day_sessions").select("local_date, day_type, disabled_template_ids").eq("child_id", ctx.childId).gte("local_date", range.from).lte("local_date", range.to),
    ctx.db
      .from("task_templates")
      .select("id, part, title, subject, app_slot_id, weekdays, min_minutes, deep_link, sort, active")
      .eq("child_id", ctx.childId)
      .eq("active", true),
    ctx.db.from("app_slots").select("id, kind").eq("family_id", ctx.familyId),
  ]);

  return buildCalendar(range, today, {
    homework: rows<CalendarHomeworkRow>(homework, "homework_items"),
    sessions: rows<CalendarSessionRow>(sessions, "day_sessions").map((x) => ({ ...x, day_type: x.day_type as DayType })),
    templates: rows<TemplateRow>(templates, "task_templates").map(
      (t): TaskTemplateInput => ({
        id: t.id,
        part: t.part,
        title: t.title,
        subject: t.subject,
        appSlotId: t.app_slot_id,
        weekdays: t.weekdays ?? [],
        minMinutes: t.min_minutes,
        deepLink: t.deep_link,
        sort: t.sort,
        active: t.active,
      }),
    ),
    slots: rows<{ id: string; kind: "internal" | "external" | "placeholder" }>(slots, "app_slots"),
  });
}
