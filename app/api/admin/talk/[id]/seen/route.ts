import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireParent } from "@/lib/admin/guard";

/**
 * "Đã thấy": the parent marks a "Con muốn nói chuyện" as seen, with their OWN session. RLS
 * allows only seen_at / seen_by, only seen_by = themself, only signals they may see.
 * The child then reads "Bố/mẹ đã thấy lúc …". No audit_log (nothing about the child's corner).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy.", 404);
  const { ctx } = guard;
  const { data, error } = await ctx.db
    .from("by_signals")
    .update({ seen_at: new Date().toISOString(), seen_by: ctx.userId })
    .eq("id", id.data)
    .is("seen_at", null)
    .select("id");
  if (error) {
    console.error("talk.seen failed");
    return jsonError("Không lưu được, thử lại.", 500);
  }
  if (!data?.length) {
    // Already seen (maybe by the other parent), or not visible to this parent.
    const { data: row } = await ctx.db.from("by_signals").select("id").eq("id", id.data).maybeSingle();
    if (!row) return jsonError("Không tìm thấy.", 404);
  }
  return NextResponse.json({ ok: true });
}
