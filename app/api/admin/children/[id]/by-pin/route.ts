import { NextResponse } from "next/server";
import { z } from "zod";
import { isFamilyChild, jsonError, requireParent, writeAudit } from "@/lib/admin/guard";
import { endAllBySessions } from "@/lib/binhYen/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The ONLY thing a parent can do with the child's Góc bình yên PIN (Q1): wipe it. The parent
 * never sets or reads it. Wiping ends every open session; on the next visit the child is told
 * "PIN Góc bình yên vừa được bố mẹ xóa lúc …" and the child's browser deletes the private text
 * it kept (wipeVault). Server check-ins (later slices) stay. Logged as the parent's own action.
 * The answer never says whether a PIN existed (that is the child's business).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const id = z.uuid().safeParse((await params).id);
  if (!id.success || !(await isFamilyChild(ctx.db, id.data))) return jsonError("Không tìm thấy tài khoản con.", 404);

  const now = new Date();
  try {
    const { error } = await createAdminClient()
      .from("profiles")
      .update({ by_pin_hash: null, by_pin_failed_count: 0, by_pin_locked_until: null, by_pin_reset_at: now.toISOString() })
      .eq("id", id.data)
      .eq("role", "child");
    if (error) throw new Error("update");
    await endAllBySessions(id.data, now);
  } catch {
    console.error("child.by_pin_wipe failed");
    return jsonError("Chưa xóa được, thử lại sau.", 500);
  }
  await writeAudit(ctx, "child.by_pin_wiped", { child_id: id.data });
  return NextResponse.json({ ok: true, wipedAt: now.toISOString() });
}
