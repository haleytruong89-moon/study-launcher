import { NextResponse } from "next/server";
import { atLocalTime, localDate } from "@/lib/time";
import { loadTimetables } from "@/lib/timetable/load";
import { PREPARE_FROM, dayPlan, nextSchoolDay } from "@/lib/timetable/rules";
import { requireChild, serverError } from "@/lib/today/service";

export const dynamic = "force-dynamic";

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
    const versions = await loadTimetables(ctx.db, [ctx.childId]);
    const evening = now.getTime() >= atLocalTime(today, PREPARE_FROM).getTime();
    return NextResponse.json(
      { has: versions.length > 0, today: dayPlan(versions, today), next: evening ? nextSchoolDay(versions, today) : null, nowMs: now.getTime() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return serverError("timetable", e);
  }
}
