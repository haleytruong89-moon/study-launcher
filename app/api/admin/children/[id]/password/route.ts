import { NextResponse } from "next/server";
import { z } from "zod";
import { isFamilyChild, jsonError, requireParent, writeAudit } from "@/lib/admin/guard";
import { generatePassword } from "@/lib/children";
import { signOutChildEverywhere } from "@/lib/pin/device";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Parent resets a child's password (e.g. it was shown to someone by mistake).
 * The new password is returned ONCE and never stored in clear. Changing auth credentials
 * needs service_role, so the family check runs first with the parent's own session (RLS).
 * Audit 24/10: a reset also signs the child out of every browser and forgets every
 * remembered PIN browser, so the old password's laptops must sign in again.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success || !(await isFamilyChild(ctx.db, id.data))) return jsonError("Không tìm thấy tài khoản con.", 404);

  const admin = createAdminClient();
  const password = generatePassword();
  const { data, error } = await admin.auth.admin.updateUserById(id.data, { password });
  if (error || !data.user) {
    console.error("child.password_reset failed", error?.message);
    return jsonError("Không đặt lại được mật khẩu.", 500);
  }

  // The new password already works; if the sign-out fails, say so instead of hiding it.
  let signedOut = true;
  try {
    await signOutChildEverywhere(id.data, ctx.familyId, ctx.userId);
  } catch (e) {
    signedOut = false;
    console.error("child.password_reset sign-out failed", e instanceof Error ? e.message : e);
  }
  await writeAudit(ctx, "child.password_reset", { child_id: id.data, signed_out: signedOut });
  return NextResponse.json({ ok: true, email: data.user.email, password, signedOut });
}
