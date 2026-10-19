import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeFinish } from "@/lib/today/finish";
import { decideFinish, decideProof, isProofPath } from "@/lib/today/rules";
import { jsonError, readToday, requireChild, serverError, todayView } from "@/lib/today/service";

const bodySchema = z.object({ runId: z.uuid(), path: z.string().max(300), finish: z.boolean().optional() });

/**
 * Records a proof photo the child's browser already uploaded to
 * proofs/{family_id}/{child_id}/{local_date}/{uuid}.jpg (storage RLS: own folder only).
 * `finish: true` (the last photo) also finishes the homework in the SAME request, so a lost
 * connection can no longer leave "photos sent but the clock still running".
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Thiếu hoặc sai thông tin.", 400);

  try {
    const { state } = await readToday(ctx);
    const decision = decideProof(state, parsed.data.runId);
    if (!decision.ok) return jsonError(decision.error, decision.status);
    if (!isProofPath(parsed.data.path, ctx.familyId, ctx.childId, state.localDate)) return jsonError("Ảnh không hợp lệ.", 400);

    // The file must really exist (listing is RLS-checked with the child's own session).
    const folder = `${ctx.familyId}/${ctx.childId}/${state.localDate}`;
    const { data: objects, error: listError } = await ctx.db.storage.from("proofs").list(folder, { limit: 1000 });
    if (listError) throw new Error(listError.message);
    if (!(objects ?? []).some((o) => `${folder}/${o.name}` === parsed.data.path)) return jsonError("Ảnh chưa tải lên xong, thử lại.", 400);

    const admin = createAdminClient();
    // One photo proves ONE piece of homework: refuse a path already used by another run.
    const { data: reused, error: reuseError } = await admin
      .from("task_runs")
      .select("id")
      .eq("child_id", ctx.childId)
      .contains("proof_paths", [parsed.data.path])
      .neq("id", parsed.data.runId)
      .limit(1);
    if (reuseError) throw new Error(reuseError.message);
    if ((reused ?? []).length > 0) return jsonError("Ảnh này đã dùng cho bài khác. Chụp ảnh riêng cho bài này.", 409);

    const { data: run, error: readError } = await admin
      .from("task_runs")
      .select("proof_paths")
      .eq("id", parsed.data.runId)
      .eq("child_id", ctx.childId)
      .single();
    if (readError || !run) throw new Error(readError?.message ?? "run not found");
    const paths = [...new Set([...(run.proof_paths ?? []), parsed.data.path])];
    const { error } = await admin.from("task_runs").update({ proof_paths: paths }).eq("id", parsed.data.runId).eq("child_id", ctx.childId);
    if (error) throw new Error(error.message);

    if (parsed.data.finish) {
      const now = new Date();
      const { state: after } = await readToday(ctx, now);
      const done = decideFinish(after, parsed.data.runId, now);
      if (!done.ok) return jsonError(done.error, done.status);
      await writeFinish(ctx.childId, done.value.item, parsed.data.runId, now);
    }
    return NextResponse.json(await todayView(ctx));
  } catch (e) {
    return serverError("tasks.proof", e);
  }
}
