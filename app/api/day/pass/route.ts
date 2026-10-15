import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decidePass } from "@/lib/today/rules";
import { ensureSession, jsonError, readToday, requireChild, serverError, todayView } from "@/lib/today/service";

/** Child uses this week's pass: free time starts now and the day counts as "đạt". */
export async function POST() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  try {
    const now = new Date();
    const { state } = await readToday(ctx, now);
    const decision = decidePass(state);
    if (!decision.ok) return jsonError(decision.error, decision.status);

    await ensureSession(ctx, state.localDate);
    const at = now.toISOString();
    const { error } = await createAdminClient()
      .from("day_sessions")
      .update({ pass_used_at: at, free_started_at: at })
      .eq("child_id", ctx.childId)
      .eq("local_date", state.localDate)
      .is("free_started_at", null)
      .is("pass_used_at", null);
    if (error) throw new Error(error.message);

    return NextResponse.json(await todayView(ctx));
  } catch (e) {
    return serverError("day.pass", e);
  }
}
