import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideFinish } from "@/lib/today/rules";
import { jsonError, readToday, requireChild, serverError, todayView } from "@/lib/today/service";

const bodySchema = z.object({ runId: z.uuid() });

/**
 * Child presses "Xong". Refused with 409 (nothing recorded) when the minimum time has not
 * passed on the SERVER clock, or when homework has no proof photo (SPEC 2.6).
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
    const decision = decideFinish(state, parsed.data.runId, now);
    if (!decision.ok) return jsonError(decision.error, decision.status);
    const { item } = decision.value;

    const admin = createAdminClient();
    const doneAt = now.toISOString();
    const { error: runError } = await admin
      .from("task_runs")
      .update({ done_at: doneAt })
      .eq("id", parsed.data.runId)
      .eq("child_id", ctx.childId)
      .is("done_at", null);
    if (runError) throw new Error(runError.message);

    if (item.source === "homework") {
      const { error } = await admin
        .from("homework_items")
        .update({ done_at: doneAt })
        .eq("id", item.id)
        .eq("child_id", ctx.childId)
        .is("done_at", null);
      if (error) throw new Error(error.message);
    }
    // Part milestones are derived (and persisted) by the next read.
    return NextResponse.json(await todayView(ctx));
  } catch (e) {
    return serverError("tasks.finish", e);
  }
}
