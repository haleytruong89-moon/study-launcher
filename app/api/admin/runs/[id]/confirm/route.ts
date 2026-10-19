import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { localDate } from "@/lib/time";

const bodySchema = z.object({ decision: z.enum(["ok", "reject"]) });

/**
 * Parent answers "Nhờ bố mẹ xem trực tiếp" (parent decision 19/10/2026).
 * ok: the parent looked at the notebook -> homework done now, recorded as "Đạt" (can still be
 * changed in the evening review). reject: the request is cleared, the child keeps working.
 * Written with the parent's own session (RLS: own family only).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy bài.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Thiếu lựa chọn.", 400);

  const { data: run, error: readErr } = await ctx.db
    .from("task_runs")
    .select("id, child_id, source, homework_item_id, local_date, done_at, confirm_requested_at")
    .eq("id", id.data)
    .maybeSingle();
  if (readErr) return jsonError("Không đọc được bài.", 500);
  if (!run || run.source !== "homework" || !run.homework_item_id) return jsonError("Không tìm thấy bài.", 404);
  if (run.done_at) return jsonError("Bài này đã xong rồi.", 409);
  if (!run.confirm_requested_at) return jsonError("Con không nhờ xác nhận bài này.", 409);
  const now = new Date();
  if (run.local_date !== localDate(now)) return jsonError("Yêu cầu này đã qua ngày.", 409);

  if (parsed.data.decision === "reject") {
    const { error } = await ctx.db.from("task_runs").update({ confirm_requested_at: null }).eq("id", run.id).is("done_at", null);
    if (error) return jsonError("Không lưu được.", 500);
    await writeAudit(ctx, "run.confirm_reject", { run_id: run.id, child_id: run.child_id });
    return NextResponse.json({ ok: true });
  }

  const at = now.toISOString();
  const { data: done, error: runErr } = await ctx.db
    .from("task_runs")
    .update({ done_at: at, confirmed_by: ctx.userId, confirmed_at: at, parent_verdict: "ok", verdict_at: at })
    .eq("id", run.id)
    .is("done_at", null)
    .select("id");
  if (runErr) return jsonError("Không lưu được.", 500);
  if (!done || done.length === 0) return jsonError("Bài này đã xong rồi.", 409);
  const { error: hwErr } = await ctx.db.from("homework_items").update({ done_at: at }).eq("id", run.homework_item_id).is("done_at", null);
  if (hwErr) console.error("confirm homework update failed", hwErr.message);

  await writeAudit(ctx, "run.confirm_ok", { run_id: run.id, child_id: run.child_id });
  return NextResponse.json({ ok: true });
}
