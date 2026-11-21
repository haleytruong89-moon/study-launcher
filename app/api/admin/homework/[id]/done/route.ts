import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireParent, writeAudit } from "@/lib/admin/guard";
import { localDate } from "@/lib/time";

/**
 * "✓ Con đã làm" (parent decision 21/11/2026): the child did the homework away from the computer
 * (on paper, in the afternoon) and the parent saw it. Same rule as "Nhờ bố mẹ xem trực tiếp"
 * (19/10/2026: proof photo OR the parent confirms in person), but started by the parent, for any
 * homework not done yet (overdue included). Marks it done now and "Đạt" (still changeable in the
 * evening review). Written with the parent's own session (RLS: own family only).
 *
 * If the child had a run open for it (started, or asked for a live check), that run is closed;
 * otherwise a finished run is recorded (0 minutes: it adds nothing to the break bank).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy bài.", 404);

  const { data: item, error: readErr } = await ctx.db
    .from("homework_items")
    .select("id, family_id, child_id, subject, done_at, archived_at")
    .eq("id", id.data)
    .maybeSingle();
  if (readErr) return jsonError("Không đọc được bài.", 500);
  if (!item || item.archived_at) return jsonError("Không tìm thấy bài.", 404);
  if (item.done_at) return jsonError("Bài này đã xong rồi.", 409);

  const now = new Date();
  const at = now.toISOString();
  const done = { done_at: at, confirmed_by: ctx.userId, confirmed_at: at, parent_verdict: "ok", verdict_at: at };

  const { data: open, error: openErr } = await ctx.db
    .from("task_runs")
    .select("id")
    .eq("homework_item_id", item.id)
    .is("done_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (openErr) return jsonError("Không đọc được bài.", 500);

  let runId: string | null = null;
  if (open && open.length > 0) {
    const { data, error } = await ctx.db.from("task_runs").update(done).eq("id", open[0]!.id).is("done_at", null).select("id");
    if (error) return jsonError("Không lưu được.", 500);
    runId = data?.[0]?.id ?? null;
  }
  if (!runId) {
    const { data, error } = await ctx.db
      .from("task_runs")
      .insert({ family_id: item.family_id, child_id: item.child_id, local_date: localDate(now), source: "homework", homework_item_id: item.id, started_at: at, ...done })
      .select("id")
      .single();
    if (error || !data) {
      console.error("homework.done run insert failed", error?.message);
      return jsonError("Không lưu được.", 500);
    }
    runId = data.id as string;
  }

  const { data: hw, error: hwErr } = await ctx.db.from("homework_items").update({ done_at: at }).eq("id", item.id).is("done_at", null).select("id");
  if (hwErr) return jsonError("Không lưu được.", 500);
  if (!hw || hw.length === 0) return jsonError("Bài này đã xong rồi.", 409);

  await writeAudit(ctx, "homework.parent_done", { homework_item_id: item.id, run_id: runId, child_id: item.child_id, subject: item.subject });
  return NextResponse.json({ ok: true });
}
