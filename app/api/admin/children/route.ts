import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { childEmail, generatePassword } from "@/lib/children";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  grade: z.number().int().min(1).max(12),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

/** Parent creates a child account. The generated password is returned ONCE and never stored in clear. */
export async function POST(request: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  if (me.profile?.role !== "parent") {
    return NextResponse.json({ error: "Chỉ phụ huynh mới tạo được tài khoản con." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thiếu hoặc sai thông tin." }, { status: 400 });
  }

  const env = serverEnv();
  const admin = createAdminClient();
  const email = childEmail(parsed.data.displayName, env.CHILD_EMAIL_DOMAIN);
  const password = generatePassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "child" },
  });
  if (createError || !created.user) {
    return NextResponse.json(
      { error: "Không tạo được tài khoản đăng nhập cho con. Hãy báo Claude kèm nội dung này: " + (createError?.message ?? "unknown") },
      { status: 500 },
    );
  }

  const childId = created.user.id;
  const familyId = me.profile.family_id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: childId,
    family_id: familyId,
    role: "child",
    display_name: parsed.data.displayName,
    grade: parsed.data.grade,
    color: parsed.data.color,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(childId); // roll back so no orphan login remains
    return NextResponse.json({ error: "Không tạo được hồ sơ cho con." }, { status: 500 });
  }

  await admin.from("trust_state").insert({ child_id: childId, family_id: familyId, mode: "lock", updated_by: me.userId });
  await admin.from("audit_log").insert({
    family_id: familyId,
    actor_id: me.userId,
    action: "child.create",
    payload: { child_id: childId, display_name: parsed.data.displayName },
  });

  return NextResponse.json({ ok: true, child: { id: childId, email, password } });
}
