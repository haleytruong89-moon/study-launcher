import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";

const bodySchema = z.object({ revoked: z.literal(true) });

/** Parent removes a laptop: its token stops working at once (the extension then locks). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy máy.", 404);
  if (!bodySchema.safeParse(await readJson(request)).success) return jsonError("Thiếu thông tin.", 400);

  const { data, error } = await ctx.db
    .from("extension_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id.data)
    .is("revoked_at", null)
    .select("id, child_id");
  if (error) {
    console.error("device revoke failed", error.message);
    return jsonError("Không lưu được.", 500);
  }
  if (!data || data.length === 0) return jsonError("Không tìm thấy máy.", 404);
  await writeAudit(ctx, "device.revoke", { id: id.data, child_id: data[0]?.child_id });
  return NextResponse.json({ ok: true });
}
