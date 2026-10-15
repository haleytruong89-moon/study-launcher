import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";

const bodySchema = z.object({ verdict: z.enum(["ok", "not_ok"]).nullable() });

/**
 * Evening review: parent marks a finished task "Đạt" / "Chưa đạt" (or clears it).
 * SPEC 2.6: "Chưa đạt" is only recorded to talk about later; it never takes back free time
 * and never changes whether the day counts as "đạt" (v1). Written with the parent's session (RLS).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy việc.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Thiếu hoặc sai thông tin.", 400);

  const verdict = parsed.data.verdict;
  const { data, error } = await ctx.db
    .from("task_runs")
    .update({ parent_verdict: verdict, verdict_at: verdict ? new Date().toISOString() : null })
    .eq("id", id.data)
    .not("done_at", "is", null)
    .select("id");
  if (error) {
    console.error("run.verdict failed", error.message);
    return jsonError("Không lưu được.", 500);
  }
  if (!data || data.length === 0) return jsonError("Không tìm thấy việc đã xong này.", 404);

  await writeAudit(ctx, "run.verdict", { run_id: id.data, verdict });
  return NextResponse.json({ ok: true });
}
