import { NextResponse } from "next/server";
import { atLocalTime, localDate } from "@/lib/time";
import { loadSchedule } from "@/lib/schedule/load";
import { extrasOn, PLACE_LABEL, type ExtraClass } from "@/lib/schedule/rules";
import { PREPARE_FROM, dayPlan, nextSchoolDay } from "@/lib/timetable/rules";
import { buildPrep, readPrepCheck } from "@/lib/schedule/prepServer";
import type { TaskView } from "@/lib/dayState/types";
import { readToday, requireChild, serverError } from "@/lib/today/service";

export const dynamic = "force-dynamic";

function extraLines(extras: readonly ExtraClass[], date: string) {
  return extrasOn(extras, date).map(({ extra, session }) => ({ subject: extra.subject, start: session.start, end: session.end, place: PLACE_LABEL[extra.place], bring: extra.bring }));
}

/**
 * GET: the child's school day (18/11/2026). "today" = today's lessons; "next" = the next school
 * day with lessons, sent from 19:00 (Chuẩn bị cho ngày mai) or, since 21/11/2026, earlier when the
 * client says the day is complete (`?complete=1`) and the server's own day state agrees. "extras"
 * = the child's extra classes (for "làm trước buổi học thêm"); "prep" = the Ngày mai checklist.
 * Server time decides; read with the child's own session (RLS: only their rows).
 */
export async function GET(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  try {
    const now = new Date();
    const today = localDate(now);
    const schedule = await loadSchedule(ctx.db, [ctx.childId]);
    const { versions, extras } = schedule;
    const evening = now.getTime() >= atLocalTime(today, PREPARE_FROM).getTime();
    const askedComplete = new URL(request.url).searchParams.get("complete") === "1";
    const upcoming = nextSchoolDay(versions, today);
    // Today's tasks: for the "làm trước" rows, and to check "the day is complete" ourselves.
    let tasks: TaskView[] = [];
    let complete = false;
    if (upcoming && (evening || askedComplete)) {
      try {
        const { state } = await readToday(ctx, now);
        tasks = [...state.part1.items, ...state.part2.items];
        complete = state.part1.complete && state.part2.complete;
      } catch (e) {
        console.error("timetable: day state", e);
      }
    }
    const next = upcoming && (evening || complete) ? upcoming : null;
    const prep = next ? buildPrep(schedule, next, tasks, await readPrepCheck(ctx.db, ctx.childId, next.date), now.getTime(), today) : null;
    return NextResponse.json(
      {
        has: versions.length > 0 || extras.length > 0,
        today: dayPlan(versions, today),
        next,
        // 21/11/2026: the child's extra classes today and on the next school day.
        extrasToday: extraLines(extras, today),
        extrasNext: next ? extraLines(extras, next.date) : [],
        extras,
        prep,
        nowMs: now.getTime(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return serverError("timetable", e);
  }
}
