import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideStart } from "@/lib/today/rules";
import { jsonError, readToday, requireChild, serverError, todayView } from "@/lib/today/service";

const bodySchema = z.object({ source: z.enum(["homework", "template"]), id: z.uuid() });

/** Child presses "Bắt đầu": creates a task_run with started_at = server time. */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Thiếu hoặc sai thông tin.", 400);

  try {
    const now = new Date();
    const { state } = await readToday(ctx, now);
    const decision = decideStart(state, parsed.data.source, parsed.data.id);
    if (!decision.ok) return jsonError(decision.error, decision.status);

    if (!decision.value.alreadyRunning) {
      const { error } = await createAdminClient()
        .from("task_runs")
        .insert({
          family_id: ctx.familyId,
          child_id: ctx.childId,
          local_date: state.localDate,
          source: parsed.data.source,
          homework_item_id: parsed.data.source === "homework" ? parsed.data.id : null,
          template_id: parsed.data.source === "template" ? parsed.data.id : null,
          started_at: now.toISOString(),
        });
      if (error) throw new Error(error.message);
    }
    return NextResponse.json(await todayView(ctx));
  } catch (e) {
    return serverError("tasks.start", e);
  }
}
