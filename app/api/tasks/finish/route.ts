import { NextResponse } from "next/server";
import { z } from "zod";
import { writeFinish } from "@/lib/today/finish";
import { decideFinish } from "@/lib/today/rules";
import { jsonError, readToday, requireChild, serverError, todayView } from "@/lib/today/service";

const bodySchema = z.object({ runId: z.uuid() });

/**
 * Child presses "Xong". Refused with 409 (nothing recorded) when the minimum time has not
 * passed on the SERVER clock, or when homework has no proof photo (SPEC 2.6). A "Làm thêm" run
 * (R8a) has no minimum and never changes whether the task is done.
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

    await writeFinish(ctx.childId, item, parsed.data.runId, now);
    // Part milestones are derived (and persisted) by the next read.
    return NextResponse.json(await todayView(ctx));
  } catch (e) {
    return serverError("tasks.finish", e);
  }
}
