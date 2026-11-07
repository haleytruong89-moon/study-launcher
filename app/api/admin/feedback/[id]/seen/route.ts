import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireParent } from "@/lib/admin/guard";

/**
 * "Đã đọc": a parent marks a child's feedback as read, with their OWN session (RLS: this family
 * only; the column grant allows seen_at only). No audit_log.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy.", 404);
  const { ctx } = guard;
  const { data, error } = await ctx.db.from("app_feedback").update({ seen_at: new Date().toISOString() }).eq("id", id.data).is("seen_at", null).select("id");
  if (error) {
    console.error("feedback.seen failed");
    return jsonError("Không lưu được, thử lại.", 500);
  }
  if (!data?.length) {
    // Already read (maybe by the other parent), or not this family's.
    const { data: row } = await ctx.db.from("app_feedback").select("id").eq("id", id.data).maybeSingle();
    if (!row) return jsonError("Không tìm thấy.", 404);
  }
  return NextResponse.json({ ok: true });
}
