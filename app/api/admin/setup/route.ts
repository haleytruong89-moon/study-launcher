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
 * Allowed only for FIRST_PARENT_EMAIL, and only while no family exists. The database also allows at
 * most one family (families_singleton_idx), so two simultaneous requests cannot both succeed.
 * If a previous run created the family but failed to seed defaults, the same parent can call this
 * again to finish seeding (the seed function is idempotent).
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thiếu hoặc sai thông tin." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });

  const env = serverEnv();
  if (!env.FIRST_PARENT_EMAIL) {
    return NextResponse.json(
      { error: "Chưa cấu hình FIRST_PARENT_EMAIL trên Vercel (xem docs/SETUP.md, bước A4)." },
      { status: 500 },
    );
  }
  if (auth.user.email?.toLowerCase() !== env.FIRST_PARENT_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Tài khoản này không được phép thiết lập." }, { status: 403 });
  }

  const admin = createAdminClient();
  const launcherDomain = new URL(env.NEXT_PUBLIC_APP_URL).host;

  async function seed(familyId: string) {
    const { error } = await admin.rpc("seed_family_defaults", {
      p_family_id: familyId,
      p_launcher_domain: launcherDomain,
    });
    if (error) console.error("seed_family_defaults failed", error.message);
    return !error;
  }

  // Repair path: this parent already exists but seeding was interrupted earlier.
  const { data: existing } = await admin
    .from("profiles")
    .select("family_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (existing) {
    if (existing.role !== "parent") return NextResponse.json({ error: "Không được phép." }, { status: 403 });
    const ok = await seed(existing.family_id);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Chưa nạp được cài đặt mặc định, thử lại sau." }, { status: 500 });
  }

  const { data: family, error: familyError } = await admin
    .from("families")
    .insert({ name: parsed.data.familyName })
    .select("id")
    .single();
  if (familyError || !family) {
    // 23505 = another family already exists (singleton index)
    const taken = familyError?.code === "23505";
    return NextResponse.json(
      { error: taken ? "Gia đình đã được thiết lập rồi." : "Không tạo được gia đình." },
      { status: taken ? 409 : 500 },
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: auth.user.id,
    family_id: family.id,
    role: "parent",
    display_name: parsed.data.displayName,
  });
  if (profileError) {
    console.error("setup: profile insert failed", profileError.message);
    await admin.from("families").delete().eq("id", family.id);
    return NextResponse.json({ error: "Không tạo được hồ sơ phụ huynh." }, { status: 500 });
  }

  await admin.from("audit_log").insert({
    family_id: family.id,
    actor_id: auth.user.id,
    action: "family.setup",
    payload: { family_name: parsed.data.familyName },
  });

  if (!(await seed(family.id))) {
    return NextResponse.json(
      { error: "Đã tạo gia đình nhưng chưa nạp được cài đặt mặc định. Bấm Tạo gia đình lần nữa để nạp lại." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
