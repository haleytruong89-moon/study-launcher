import { after, NextResponse } from "next/server";
import { z } from "zod";
import { runReportMessage } from "@/lib/push/messages";
import { notifyParents } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";
import { CLOCK_RE, decideReport, reportRange } from "@/lib/today/report";
import { jsonError, readReports, readToday, requireChild, serverError, todayView } from "@/lib/today/service";

const bodySchema = z.object({ templateId: z.uuid(), from: z.string().regex(CLOCK_RE), to: z.string().regex(CLOCK_RE) });

/**
 * "Con quên bấm Bắt đầu?" (parent decision 15/11/2026, SQL 0020): the child says when they did a
 * supplementary task or skill without pressing Bắt đầu. The server checks it on the SERVER clock
 * (decideReport) and stores a PENDING report — it counts for nothing until a parent says Đồng ý
 * (POST /api/admin/run-reports/[id]). The parents get a push.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Thiếu hoặc sai thông tin.", 400);

  try {
    const now = new Date();
    const [{ state, runCapMinutes }, reports] = await Promise.all([readToday(ctx, now), readReports(ctx.db, ctx.childId, localDate(now))]);
    if (reports === null) return jsonError("Tính năng này chưa sẵn sàng, con nhờ bố mẹ trực tiếp nhé.", 409);
    const decision = decideReport(state, reports, parsed.data, now, runCapMinutes);
    if (!decision.ok) return jsonError(decision.error, decision.status);
    const { item, startedAt, endedAt, minutes } = decision.value;

    const { error } = await createAdminClient().from("task_run_reports").insert({
      family_id: ctx.familyId,
      child_id: ctx.childId,
      local_date: state.localDate,
      template_id: item.id,
      started_at: startedAt,
      ended_at: endedAt,
    });
    // 23505: a double tap stored the same pending report first (0020 one-pending index).
    if (error && error.code !== "23505") throw new Error(error.message);
    if (!error) after(() => notifyParents(ctx.familyId, runReportMessage(ctx.displayName, item.title, reportRange({ startedAt, endedAt }), minutes)));
    return NextResponse.json(await todayView(ctx, now));
  } catch (e) {
    return serverError("tasks.report", e);
  }
}

