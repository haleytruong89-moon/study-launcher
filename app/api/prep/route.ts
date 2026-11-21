import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSchedule } from "@/lib/schedule/load";
import { tickableKeys } from "@/lib/schedule/prep";
import { buildPrep, readPrepCheck } from "@/lib/schedule/prepServer";
import { localDate } from "@/lib/time";
import { nextSchoolDay } from "@/lib/timetable/rules";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  key: z.string().min(1).max(80),
  on: z.boolean(),
});

/**
 * POST (child, 21/11/2026): tick or untick one row of "Chuẩn bị cho ngày mai". Only the next
 * school day, only rows the child ticks (recomputed here from the child's schedule, so a made-up
 * key is refused). Sets `done_at` when every row is ticked, clears it otherwise. Display only: it
 * never changes what is done, locked or open. Server write (the child has SELECT only).
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Thông tin chưa đúng.", 400);
  const { date, key, on } = parsed.data;
  try {
    const now = new Date();
    const today = localDate(now);
    const schedule = await loadSchedule(ctx.db, [ctx.childId]);
    const next = nextSchoolDay(schedule.versions, today);
    if (!next || next.date !== date) return jsonError("Ngày này chưa chuẩn bị được.", 409);
    const check = await readPrepCheck(ctx.db, ctx.childId, date);
    const keys = tickableKeys(buildPrep(schedule, next, [], check, now.getTime(), today).items);
    if (!keys.includes(key)) return jsonError("Dòng này không tích được.", 400);

    const set = new Set(check.ticked.filter((k) => keys.includes(k)));
    if (on) set.add(key);
    else set.delete(key);
    const ticked = keys.filter((k) => set.has(k));
    const all = ticked.length === keys.length;
    const doneAt = all ? (check.doneAt ?? now.toISOString()) : null;
    const { error } = await createAdminClient()
      .from("prep_checks")
      .upsert(
        { child_id: ctx.childId, family_id: ctx.familyId, for_date: date, ticked, done_at: doneAt, updated_at: now.toISOString() },
        { onConflict: "child_id,for_date" },
      );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ticked, doneAt });
  } catch (e) {
    return serverError("prep", e);
  }
}
