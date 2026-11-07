import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { MAX_PIC_BYTES, isPicSlot, sniffPic } from "@/lib/avatarPics";
import { BUSY_TEXT, NOT_READY_TEXT, loadPics, savePics } from "@/lib/avatarServer";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

/**
 * R3b: the child puts ONE Picrew picture on one face (multipart: slot, file). The browser has
 * already shrunk and redrawn it; the server checks again: PNG/JPEG by its first bytes, <= 1 MB.
 * Saved as avatars/{family}/{child}/{uuid}.png|jpg with service_role, only in the session
 * child's folder. The picture it replaces is deleted. Two saves at once: the second gets 409.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  if (Number(request.headers.get("content-length") ?? 0) > MAX_PIC_BYTES + 64 * 1024) return jsonError("Ảnh lớn quá (tối đa 1 MB).", 413);
  const form = await request.formData().catch(() => null);
  const slot = form?.get("slot");
  const file = form?.get("file");
  if (!isPicSlot(slot) || !(file instanceof Blob)) return jsonError("Thiếu ảnh hoặc ô.", 400);
  if (file.size > MAX_PIC_BYTES) return jsonError("Ảnh lớn quá (tối đa 1 MB).", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffPic(bytes);
  if (!kind) return jsonError("Chỉ nhận ảnh PNG hoặc JPG.", 400);

  try {
    const current = await loadPics(ctx.familyId, ctx.childId);
    if (!current.ok) return current.notReady ? jsonError(NOT_READY_TEXT, 503) : jsonError("Không tìm thấy hồ sơ của con.", 404);

    const path = `${ctx.familyId}/${ctx.childId}/${randomUUID()}.${kind}`;
    const storage = createAdminClient().storage.from("avatars");
    const up = await storage.upload(path, bytes, { contentType: kind === "png" ? "image/png" : "image/jpeg", upsert: false });
    if (up.error) {
      if (/bucket not found/i.test(up.error.message)) return jsonError(NOT_READY_TEXT, 503);
      throw new Error(up.error.message);
    }
    const after = { ...current.pics, [slot]: path };
    let saved = false;
    try {
      saved = await savePics(ctx.familyId, ctx.childId, current, after);
    } finally {
      if (!saved) await storage.remove([path]);
    }
    if (!saved) return jsonError(BUSY_TEXT, 409);
    return NextResponse.json({ pics: after });
  } catch (e) {
    return serverError("profile.avatar.pics", e);
  }
}
