import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideConfirmRequest } from "@/lib/today/rules";
import { jsonError, readToday, requireChild, serverError, todayView } from "@/lib/today/service";

const bodySchema = z.object({ runId: z.uuid() });

/**
 * "Nhờ bố mẹ xem trực tiếp" (parent decision 19/10/2026): the child cannot send a photo and
 * asks a parent nearby. Nothing is finished here: only a parent's confirmation finishes it.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Thiếu hoặc sai thông tin.", 400);

  try {
    const { state } = await readToday(ctx);
    const decision = decideConfirmRequest(state, parsed.data.runId);
    if (!decision.ok) return jsonError(decision.error, decision.status);
    const { error } = await createAdminClient()
      .from("task_runs")
      .update({ confirm_requested_at: new Date().toISOString() })
      .eq("id", parsed.data.runId)
      .eq("child_id", ctx.childId)
      .is("done_at", null);
    if (error) throw new Error(error.message);
    return NextResponse.json(await todayView(ctx));
  } catch (e) {
    return serverError("tasks.confirm_request", e);
  }
}
