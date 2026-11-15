import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideReportAnswer, type ReportStatus } from "@/lib/today/report";

const bodySchema = z.object({ decision: z.enum(["approve", "reject"]) });

interface ReportRow {
  id: string;
  family_id: string;
  child_id: string;
  local_date: string;
  template_id: string;
  started_at: string;
  ended_at: string;
  status: ReportStatus;
  run_id: string | null;
}

/**
 * Parent answers "Con quên bấm Bắt đầu?" (parent decision 15/11/2026, SQL 0020): Đồng ý / Không
 * đúng. The report is read with the parent's OWN session (RLS: only the family's rows, so another
 * family's id is "not found"); task_run_reports and task_runs are written by the server
 * (service_role), because browsers have no write grant on the reports.
 *
 * Approve: the report is claimed (pending -> approved, guarded on status = 'pending', so two
 * parents or a double tap approve once), then a normal FINISHED template run is inserted for
 * that day (started_at / done_at = the reported times) and linked. If the task was finished in
 * the meantime the run is still added: it becomes a "Làm thêm" run (R8a rules). The 0015 unique
 * index only covers unfinished runs, so a finished one never conflicts. Idempotent: the same
 * answer again is a no-op.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy yêu cầu.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Thiếu lựa chọn.", 400);
  const decision = parsed.data.decision;

  const { data, error: readErr } = await ctx.db
    .from("task_run_reports")
    .select("id, family_id, child_id, local_date, template_id, started_at, ended_at, status, run_id")
    .eq("id", id.data)
    .maybeSingle();
  if (readErr) return jsonError("Không đọc được yêu cầu.", 500);
  const report = data as ReportRow | null;
  if (!report || report.family_id !== ctx.familyId) return jsonError("Không tìm thấy yêu cầu.", 404);

  const now = new Date();
  const answer = decideReportAnswer({ localDate: report.local_date, status: report.status }, decision, now);
  if (!answer.ok) return jsonError(answer.error, answer.status);
  if (!answer.value.write) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const at = now.toISOString();
  const { data: claimed, error: claimErr } = await admin
    .from("task_run_reports")
    .update({ status: decision === "approve" ? "approved" : "rejected", decided_at: at, decided_by: ctx.userId })
    .eq("id", report.id)
    .eq("family_id", ctx.familyId)
    .eq("status", "pending")
    .select("id");
  if (claimErr) return jsonError("Không lưu được.", 500);
  if (!claimed || claimed.length === 0) {
    // Answered at the same moment (another parent, a double tap): same answer = fine.
    const { data: again } = await ctx.db.from("task_run_reports").select("status").eq("id", report.id).maybeSingle();
    const ok = again?.status === (decision === "approve" ? "approved" : "rejected");
    return ok ? NextResponse.json({ ok: true }) : jsonError("Yêu cầu này đã được trả lời rồi.", 409);
  }

  if (decision === "reject") {
    await writeAudit(ctx, "run_report.reject", { report_id: report.id, child_id: report.child_id, template_id: report.template_id });
    return NextResponse.json({ ok: true });
  }

  const { data: run, error: runErr } = await admin
    .from("task_runs")
    .insert({
      family_id: report.family_id,
      child_id: report.child_id,
      local_date: report.local_date,
      source: "template",
      template_id: report.template_id,
      started_at: report.started_at,
      done_at: report.ended_at,
    })
    .select("id")
    .single();
  if (runErr || !run) {
    // Nothing counted: give the report back to "pending" so the parent can try again.
    const { error: undoErr } = await admin.from("task_run_reports").update({ status: "pending", decided_at: null, decided_by: null }).eq("id", report.id).is("run_id", null);
    if (undoErr) console.error("run_report undo failed", undoErr.message);
    console.error("run_report run insert failed", runErr?.message ?? "no row");
    return jsonError("Không lưu được.", 500);
  }
  const { error: linkErr } = await admin.from("task_run_reports").update({ run_id: run.id }).eq("id", report.id);
  if (linkErr) console.error("run_report link failed", linkErr.message); // the run itself is stored: it counts

  await writeAudit(ctx, "run_report.approve", { report_id: report.id, run_id: run.id, child_id: report.child_id, template_id: report.template_id });
  return NextResponse.json({ ok: true });
}
