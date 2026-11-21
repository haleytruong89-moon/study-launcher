import { NextResponse } from "next/server";
import { atLocalTime, localDate } from "@/lib/time";
import { loadSchedule } from "@/lib/schedule/load";
import { extrasOn, PLACE_LABEL, type ExtraClass } from "@/lib/schedule/rules";
import { PREPARE_FROM, dayPlan, nextSchoolDay } from "@/lib/timetable/rules";
import { requireChild, serverError } from "@/lib/today/service";

export const dynamic = "force-dynamic";

function extraLines(extras: readonly ExtraClass[], date: string) {
  return extrasOn(extras, date).map(({ extra, session }) => ({ subject: extra.subject, start: session.start, end: session.end, place: PLACE_LABEL[extra.place], bring: extra.bring }));
}

/**
 * GET: the child's school day (18/11/2026). "today" = today's lessons; "next" = the next school
 * day with lessons, sent only from 19:00 (Chuẩn bị cho ngày mai). Server time decides; read with
 * the child's own session (RLS: only their timetables).
 */
export async function GET() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  try {
    const now = new Date();
    const today = localDate(now);
    const { versions, extras } = await loadSchedule(ctx.db, [ctx.childId]);
    const evening = now.getTime() >= atLocalTime(today, PREPARE_FROM).getTime();
    const next = evening ? nextSchoolDay(versions, today) : null;
    return NextResponse.json(
      {
        has: versions.length > 0 || extras.length > 0,
        today: dayPlan(versions, today),
        next,
        // 21/11/2026: the child's extra classes today and on the next school day.
        extrasToday: extraLines(extras, today),
        extrasNext: next ? extraLines(extras, next.date) : [],
        nowMs: now.getTime(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return serverError("timetable", e);
  }
}
