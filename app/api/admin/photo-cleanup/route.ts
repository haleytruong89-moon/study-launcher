import { NextResponse } from "next/server";
import { jsonError, requireParent } from "@/lib/admin/guard";
import { MAX_FILES_PER_RUN } from "@/lib/cleanup/rules";
import { planBytes, planFamily } from "@/lib/cleanup/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * S3e "Xem trước sẽ xóa gì": counts what the weekly cleanup WOULD delete for the parent's own
 * family. Read-only (never deletes). Runs with the parent's own session, so storage + table
 * RLS keep it inside their family. Returns counts only, no file names.
 */
export async function GET() {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  try {
    const plan = await planFamily(ctx.db, ctx.familyId, new Date(), MAX_FILES_PER_RUN);
    if (!plan) return NextResponse.json({ retentionDays: null, proofs: 0, homework: 0, bytes: 0, more: false, cutoff: null });
    return NextResponse.json({
      retentionDays: plan.retentionDays,
      cutoff: plan.cutoff,
      proofs: plan.proofs.length,
      homework: plan.homework.length,
      bytes: planBytes(plan),
      more: plan.more,
      max: MAX_FILES_PER_RUN,
    });
  } catch (e) {
    console.error("photo-cleanup preview failed", e instanceof Error ? e.message : e);
    return jsonError("Không xem trước được, thử lại sau.", 500);
  }
}
