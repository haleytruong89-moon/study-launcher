import { after, NextResponse } from "next/server";
import { z } from "zod";
import { confirmRequestMessage } from "@/lib/push/messages";
import { notifyParents } from "@/lib/push/send";
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
    const admin = createAdminClient();
    const at = new Date().toISOString();
    // First ask for this task: set the time and push to the parents (S5).
    const first = await admin
      .from("task_runs")
      .update({ confirm_requested_at: at })
      .eq("id", parsed.data.runId)
      .eq("child_id", ctx.childId)
      .is("done_at", null)
      .is("confirm_requested_at", null)
      .select("id");
    if (first.error) throw new Error(first.error.message);
    if ((first.data ?? []).length > 0) {
      after(() => notifyParents(ctx.familyId, confirmRequestMessage(ctx.displayName)));
    } else {
      // Asking again: refresh the time as before, without a second push.
      const { error } = await admin
        .from("task_runs")
        .update({ confirm_requested_at: at })
        .eq("id", parsed.data.runId)
        .eq("child_id", ctx.childId)
        .is("done_at", null);
      if (error) throw new Error(error.message);
    }
    return NextResponse.json(await todayView(ctx));
  } catch (e) {
    return serverError("tasks.confirm_request", e);
  }
}
