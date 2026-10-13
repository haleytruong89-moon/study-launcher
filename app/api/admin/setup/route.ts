import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

const bodySchema = z.object({
  familyName: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(80),
});

/**
 * First-run setup: the signed-in auth user becomes the first parent and creates the family.
 * Allowed only while NO family exists yet. Later parents/children are added by an existing parent.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thiếu hoặc sai thông tin." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });

  const admin = createAdminClient();
  const env = serverEnv();

  const { count, error: countError } = await admin.from("families").select("id", { count: "exact", head: true });
  if (countError) return NextResponse.json({ error: "Không đọc được dữ liệu." }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "Gia đình đã được thiết lập rồi." }, { status: 409 });
  }

  const { data: family, error: familyError } = await admin
    .from("families")
    .insert({ name: parsed.data.familyName })
    .select("id")
    .single();
  if (familyError || !family) return NextResponse.json({ error: "Không tạo được gia đình." }, { status: 500 });

  const { error: profileError } = await admin.from("profiles").insert({
    id: auth.user.id,
    family_id: family.id,
    role: "parent",
    display_name: parsed.data.displayName,
  });
  if (profileError) {
    await admin.from("families").delete().eq("id", family.id);
    return NextResponse.json({ error: "Không tạo được hồ sơ phụ huynh." }, { status: 500 });
  }

  const { error: seedError } = await admin.rpc("seed_family_defaults", {
    p_family_id: family.id,
    p_launcher_domain: new URL(env.NEXT_PUBLIC_APP_URL).host,
  });
  if (seedError) {
    // Family and parent exist; settings can be re-seeded safely (the function is idempotent).
    return NextResponse.json({ error: "Đã tạo gia đình nhưng chưa nạp được cài đặt mặc định." }, { status: 500 });
  }

  await admin.from("audit_log").insert({
    family_id: family.id,
    actor_id: auth.user.id,
    action: "family.setup",
    payload: { family_name: parsed.data.familyName },
  });

  return NextResponse.json({ ok: true });
}
