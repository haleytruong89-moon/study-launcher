// PREVIEW database helper, run ONLY by .github/workflows/preview-db*.yml on a GitHub runner.
//
//   node scripts/preview-db/preview-db.mjs wipe   delete every auth user + every Storage file
//   node scripts/preview-db/preview-db.mjs seed   create the fake family (find-or-create, re-runnable)
//
// Env (GitHub secrets, never committed): PREVIEW_DB_URL (only to read the project ref),
// PRODUCTION_PROJECT_REF, PREVIEW_SERVICE_ROLE_KEY, PREVIEW_PARENT_PASSWORD (seed), APP_URL (optional).
// PREVIEW_LOCAL_API_URL (http://127.0.0.1:54321) is set ONLY by ci.yml to test against the local stack.
// Talks to https://<preview ref>.supabase.co only. Refuses when the ref is production's, when the
// key belongs to another project, and (wipe) when any account is not a test account. Never prints
// a URL, key or password.
import { createClient } from "@supabase/supabase-js";
import { SEED, checkPreviewTarget, isTestEmail, vnDate } from "./lib.mjs";

function stop(message) {
  console.log(`::error title=Preview DB::${message}`);
  process.exit(1);
}

const target = checkPreviewTarget({
  previewDbUrl: process.env.PREVIEW_DB_URL,
  productionRef: process.env.PRODUCTION_PROJECT_REF,
  serviceKey: process.env.PREVIEW_SERVICE_ROLE_KEY,
  localApiUrl: process.env.PREVIEW_LOCAL_API_URL, // CI test against the local stack only
});
if (!target.ok) stop(target.reason);

const db = createClient(target.apiUrl, process.env.PREVIEW_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function allUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) stop(`Không đọc được danh sách tài khoản preview (${error.message}).`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function wipe() {
  const users = await allUsers();
  const real = users.filter((u) => !isTestEmail(u.email));
  if (real.length > 0) {
    stop(
      `Project này có ${real.length} tài khoản không phải tài khoản thử (email thật?). ` +
        "Có thể đây là database THẬT: không xóa gì. Xem docs/SETUP.md mục H.",
    );
  }
  for (const u of users) {
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) stop(`Không xóa được 1 tài khoản thử (${error.message}).`);
  }
  console.log(`Đã xóa ${users.length} tài khoản thử.`);

  const { data: buckets, error } = await db.storage.listBuckets();
  if (error) stop(`Không đọc được kho ảnh preview (${error.message}).`);
  for (const b of buckets ?? []) {
    const { error: emptyError } = await db.storage.emptyBucket(b.id);
    if (emptyError) stop(`Không làm trống được kho ${b.id} (${emptyError.message}).`);
    console.log(`Đã làm trống kho ảnh: ${b.id}`);
  }
}

/** Find the auth user by e-mail, or create it; the password is (re)set to the given one. */
async function ensureUser(email, password, metadata) {
  const found = (await allUsers()).find((u) => u.email?.toLowerCase() === email);
  if (found) {
    const { error } = await db.auth.admin.updateUserById(found.id, { password });
    if (error) stop(`Không đặt lại được mật khẩu ${email} (${error.message}).`);
    return found.id;
  }
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
  if (error || !data.user) stop(`Không tạo được tài khoản ${email} (${error?.message}).`);
  return data.user.id;
}

function must(result, what) {
  if (result.error) stop(`${what}: ${result.error.message}`);
  return result.data;
}

async function seed() {
  const password = process.env.PREVIEW_PARENT_PASSWORD ?? "";
  if (password.length < 12) stop("Secret PREVIEW_PARENT_PASSWORD chưa đặt hoặc ngắn hơn 12 ký tự.");

  const now = new Date();
  let launcherDomain = "study-launcher-nine.vercel.app";
  try {
    if (process.env.APP_URL) launcherDomain = new URL(process.env.APP_URL).host;
  } catch {
    /* keep the fallback */
  }

  // Family (the schema allows exactly one). Right after a reset the API may still be reloading
  // its schema cache: wait for it (up to ~60 s) instead of failing.
  let read = await db.from("families").select("id, name").limit(1);
  for (let i = 0; read.error && i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    read = await db.from("families").select("id, name").limit(1);
  }
  const families = must(read, "Đọc families");
  let familyId = families[0]?.id;
  if (!familyId) {
    familyId = must(await db.from("families").insert({ name: SEED.familyName }).select("id").single(), "Tạo gia đình").id;
  }

  // Parent.
  const parentId = await ensureUser(SEED.parent.email, password, {});
  must(
    await db
      .from("profiles")
      .upsert({ id: parentId, family_id: familyId, role: "parent", display_name: SEED.parent.displayName }, { onConflict: "id" }),
    "Tạo hồ sơ phụ huynh",
  );
  must(await db.rpc("seed_family_defaults", { p_family_id: familyId, p_launcher_domain: launcherDomain }), "Nạp cài đặt mặc định");

  // Children, their weekly tasks and a little homework.
  for (const c of SEED.children) {
    const childId = await ensureUser(c.email, password, { role: "child" });
    must(
      await db.from("profiles").upsert(
        { id: childId, family_id: familyId, role: "child", display_name: c.displayName, grade: c.grade, color: c.color },
        { onConflict: "id" },
      ),
      `Tạo hồ sơ ${c.displayName}`,
    );
    must(
      await db
        .from("trust_state")
        .upsert({ child_id: childId, family_id: familyId, mode: "lock", updated_by: parentId }, { onConflict: "child_id", ignoreDuplicates: true }),
      `Trạng thái ${c.displayName}`,
    );

    const templates = must(await db.from("task_templates").select("id").eq("child_id", childId).limit(1), "Đọc mẫu việc");
    if (templates.length === 0) {
      must(
        await db.from("task_templates").insert(
          c.templates.map((t, i) => ({ ...t, family_id: familyId, child_id: childId, weekdays: [1, 2, 3, 4, 5, 6, 7], sort: i })),
        ),
        `Tạo mẫu việc ${c.displayName}`,
      );
    }

    const homework = must(
      await db.from("homework_items").select("id").eq("child_id", childId).is("archived_at", null).limit(1),
      "Đọc bài tập",
    );
    if (homework.length === 0) {
      must(
        await db.from("homework_items").insert(
          c.homework.map((h) => ({
            family_id: familyId,
            child_id: childId,
            subject: h.subject,
            due_date: vnDate(now, h.addDays),
            note: h.note,
            created_by: parentId,
          })),
        ),
        `Tạo bài tập ${c.displayName}`,
      );
    }
    console.log(`Đã có: ${c.displayName} (${c.email})`);
  }

  must(
    await db.from("audit_log").insert({ family_id: familyId, actor_id: parentId, action: "preview.seed", payload: { children: SEED.children.length } }),
    "Ghi nhật ký",
  );
  console.log(`Xong dữ liệu thử. Đăng nhập phụ huynh: ${SEED.parent.email} (mật khẩu = secret PREVIEW_PARENT_PASSWORD).`);
}

const command = process.argv[2];
if (command === "wipe") await wipe();
else if (command === "seed") await seed();
else stop("Cách dùng: node scripts/preview-db/preview-db.mjs wipe|seed");
