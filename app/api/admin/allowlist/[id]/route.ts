import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireParent, writeAudit } from "@/lib/admin/guard";

/** Parent removes a site from the list. System entries (the Launcher, Google sign-in) stay. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy.", 404);
  const { data, error } = await ctx.db.from("allowlist_entries").delete().eq("id", id.data).neq("grp", "system").select("id, domain, child_id");
  if (error) {
    console.error("allowlist delete failed", error.message);
    return jsonError("Không xóa được.", 500);
  }
  if (!data || data.length === 0) return jsonError("Không tìm thấy (trang hệ thống không xóa được).", 404);
  await writeAudit(ctx, "allowlist.remove", { id: id.data, domain: data[0]?.domain, child_id: data[0]?.child_id });
  return NextResponse.json({ ok: true });
}
