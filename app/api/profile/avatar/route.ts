import { NextResponse } from "next/server";
import { parseAvatar } from "@/lib/avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

/**
 * R3a: the child saves their own character (codes only, docs/BINH_YEN_BIEU_TUONG.md §A).
 * The child has no write right on profiles (RLS); this route checks the codes and writes only
 * the child's own row. Body: { avatar: {...} } to save, { avatar: null } to go back to "Hình tạm".
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const body = (await request.json().catch(() => undefined)) as { avatar?: unknown } | undefined;
  if (!body || typeof body !== "object" || !("avatar" in body)) return jsonError("Thiếu nhân vật.", 400);
  let avatar = null;
  if (body.avatar !== null) {
    avatar = parseAvatar(body.avatar);
    if (!avatar) return jsonError("Nhân vật có phần không có trong danh sách, hoặc tên dài quá 24 chữ.", 400);
  }

  try {
    const { error } = await createAdminClient().from("profiles").update({ avatar }).eq("id", ctx.childId).eq("role", "child");
    if (error) throw new Error(error.message);
    return NextResponse.json({ avatar });
  } catch (e) {
    return serverError("profile.avatar", e);
  }
}
