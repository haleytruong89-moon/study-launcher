import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { notMigratedYet } from "@/lib/today/load";
import { decideBreak } from "@/lib/today/rules";
import { ensureSession, jsonError, readToday, requireChild, serverError, todayView } from "@/lib/today/service";

const bodySchema = z.object({ action: z.enum(["start", "end"]) });

/**
 * Break. R8b "ngân hàng giờ nghỉ" (parent decision 08/11/2026): start (when computeDayState allows
 * it, server clock) inserts a day_breaks row planned with the WHOLE bank; end ("Học tiếp") sets
 * ended_at = now on today's open rows (an expired row is unchanged in effect: its use is capped at
 * the planned length). Both are idempotent (see decideBreak). Before migration 0014 (a preview on
 * the production database) the old single break on day_sessions applies.
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
    if (!decision.value.write) return NextResponse.json(await todayView(ctx));

    const admin = createAdminClient();
    const at = now.toISOString();
    if (!state.break.legacy) {
      const { error } =
        parsed.data.action === "end"
          ? await admin.from("day_breaks").update({ ended_at: at }).eq("child_id", ctx.childId).eq("local_date", state.localDate).is("ended_at", null)
          : await admin.from("day_breaks").insert({
              family_id: ctx.familyId,
              child_id: ctx.childId,
              local_date: state.localDate,
              started_at: at,
              planned_minutes: state.break.bankMinutes,
            });
      if (error && notMigratedYet(error)) return jsonError("Giờ nghỉ mới chạy sau khi bố mẹ cập nhật app. Thử lại sau nhé.", 503);
      if (error) throw new Error(error.message);
      if (parsed.data.action === "end") {
        // A legacy break still running on the day 0014 is applied ends too (harmless otherwise).
        const legacy = await admin
          .from("day_sessions")
          .update({ break_ended_at: at })
          .eq("child_id", ctx.childId)
          .eq("local_date", state.localDate)
          .not("break_started_at", "is", null)
          .is("break_ended_at", null);
        if (legacy.error) throw new Error(legacy.error.message);
      }
      return NextResponse.json(await todayView(ctx));
    }

    // Before 0014: the old single break (day_sessions.break_*).
    await ensureSession(ctx, state.localDate);
    const base = admin.from("day_sessions");
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
