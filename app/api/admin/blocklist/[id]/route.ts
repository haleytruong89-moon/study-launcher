import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireParent, writeAudit } from "@/lib/admin/guard";

/** "Luôn chặn" (V1): parent removes a site from the list (RLS: own family only). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy.", 404);
  const { data, error } = await ctx.db.from("always_block_entries").delete().eq("id", id.data).select("id, domain");
  if (error) {
    console.error("blocklist delete failed", error.message);
    return jsonError("Không xóa được.", 500);
  }
  if (!data || data.length === 0) return jsonError("Không tìm thấy.", 404);
  await writeAudit(ctx, "blocklist.remove", { domain: data[0]?.domain });
  return NextResponse.json({ ok: true });
}
