import { NextResponse } from "next/server";
import { z } from "zod";
import { PIC_SLOTS, hasPics } from "@/lib/avatarPics";
import { isFamilyChild, jsonError, requireParent, writeAudit } from "@/lib/admin/guard";
import { loadPics, removePics } from "@/lib/avatarServer";

/**
 * R3b: a parent takes ALL of a child's Picrew pictures off (e.g. it is a photo, not a drawing;
 * docs/BINH_YEN_BIEU_TUONG.md §B). The family check runs first with the parent's own session
 * (RLS); removing needs service_role. The child's own character (codes) stays.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success || !(await isFamilyChild(ctx.db, id.data))) return jsonError("Không tìm thấy tài khoản con.", 404);
  try {
    const current = await loadPics(ctx.familyId, id.data);
    if (!current.ok) return jsonError(current.notReady ? "Phần ảnh nhân vật chưa được cập nhật." : "Không tìm thấy tài khoản con.", current.notReady ? 503 : 404);
    if (!hasPics(current.pics)) return NextResponse.json({ ok: true }); // nothing to remove, nothing to log
    if (!(await removePics(ctx.familyId, id.data, current, PIC_SLOTS))) return jsonError("Con vừa đổi ảnh. Tải lại trang rồi thử lại.", 409);
  } catch (e) {
    console.error("child.avatar_pics_removed failed", e instanceof Error ? e.message : e);
    return jsonError("Không gỡ được, thử lại sau.", 500);
  }
  await writeAudit(ctx, "child.avatar_pics_removed", { child_id: id.data });
  return NextResponse.json({ ok: true });
}
