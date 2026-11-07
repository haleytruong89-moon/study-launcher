import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideFreeStart } from "@/lib/today/rules";
import { ensureSession, jsonError, readToday, requireChild, serverError, todayView } from "@/lib/today/service";

/**
 * "Bắt đầu giờ tự do" on a day with no task at all (parent decision 07/11/2026): free time
 * never starts on a read the child did not ask for (the extension also reads at 00:00).
 * Writes both part milestones and free_started_at in ONE statement, only if none is set yet.
 */
export async function POST() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  try {
    const now = new Date();
    const { state } = await readToday(ctx, now);
    const decision = decideFreeStart(state);
    if (!decision.ok) return jsonError(decision.error, decision.status);

    await ensureSession(ctx, state.localDate);
    const at = now.toISOString();
    const { error } = await createAdminClient()
      .from("day_sessions")
      .update({ part1_done_at: at, part2_done_at: at, free_started_at: at })
      .eq("child_id", ctx.childId)
      .eq("local_date", state.localDate)
      .is("part1_done_at", null)
      .is("part2_done_at", null)
      .is("free_started_at", null);
    if (error) throw new Error(error.message);

    return NextResponse.json(await todayView(ctx));
  } catch (e) {
    return serverError("day.free", e);
  }
}
