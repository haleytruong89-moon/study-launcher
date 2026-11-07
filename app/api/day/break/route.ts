import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideBreak } from "@/lib/today/rules";
import { ensureSession, jsonError, readToday, requireChild, serverError, todayView } from "@/lib/today/service";

const bodySchema = z.object({ action: z.enum(["start", "end"]) });

/**
 * Break (R1, 07/11/2026): start (when computeDayState allows it, once a day) or end early
 * ("Học tiếp"). "skip" no longer exists: not taking the break needs no button.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Thiếu hoặc sai thông tin.", 400);

  try {
    const now = new Date();
    const { state } = await readToday(ctx, now);
    const decision = decideBreak(state, parsed.data.action);
    if (!decision.ok) return jsonError(decision.error, decision.status);

    await ensureSession(ctx, state.localDate);
    const base = createAdminClient().from("day_sessions");
    const at = now.toISOString();
    const q =
      parsed.data.action === "end"
        ? base.update({ break_ended_at: at }).eq("child_id", ctx.childId).eq("local_date", state.localDate).is("break_ended_at", null)
        : base
            .update({ break_started_at: at })
            .eq("child_id", ctx.childId)
            .eq("local_date", state.localDate)
            .is("break_started_at", null)
            .eq("break_skipped", false);
    const { error } = await q;
    if (error) throw new Error(error.message);

    return NextResponse.json(await todayView(ctx));
  } catch (e) {
    return serverError("day.break", e);
  }
}
