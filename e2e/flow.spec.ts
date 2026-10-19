import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { makePng } from "./png";
import { addDays, localDate, weekStart } from "../lib/time";

const env = e2eEnv();

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  // Wait until the session cookie is set and the app has redirected away from /login.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

// Shared across the ordered tests below.
let childEmail = "";
let childPassword = "";

test.describe.configure({ mode: "serial" });

test("health endpoints: app is up and the deployment is ready", async ({ request }) => {
  expect((await request.get("/api/health")).ok()).toBe(true);

  const res = await request.get("/api/health/ready");
  const body = (await res.json()) as { ok: boolean; checks: { name: string; ok: boolean; hint: string }[] };
  const failing = body.checks.filter((c) => !c.ok && c.name !== "family_created");
  // "family_created" is expected to be false until the setup test below has run.
  expect(failing, JSON.stringify(failing)).toEqual([]);
});

test("PWA files are served", async ({ request }) => {
  expect((await request.get("/manifest.webmanifest")).ok()).toBe(true);
  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBe(true);
  expect(sw.headers()["cache-control"]).toContain("no-cache");
});

test("anonymous visitors are sent to the login page; APIs refuse them", async ({ page, request }) => {
  await page.goto("/parent");
  await expect(page).toHaveURL(/\/login$/);
  const res = await request.post("/api/admin/children", {
    data: { displayName: "x", grade: 6, color: "#2F5D9E" },
  });
  expect(res.status()).toBe(401);
});

test("a stranger who is not FIRST_PARENT_EMAIL cannot run first-run setup", async ({ page }) => {
  await login(page, env.strangerEmail, env.strangerPassword);
  await expect(page).toHaveURL(/\/setup$/);
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyName: "Takeover", displayName: "Evil" }),
    });
    return r.status;
  });
  expect(status).toBe(403);
});

test("first parent: first-run setup creates the family", async ({ page }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByLabel("Tên gia đình").fill("Gia đình thử nghiệm");
  await page.getByLabel("Tên hiển thị của bạn").fill("Phụ huynh");
  await page.getByRole("button", { name: "Tạo gia đình" }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await expect(page.getByRole("heading", { name: "Xin chào Phụ huynh" })).toBeVisible();
});

test("setup cannot run a second time for someone else", async ({ page }) => {
  await login(page, env.strangerEmail, env.strangerPassword);
  await expect(page).toHaveURL(/\/setup$/);
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyName: "Second", displayName: "Evil" }),
    });
    return r.status;
  });
  expect(status).toBe(403);
});

test("parent creates a child account and sees the credentials once", async ({ page }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await expect(page).toHaveURL(/\/parent$/);
  await page.getByLabel("Tên hiển thị").fill("Hạnh Nguyên");
  await page.getByLabel("Lớp").fill("9");
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();

  const status = page.getByRole("status");
  await expect(status).toContainText("Đã tạo");
  childEmail = (await status.locator("dd").nth(0).innerText()).trim();
  childPassword = (await status.locator("dd").nth(1).innerText()).trim();
  expect(childEmail).toMatch(/^hanh-nguyen-[0-9a-f]{6}@/);
  expect(childPassword.length).toBeGreaterThanOrEqual(24);

  // The home page now shows the child's day; accounts live under Thêm › Các con.
  await page.reload();
  await expect(page.getByRole("region", { name: "Hạnh Nguyên" })).toBeVisible();
  await page.goto("/parent/children");
  await expect(page.getByRole("listitem").filter({ hasText: "Hạnh Nguyên" })).toHaveCount(1);
  await expect(page.getByText(childPassword)).toHaveCount(0); // never shown again
});

test("the child can log in, sees their name, and cannot reach the parent page", async ({ page }) => {
  await login(page, childEmail, childPassword);
  await expect(page.getByRole("heading", { name: "Chào Hạnh Nguyên" })).toBeVisible();
  await page.goto("/parent");
  await expect(page).toHaveURL(/\/today$/);

  const status = await page.evaluate(async () => {
    const r = await fetch("/api/admin/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Hacker", grade: 6, color: "#2F5D9E" }),
    });
    return r.status;
  });
  expect(status).toBe(403);
});

test("database rules hold when the child talks to Supabase directly with their own login", async () => {
  const child = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await child.auth.signInWithPassword({ email: childEmail, password: childPassword });
  expect(signInError).toBeNull();

  // Sees only themselves, never the parent.
  const { data: profiles } = await child.from("profiles").select("id, display_name, role");
  expect(profiles).toHaveLength(1);
  expect(profiles?.[0]?.role).toBe("child");

  // Cannot read secrets.
  const pin = await child.from("profiles").select("pin_hash");
  expect(pin.error).not.toBeNull();

  // Cannot write business tables (not even for themselves).
  const { data: me } = await child.auth.getUser();
  const { data: family } = await child.from("family_settings").select("family_id").single();
  const write = await child.from("overrides").insert({
    family_id: family?.family_id,
    child_id: me.user?.id,
    local_date: "2026-10-14",
    kind: "open_until",
    until: "2026-10-14T10:00:00Z",
  });
  expect(write.error).not.toBeNull();

  // Cannot reach the parent's data.
  const log = await child.from("audit_log").select("id");
  expect(log.data ?? []).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// S1 — parent: family settings, app slots, task templates, homework with photos
// ---------------------------------------------------------------------------

const admin = () => createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } });

test("S1 settings: parent changes family rules and a bedtime; they persist and are audited", async ({ page }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/settings");
  const free = page.getByLabel("Giờ tự do sau khi xong (phút)");
  await expect(free).toHaveValue("45");
  await free.fill("40");
  await page.getByLabel("Giờ ngủ của Hạnh Nguyên").fill("21:00");
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(page.getByRole("status")).toHaveText("Đã lưu cài đặt.");

  await page.reload();
  await expect(page.getByLabel("Giờ tự do sau khi xong (phút)")).toHaveValue("40");
  await expect(page.getByLabel("Giờ ngủ của Hạnh Nguyên")).toHaveValue("21:00");

  // Out-of-range values are refused by the server, not just the browser.
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        breakMinutes: -5, freeMinutes: 45, extraMinMinutes: 20, skillMinMinutes: 20, passesPerWeek: 1,
        trustUpPct: 90, trustUpWeeks: 3, trustDownPct: 70, homeworkLookaheadDays: 1, photoRetentionDays: 120,
      }),
    });
    return r.status;
  });
  expect(status).toBe(400);

  const { data: s } = await admin().from("family_settings").select("free_minutes, break_minutes").single();
  expect(s).toEqual({ free_minutes: 40, break_minutes: 10 });
  const { data: log } = await admin().from("audit_log").select("action").eq("action", "settings.update");
  expect(log?.length).toBeGreaterThanOrEqual(1);
});

test("S1 slots: parent adds a subject app; its domains are stored for the allowlist", async ({ page }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/slots");
  const form = page.getByRole("region", { name: "Thêm app" });
  await form.getByLabel("Môn").fill("Toán");
  await form.getByLabel("App nhà mình").check();
  await form.getByLabel("Tên hiển thị").fill("App Toán");
  await form.getByLabel("Địa chỉ app").fill("https://math-app-gules.vercel.app/lesson");
  await form.getByLabel("Tên miền khác cần mở").fill("https://cdn.example.com/x");
  await form.getByRole("button", { name: "Thêm app" }).click();
  await expect(form.getByRole("status")).toHaveText("Đã lưu.");

  const list = page.getByRole("region", { name: "Danh sách app" });
  await expect(list.getByText("Toán · App Toán")).toBeVisible();
  await expect(list.getByText(/cdn\.example\.com, math-app-gules\.vercel\.app/)).toBeVisible();

  const { data: slot } = await admin().from("app_slots").select("kind, allow_domains, child_id").single();
  expect(slot).toEqual({ kind: "internal", allow_domains: ["cdn.example.com", "math-app-gules.vercel.app"], child_id: null });
});

test("S1 templates: parent adds a supplementary task by weekday, then turns it off", async ({ page }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/templates");
  const form = page.getByRole("region", { name: "Thêm việc" });
  await form.getByLabel("Phần 1 · Bài bổ sung").check();
  await form.getByLabel("Tên việc").fill("Toán bổ sung");
  await form.getByLabel("Môn (tùy chọn)").fill("Toán");
  await form.getByLabel("App học (tùy chọn)").selectOption({ label: "App Toán" });
  for (const d of ["T2", "T4", "T6"]) await form.getByRole("button", { name: d, exact: true }).click();
  await form.getByLabel("Thời gian tối thiểu (phút)").fill("25");
  await form.getByRole("button", { name: "Thêm việc" }).click();
  await expect(form.getByRole("status")).toHaveText("Đã lưu.");

  const mine = page.getByRole("region", { name: "Việc của Hạnh Nguyên" });
  await expect(mine.getByText("T2, T4, T6 · tối thiểu 25 phút · Toán")).toBeVisible();

  // Edit: turn it off (kept for history, never deleted).
  const item = mine.getByRole("listitem").filter({ hasText: "Toán bổ sung" });
  await item.getByText("Sửa").click();
  await item.getByLabel("Đang dùng").uncheck();
  await item.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(item.getByRole("status")).toHaveText("Đã lưu.");
  await page.reload();
  await expect(page.getByRole("region", { name: "Việc của Hạnh Nguyên" }).getByText("Toán bổ sung (đã tắt)")).toBeVisible();

  const { data: t } = await admin().from("task_templates").select("part, weekdays, min_minutes, active, app_slot_id").single();
  expect(t).toMatchObject({ part: "extra", weekdays: [1, 3, 5], min_minutes: 25, active: false });
  expect(t?.app_slot_id).toBeTruthy();
});

let homeworkId = "";

test("S1 homework: parent assigns homework with a phone-sized photo; the photo is shrunk to <= 1600 px", async ({ page }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/homework");
  const form = page.getByRole("form", { name: "Giao bài tập" });
  await expect(form.getByRole("button", { name: "Hạnh Nguyên", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(form.getByRole("button", { name: /Ngày mai/ })).toHaveAttribute("aria-pressed", "true");
  await form.getByLabel("Chụp ảnh / chọn tệp").setInputFiles({ name: "bai-toan.png", mimeType: "image/png", buffer: makePng(2400, 1800) });
  await expect(form.getByRole("img", { name: "Tệp 1" })).toBeVisible();
  await form.getByLabel("Ghi chú (tùy chọn)").fill("Làm bài 1-3 trang 45");
  await form.getByRole("button", { name: "Giao Toán cho Hạnh Nguyên" }).click();
  await expect(form.getByRole("status")).toContainText("Đã giao Toán cho Hạnh Nguyên");
  await expect(form.getByRole("status")).toContainText("(1 tệp)");

  const list = page.getByRole("region", { name: "Bài đã giao · Hạnh Nguyên" });
  await expect(list.getByText("Làm bài 1-3 trang 45")).toBeVisible();
  const thumb = list.getByRole("img", { name: "Ảnh 1 bài Toán" });
  await expect(thumb).toBeVisible();
  const size = await thumb.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    return { w: img.naturalWidth, h: img.naturalHeight };
  });
  expect(size).toEqual({ w: 1600, h: 1200 });

  const { data: hw } = await admin().from("homework_items").select("id, subject, note, photo_paths, due_date").single();
  expect(hw?.subject).toBe("Toán");
  expect(hw?.photo_paths).toHaveLength(1);
  expect(hw?.photo_paths[0]).toMatch(/\.jpg$/);
  homeworkId = hw?.id ?? "";
});

test("S1 homework: the server refuses photos from another folder and past due dates", async ({ page }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/homework");
  const { data: kid } = await admin().from("profiles").select("id, family_id").eq("role", "child").single();
  const result = await page.evaluate(
    async ({ childId, familyId }) => {
      const post = (body: unknown) =>
        fetch("/api/admin/homework", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(
          (r) => r.status,
        );
      const fake = "44444444-4444-4444-8444-444444444444.jpg";
      const d2 = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
      return {
        otherFamily: await post({ childId, subject: "Toán", dueDate: d2, photoPaths: [`00000000-0000-4000-8000-000000000000/${childId}/${d2}/${fake}`] }),
        otherDate: await post({ childId, subject: "Toán", dueDate: d2, photoPaths: [`${familyId}/${childId}/2099-01-01/${fake}`] }),
        notUploaded: await post({ childId, subject: "Toán", dueDate: d2, photoPaths: [`${familyId}/${childId}/${d2}/${fake}`] }),
        past: await post({ childId, subject: "Toán", dueDate: "2020-01-01", note: "x" }),
        notAChild: await post({ childId: familyId, subject: "Toán", dueDate: d2, note: "x" }),
      };
    },
    { childId: kid?.id ?? "", familyId: kid?.family_id ?? "" },
  );
  expect(result).toEqual({ otherFamily: 400, otherDate: 400, notUploaded: 400, past: 400, notAChild: 400 });
});

test("S1 child: sees their homework and its photo, but cannot assign or change anything", async ({ page }) => {
  const child = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await child.auth.signInWithPassword({ email: childEmail, password: childPassword });

  const { data: items } = await child.from("homework_items").select("id, photo_paths");
  expect(items).toHaveLength(1);
  const photo = items?.[0]?.photo_paths[0] ?? "";
  const { data: file, error: dlError } = await child.storage.from("homework").download(photo);
  expect(dlError).toBeNull();
  expect(file?.type).toBe("image/jpeg");

  // Direct writes are refused by RLS.
  const upd = await child.from("homework_items").update({ archived_at: new Date().toISOString() }).eq("id", homeworkId).select("id");
  expect(upd.data ?? []).toHaveLength(0);
  const tpl = await child.from("task_templates").update({ active: true }).not("id", "is", null).select("id");
  expect(tpl.data ?? []).toHaveLength(0);
  const settings = await child.from("family_settings").update({ free_minutes: 999 }).neq("free_minutes", -1).select("free_minutes");
  expect(settings.data ?? []).toHaveLength(0);
  const up = await child.storage.from("homework").upload(photo.replace(/[^/]+$/, "55555555-5555-4555-8555-555555555555.jpg"), new Blob(["x"], { type: "image/jpeg" }));
  expect(up.error).not.toBeNull();

  // Admin routes refuse the child.
  await login(page, childEmail, childPassword);
  await expect(page).toHaveURL(/\/today$/);
  const statuses = await page.evaluate(async (id) => {
    const call = (method: string, url: string, body: unknown) =>
      fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.status);
    return [
      await call("POST", "/api/admin/homework", { childId: id, subject: "x", dueDate: "2099-01-01", note: "x" }),
      await call("PATCH", `/api/admin/homework/${id}`, { archived: true }),
      await call("PUT", "/api/admin/settings", {}),
      await call("POST", "/api/admin/slots", {}),
      await call("POST", "/api/admin/templates", {}),
    ];
  }, homeworkId);
  expect(statuses).toEqual([403, 403, 403, 403, 403]);
  await page.goto("/parent/homework");
  await expect(page).toHaveURL(/\/today$/);
});

test("S1 homework: parent removes an item; it is archived, not deleted", async ({ page }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/homework");
  page.on("dialog", (d) => void d.accept());
  const list = page.getByRole("region", { name: "Bài đã giao · Hạnh Nguyên" });
  await list.getByRole("button", { name: /^Gỡ bài Toán/ }).click();
  await expect(list.getByText("Chưa có bài nào.")).toBeVisible();

  const { data: hw } = await admin().from("homework_items").select("archived_at").eq("id", homeworkId).single();
  expect(hw?.archived_at).toBeTruthy();
});

test("S1 children: parent renames a child and resets the password; the old password stops working", async ({ page }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await expect(page).toHaveURL(/\/parent$/);
  await page.goto("/parent/children");
  const item = page.getByRole("listitem").filter({ hasText: "Hạnh Nguyên" });
  await item.getByText("Sửa").click();
  await item.getByLabel("Tên của con").fill("Hạnh Nguyên A");
  await item.getByRole("button", { name: "Lưu thông tin" }).click();
  await expect(item.getByRole("status")).toHaveText("Đã lưu.");
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "Hạnh Nguyên A" })).toHaveCount(1);

  const renamed = page.getByRole("listitem").filter({ hasText: "Hạnh Nguyên A" });
  await renamed.getByText("Sửa").click();
  page.on("dialog", (d) => void d.accept());
  await renamed.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  const creds = renamed.getByRole("status");
  await expect(creds).toContainText("Mật khẩu mới");
  const newPassword = (await creds.locator("dd").nth(1).innerText()).trim();
  expect((await creds.locator("dd").nth(0).innerText()).trim()).toBe(childEmail);
  expect(newPassword).not.toBe(childPassword);

  const anon = () => createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  expect((await anon().auth.signInWithPassword({ email: childEmail, password: childPassword })).error).not.toBeNull();
  expect((await anon().auth.signInWithPassword({ email: childEmail, password: newPassword })).error).toBeNull();
  childPassword = newPassword;

  // Another family's id / a non-child id is refused.
  const { data: parent } = await admin().from("profiles").select("id").eq("role", "parent").single();
  const status = await page.evaluate(async (id) => (await fetch(`/api/admin/children/${id}/password`, { method: "POST" })).status, parent?.id ?? "");
  expect(status).toBe(404);
});

test("S1 children: a child cannot rename itself or reset any password", async ({ page }) => {
  await login(page, childEmail, childPassword);
  const { data: kid } = await admin().from("profiles").select("id").eq("role", "child").single();
  const statuses = await page.evaluate(async (id) => {
    const patch = await fetch(`/api/admin/children/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Hacker", grade: 9, color: "#2F5D9E" }),
    });
    const reset = await fetch(`/api/admin/children/${id}/password`, { method: "POST" });
    return [patch.status, reset.status];
  }, kid?.id ?? "");
  expect(statuses).toEqual([403, 403]);
});

// ---------------------------------------------------------------------------
// S2b — child: the "Hôm nay" screen, start / finish with the server clock, proof photo,
// break, free time
// ---------------------------------------------------------------------------

test("S2b today: a full day from Part 1 to free time, with the server enforcing every rule", async ({ page }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, display_name").eq("role", "child").single();
  const childId = kid?.id ?? "";
  const familyId = kid?.family_id ?? "";
  const today = localDate(new Date());
  const all = [1, 2, 3, 4, 5, 6, 7];
  await db.from("task_templates").insert([
    { family_id: familyId, child_id: childId, part: "extra", title: "Luyện đề e2e", subject: "Toán", weekdays: all, min_minutes: 20 },
    { family_id: familyId, child_id: childId, part: "skill", title: "Đọc sách e2e", weekdays: all, min_minutes: 0 },
  ]);
  await db.from("homework_items").insert({ family_id: familyId, child_id: childId, subject: "Ngữ văn", due_date: addDays(today, 1), note: "Bài 2 trang 30" });

  await login(page, childEmail, childPassword);
  await expect(page).toHaveURL(/\/today$/);
  const banner = page.getByRole("region", { name: "Trạng thái hôm nay" });
  await expect(banner).toContainText("Còn 2 việc ở Phần 1");
  await expect(page.getByText("Giờ học · máy chỉ mở trang học")).toBeVisible();
  // New screen (S2d): one "Việc tiếp theo" card suggests the overdue/near homework first.
  await expect(banner.getByText("Việc tiếp theo")).toBeVisible();

  const skill = page.getByRole("listitem", { name: "Đọc sách e2e" });
  await expect(skill.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();

  // The server refuses Part 2 and an early finish, whatever the browser does.
  const today1 = await page.evaluate(async () => (await (await fetch("/api/today")).json()) as { state: { part1: { items: { id: string; title: string }[] }; part2: { items: { id: string; title: string }[] } } });
  const skillId = today1.state.part2.items.find((i) => i.title === "Đọc sách e2e")?.id;
  const extraId = today1.state.part1.items.find((i) => i.title === "Luyện đề e2e")?.id;
  const early = await page.evaluate(async (id) => (await fetch("/api/tasks/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "template", id }) })).status, skillId);
  expect(early).toBe(409);

  // Homework: start (focus mode opens), then the proof photo finishes it.
  const homework = page.getByRole("listitem", { name: "Ngữ văn" });
  const focus = page.getByRole("dialog", { name: "Đang tập trung" });
  await homework.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(focus).toBeVisible();
  await focus.locator('input[type="file"]').setInputFiles({ name: "vo.png", mimeType: "image/png", buffer: makePng(1800, 2400) });
  await expect(homework.getByText("✓ Xong")).toBeVisible();
  await expect(focus).toHaveCount(0);

  // Supplementary task: 20 minutes minimum on the SERVER clock.
  const extra = page.getByRole("listitem", { name: "Luyện đề e2e" });
  await extra.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(focus.getByRole("button", { name: /^Xong/ })).toBeDisabled();
  // "Thu nhỏ" hides focus mode; the row reopens it.
  await focus.getByRole("button", { name: "Thu nhỏ" }).click();
  await expect(focus).toHaveCount(0);
  await extra.getByRole("button", { name: "Đang làm · mở" }).click();
  await expect(focus).toBeVisible();
  const { data: run } = await db.from("task_runs").select("id").eq("template_id", extraId).single();
  const tooEarly = await page.evaluate(async (runId) => {
    const r = await fetch("/api/tasks/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId }) });
    return { status: r.status, body: (await r.json()) as { error?: string } };
  }, run?.id);
  expect(tooEarly.status).toBe(409);
  expect(tooEarly.body.error).toContain("Chưa đủ thời gian tối thiểu");
  const { data: stillOpen } = await db.from("task_runs").select("done_at").eq("id", run?.id ?? "").single();
  expect(stillOpen?.done_at).toBeNull(); // refused = nothing recorded

  // Pretend 21 minutes have passed (server data), then the button works.
  await db.from("task_runs").update({ started_at: new Date(Date.now() - 21 * 60_000).toISOString() }).eq("id", run?.id ?? "");
  await page.reload();
  await focus.getByRole("button", { name: "Xong", exact: true }).click();
  await expect(page.getByRole("listitem", { name: "Luyện đề e2e" }).getByText("✓ Xong")).toBeVisible();

  // Part 1 done -> break offer -> skip -> Part 2.
  await expect(banner).toContainText("Xong Phần 1");
  await banner.getByRole("button", { name: "Học tiếp luôn" }).click();
  await expect(banner).toContainText("Còn 1 việc ở Phần 2");
  await skill.getByRole("button", { name: "Bắt đầu" }).click();
  await focus.getByRole("button", { name: "Xong", exact: true }).click();

  // Free time (40 minutes: the parent changed it in the S1 settings test).
  await expect(banner).toContainText("Xong cả hai phần");
  await expect(page.getByText(/Giờ tự do · còn \d\d:\d\d/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Dùng thẻ hôm nay" })).toHaveCount(0);

  const { data: day } = await db.from("day_sessions").select("part1_done_at, part2_done_at, free_started_at, break_skipped").eq("child_id", childId).eq("local_date", today).single();
  expect(day?.part1_done_at).toBeTruthy();
  expect(day?.part2_done_at).toBeTruthy();
  expect(day?.free_started_at).toBe(day?.part2_done_at);
  expect(day?.break_skipped).toBe(true);
  const { data: hwRow } = await db.from("homework_items").select("done_at").eq("subject", "Ngữ văn").single();
  expect(hwRow?.done_at).toBeTruthy();
  const { data: proofRun } = await db.from("task_runs").select("proof_paths").eq("source", "homework").not("done_at", "is", null).single();
  expect(proofRun?.proof_paths[0]).toMatch(new RegExp(`^${familyId}/${childId}/${today}/[0-9a-f-]{36}\\.jpg$`));
  expect(skillId).toBeTruthy();
});

test("S2b today: the child cannot change the day directly, and parents have no /today", async ({ page }) => {
  const child = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await child.auth.signInWithPassword({ email: childEmail, password: childPassword });
  const write = await child.from("day_sessions").update({ free_started_at: null }).not("child_id", "is", null).select("child_id");
  expect(write.data ?? []).toHaveLength(0);
  const run = await child.from("task_runs").update({ done_at: null }).not("id", "is", null).select("id");
  expect(run.data ?? []).toHaveLength(0);

  await login(page, env.parentEmail, env.parentPassword);
  const status = await page.evaluate(async () => (await fetch("/api/today")).status);
  expect(status).toBe(403);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/parent$/);
});

// ---------------------------------------------------------------------------
// S3a — parent: evening review (finished work, minutes, proof photos, Đạt / Chưa đạt)
// ---------------------------------------------------------------------------

test("S3a review: parent sees today's finished work with photos and minutes, and marks it", async ({ page }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/review");
  const kid = page.getByRole("main", { name: "Ngày của Hạnh Nguyên A" });
  await expect(kid).toContainText("Chờ bố mẹ xem (3)");
  // (No assertion on "ngày đạt": it depends on the bedtime vs the CI clock.)

  const homework = kid.getByRole("listitem", { name: "Ngữ văn · bài trên lớp" });
  await expect(homework.getByRole("img", { name: "Ảnh bài Ngữ văn · bài trên lớp" })).toBeVisible();
  await expect(kid.getByRole("listitem", { name: "Luyện đề e2e" })).toContainText("bài bổ sung");
  await expect(kid.getByRole("listitem", { name: "Đọc sách e2e" })).toContainText("kỹ năng");

  const notOk = homework.getByRole("button", { name: "Chưa đạt" });
  await notOk.click();
  await expect(notOk).toHaveAttribute("aria-pressed", "true");
  await kid.getByRole("listitem", { name: "Luyện đề e2e" }).getByRole("button", { name: "Đạt", exact: true }).click();

  await page.reload();
  const reloaded = page.getByRole("main", { name: "Ngày của Hạnh Nguyên A" });
  await expect(reloaded).toContainText("Chờ bố mẹ xem (1)"); // the two marked ones moved to "Đã xem"
  await expect(reloaded.getByRole("listitem", { name: "Ngữ văn · bài trên lớp" }).getByRole("button", { name: "Chưa đạt" })).toHaveAttribute("aria-pressed", "true");

  const { data: verdicts } = await admin().from("task_runs").select("parent_verdict, verdict_at").not("parent_verdict", "is", null);
  expect(verdicts?.map((v) => v.parent_verdict).sort()).toEqual(["not_ok", "ok"]);
  expect(verdicts?.every((v) => !!v.verdict_at)).toBe(true);

  // "Chưa đạt" is only a note: free time and the day's result are untouched.
  const { data: day } = await admin().from("day_sessions").select("free_started_at").not("free_started_at", "is", null);
  expect(day?.length).toBe(1);
});

test("S3a review: a child cannot mark verdicts", async ({ page }) => {
  const { data: run } = await admin().from("task_runs").select("id").eq("parent_verdict", "not_ok").single();
  const child = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await child.auth.signInWithPassword({ email: childEmail, password: childPassword });
  const direct = await child.from("task_runs").update({ parent_verdict: "ok" }).eq("id", run?.id ?? "").select("id");
  expect(direct.data ?? []).toHaveLength(0);

  await login(page, childEmail, childPassword);
  const status = await page.evaluate(
    async (id) => (await fetch(`/api/admin/runs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verdict: "ok" }) })).status,
    run?.id ?? "",
  );
  expect(status).toBe(403);
  await page.goto("/parent/review");
  await expect(page).toHaveURL(/\/today$/);
});

test("readiness now also reports the family as created", async ({ request }) => {
  const body = (await (await request.get("/api/health/ready")).json()) as {
    ok: boolean;
    checks: { name: string; ok: boolean }[];
  };
  expect(body.ok).toBe(true);
  expect(body.checks.find((c) => c.name === "family_created")?.ok).toBe(true);
});

// ---------------------------------------------------------------------------
// S2c — homework: deadline-only, "Sắp tới" group, edit, PDF/Word/Excel files, ★ sớm
// ---------------------------------------------------------------------------

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

test("S2c homework: parent attaches a PDF, then edits the deadline and note", async ({ page }) => {
  const today = localDate(new Date());
  const in5 = addDays(today, 5);
  const in4 = addDays(today, 4);
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/homework");
  const form = page.getByRole("form", { name: "Giao bài tập" });
  await form.getByRole("button", { name: "Tiếng Anh", exact: true }).click();
  await form.getByRole("button", { name: /Chọn ngày/ }).click();
  await form.getByLabel("Ngày", { exact: true }).fill(in5);
  await form.getByLabel("Chụp ảnh / chọn tệp").setInputFiles({ name: "de-tieng-anh.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(form.getByText("de-tieng-anh.pdf")).toBeVisible();
  // A file type that is not allowed is refused in the browser.
  await form.getByLabel("Chụp ảnh / chọn tệp").setInputFiles({ name: "virus.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") });
  await expect(form.getByRole("alert")).toContainText("không phải ảnh, PDF, Word hay Excel");
  await form.getByRole("button", { name: /^Giao Tiếng Anh cho/ }).click();
  await expect(form.getByRole("status")).toContainText("(1 tệp)");

  const list = page.getByRole("region", { name: /^Bài đã giao · Hạnh Nguyên/ });
  const label = `Tiếng Anh nộp ${in5.slice(8, 10)}/${in5.slice(5, 7)}`;
  const pdfLink = list.getByRole("link", { name: "PDF 1 ↗" });
  await expect(pdfLink).toBeVisible();
  const href = (await pdfLink.getAttribute("href")) ?? "";
  const res = await page.request.get(href);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");

  await list.getByRole("button", { name: `Sửa bài ${label}` }).click();
  const edit = page.getByRole("form", { name: "Sửa bài Tiếng Anh" });
  await expect(edit.getByRole("button", { name: /Chọn ngày/ })).toHaveAttribute("aria-pressed", "true");
  await edit.getByLabel("Ngày", { exact: true }).fill(in4);
  await edit.getByLabel("Ghi chú (tùy chọn)").fill("Unit 3 trang 20");
  await edit.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(edit).toHaveCount(0);
  await expect(list.getByText("Unit 3 trang 20")).toBeVisible();

  const { data: hw } = await admin().from("homework_items").select("due_date, note, photo_paths").eq("subject", "Tiếng Anh").single();
  expect(hw?.due_date).toBe(in4);
  expect(hw?.note).toBe("Unit 3 trang 20");
  expect(hw?.photo_paths).toHaveLength(1);
  expect(hw?.photo_paths[0]).toMatch(/\.pdf$/);

  // The server refuses a new past deadline and a file of another family.
  const { data: row } = await admin().from("homework_items").select("id, child_id, family_id").eq("subject", "Tiếng Anh").single();
  const refused = await page.evaluate(
    async ({ id, childId }) => {
      const patch = (body: unknown) =>
        fetch(`/api/admin/homework/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.status);
      return {
        past: await patch({ subject: "Tiếng Anh", dueDate: "2020-01-01", note: "x", photoPaths: [] }),
        foreign: await patch({
          subject: "Tiếng Anh",
          dueDate: new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10),
          note: "x",
          photoPaths: [`00000000-0000-4000-8000-000000000000/${childId}/2026-10-20/44444444-4444-4444-8444-444444444444.pdf`],
        }),
      };
    },
    { id: row?.id ?? "", childId: row?.child_id ?? "" },
  );
  expect(refused).toEqual({ past: 400, foreign: 400 });
});

test("S2c today: the child sees 'Sắp tới', opens the PDF on our own site, and finishing early earns ★ sớm", async ({ page }) => {
  await login(page, childEmail, childPassword);
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: "Sắp tới — làm trước được" })).toBeVisible();
  // Due homework (Ngữ văn) was done today, so upcoming work is optional today.
  await expect(page.getByText("Không bắt buộc hôm nay")).toBeVisible();

  const item = page.getByRole("listitem", { name: "Tiếng Anh" });
  await expect(item).toContainText("Unit 3 trang 20");
  const href = (await item.getByRole("link", { name: "PDF 1 ↗" }).getAttribute("href")) ?? "";
  expect(href.startsWith("/api/files/homework?path=")).toBe(true);
  expect((await page.request.get(href)).status()).toBe(200);
  const foreign = href.replace(/path=[^%]+/, "path=00000000-0000-4000-8000-000000000000");
  expect((await page.request.get(foreign)).status()).toBe(404);

  await expect(item.getByText(/★ nếu xong đến hết/)).toBeVisible();
  await item.getByRole("button", { name: "Làm trước" }).click();
  await page.getByRole("dialog", { name: "Đang tập trung" }).locator('input[type="file"]').setInputFiles({ name: "vo.png", mimeType: "image/png", buffer: makePng(1200, 1600) });
  await expect(item.getByText("✓ Xong · ★ sớm")).toBeVisible();
  await expect(page.getByText("Tuần này làm sớm 1 bài")).toBeVisible();
});

// ---------------------------------------------------------------------------
// S2e — the child's icon, "Kế hoạch hôm nay", "Tổng kết tuần"
// ---------------------------------------------------------------------------

test("S2e: the child picks an icon and plans today; the plan only reorders 'Việc tiếp theo'", async ({ page }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const today = localDate(new Date());
  await db.from("homework_items").insert([
    { family_id: kid?.family_id, child_id: kid?.id, subject: "Vật lí", due_date: addDays(today, 1), note: "Bài 5" },
    { family_id: kid?.family_id, child_id: kid?.id, subject: "Hóa học", due_date: addDays(today, 1), note: "Bài 6" },
  ]);

  await login(page, childEmail, childPassword);
  await page.getByRole("button", { name: "Đổi biểu tượng" }).click();
  await page.getByRole("dialog", { name: "Chọn biểu tượng của con" }).getByRole("button", { name: "Biểu tượng 🦊" }).click();
  await expect(page.getByRole("button", { name: "Đổi biểu tượng" })).toHaveText("🦊");
  const { data: me } = await db.from("profiles").select("icon").eq("id", kid?.id ?? "").single();
  expect(me?.icon).toBe("🦊");

  // Part 1 was finished earlier today (S2b), so the nudge is gone; plan through the API,
  // then change it in the planner.
  const keys = await page.evaluate(async () => {
    const v = (await (await fetch("/api/today")).json()) as { state: { part1: { items: { key: string; title: string }[] } } };
    const k = (t: string) => v.state.part1.items.find((i) => i.title === t)?.key ?? "";
    return [k("Hóa học"), k("Vật lí")];
  });
  const saved = await page.evaluate(
    async (k) => (await fetch("/api/day/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: k }) })).status,
    keys,
  );
  expect(saved).toBe(200);
  await page.reload();
  const banner = page.getByRole("region", { name: "Trạng thái hôm nay" });
  await expect(banner.getByText("Hóa học", { exact: true })).toBeVisible();
  await expect(banner.getByText("Theo kế hoạch của con · 0/2 xong")).toBeVisible();
  await banner.getByRole("button", { name: "Sửa kế hoạch" }).click();
  const planner = page.getByRole("dialog", { name: "Kế hoạch hôm nay" });
  await planner.getByRole("button", { name: "Đưa Vật lí lên" }).click();
  await planner.getByRole("button", { name: /^Lưu kế hoạch/ }).click();
  await expect(planner).toHaveCount(0);
  await expect(banner.getByText("Vật lí", { exact: true })).toBeVisible();
  const { data: plan } = await db.from("day_plans").select("item_keys").eq("child_id", kid?.id ?? "").eq("local_date", today).single();
  expect(plan?.item_keys).toEqual([keys[1], keys[0]]);

  // Keys that are not today's tasks are refused; the plan never touches the lock state.
  const bad = await page.evaluate(async () => (await fetch("/api/day/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: ["homework:00000000-0000-4000-8000-000000000000"] }) })).status);
  expect(bad).toBe(400);
  const icon = await page.evaluate(async () => (await fetch("/api/profile/icon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ icon: "💩" }) })).status);
  expect(icon).toBe(400);
});

test("S2e: the weekly review is accepted only from Sunday 17:00 to the end of Monday; parents read it", async ({ page }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  await login(page, childEmail, childPassword);
  const res = await page.evaluate(async () => {
    const r = await fetch("/api/week/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wentWell: "Làm sớm 2 bài", changeNext: "Đọc sách sớm hơn" }) });
    return r.status;
  });
  // Server window, Vietnam time: Sunday from 17:00, all of Monday.
  const vn = new Date(Date.now() + 7 * 3600_000);
  const open = vn.getUTCDay() === 1 || (vn.getUTCDay() === 0 && vn.getUTCHours() >= 17);
  expect(res).toBe(open ? 200 : 409);

  // Outside the window, seed last week's answers so the parent view is always checked.
  const today = localDate(new Date());
  if (!open) {
    await db.from("weekly_reviews").upsert({
      child_id: kid?.id,
      family_id: kid?.family_id,
      week_start: addDays(weekStart(today), -7),
      went_well: "Làm sớm 2 bài",
      change_next: "Đọc sách sớm hơn",
    });
  } else {
    await page.reload();
    await expect(page.getByText("✓ Đã gửi cho bố mẹ")).toBeVisible();
  }

  await page.context().clearCookies(); // switch user: /login sends a signed-in user away
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/review");
  const block = page.getByLabel("Tổng kết tuần").first();
  await expect(block).toContainText("Làm sớm 2 bài");
  await expect(block).toContainText("Đọc sách sớm hơn");
});

// ---------------------------------------------------------------------------
// S3c — parent opens / locks / clears from their own phone
// ---------------------------------------------------------------------------

test("S3c: the parent locks, then clears; the child's day follows (server clock, logged)", async ({ page, browser }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/control"); // old link: now the home page, one sheet per child
  await expect(page).toHaveURL(/\/parent$/);
  const card = page.getByRole("region", { name: /^Hạnh Nguyên/ });
  await card.getByRole("button", { name: "Mở / khóa máy" }).click();
  const sheet = page.getByRole("dialog", { name: /^Máy của Hạnh Nguyên/ });
  await sheet.getByRole("radio", { name: /Khóa lại/ }).click();
  await sheet.getByLabel("30 phút").check();
  await sheet.getByRole("button", { name: /^Khóa máy của Hạnh Nguyên.* 30 phút$/ }).click();
  await expect(sheet).toBeHidden();
  await expect(card.getByRole("status")).toContainText("Đã gửi");
  await expect(card).toContainText("Bố mẹ đang khóa máy");

  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await login(child, childEmail, childPassword);
  const status = async () => child.evaluate(async () => ((await (await fetch("/api/today")).json()) as { state: { status: string } }).state.status);
  expect(await status()).toBe("LOCK_OVERRIDE");

  await card.getByRole("button", { name: "Mở / khóa máy" }).click();
  await sheet.getByRole("button", { name: /^Về bình thường/ }).click();
  await expect(sheet).toBeHidden();
  await expect(card).not.toContainText("Bố mẹ đang khóa máy");
  expect(await status()).not.toMatch(/OVERRIDE/);

  // A child cannot create overrides, neither through the API nor directly.
  const viaApi = await child.evaluate(async () => (await fetch("/api/admin/overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: "00000000-0000-4000-8000-000000000000", action: "open", minutes: 60 }) })).status);
  expect(viaApi).toBe(403);
  await childCtx.close();

  const { data: logs } = await admin().from("audit_log").select("action").in("action", ["override.lock", "override.clear"]);
  expect(logs?.length).toBe(2);
});

// ---------------------------------------------------------------------------
// S4b — pairing a laptop with the parent's 6-digit code; the extension's state API
// ---------------------------------------------------------------------------

test("S4b: parent code -> child pairs -> device token reads the state; revoke stops it", async ({ page, browser }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/devices");
  const { data: kid } = await admin().from("profiles").select("id").eq("role", "child").single();
  const card = page.getByRole("region", { name: /^Hạnh Nguyên/ });
  await card.getByRole("button", { name: "Tạo mã ghép máy" }).click();
  const code = ((await card.getByLabel(/^Mã \d/).textContent()) ?? "").trim();
  expect(code).toMatch(/^\d{6}$/);
  const { data: stored } = await admin().from("device_pair_codes").select("code_hash").eq("child_id", kid?.id ?? "").is("used_at", null).single();
  expect(stored?.code_hash).not.toContain(code); // only a hash is stored

  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await login(child, childEmail, childPassword);
  await child.goto("/ghep-may");
  await expect(child.getByText("Chưa thấy extension Study Launcher")).toBeVisible(); // no extension in CI
  const pair = (c: string) =>
    child.evaluate(async (body) => {
      const r = await fetch("/api/ext/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return { status: r.status, body: (await r.json()) as { token?: string; error?: string } };
    }, { code: c, label: "Laptop e2e" });
  const wrong = await pair(code === "000000" ? "111111" : "000000");
  expect(wrong.status).toBe(400);
  const ok = await pair(code);
  expect(ok.status).toBe(200);
  const token = ok.body.token ?? "";
  expect(token.length).toBeGreaterThan(20);
  expect((await pair(code)).status).toBe(400); // a code works once

  const state = await page.request.get("/api/ext/state", { headers: { Authorization: `Bearer ${token}` } });
  expect(state.status()).toBe(200);
  const body = (await state.json()) as { open: boolean; allow: string[]; blockAlways: string[]; pollSeconds: number; launcherUrl: string };
  expect(typeof body.open).toBe("boolean");
  expect(body.blockAlways).toContain("translate.goog");
  expect(body.allow).toContain("translate.google.com");
  expect(body.allow).not.toContain("www.youtube.com");
  expect(body.pollSeconds).toBe(30);
  expect((await page.request.get("/api/ext/state", { headers: { Authorization: "Bearer not-a-real-token-xxxxxxxxxxxx" } })).status()).toBe(401);

  // The parent sees the laptop and removes it -> the token stops working.
  await page.reload();
  const laptop = card.getByRole("listitem").filter({ hasText: "Laptop e2e" });
  await expect(laptop).toContainText("vừa xong");
  page.on("dialog", (d) => void d.accept());
  await laptop.getByRole("button", { name: "Gỡ máy Laptop e2e" }).click();
  await expect(card.getByText("Laptop e2e")).toHaveCount(0);
  expect((await page.request.get("/api/ext/state", { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401);

  // A child cannot create codes; the lock page shows only the blocked host, as text.
  const childCode = await child.evaluate(async (id) => (await fetch("/api/admin/devices/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: id }) })).status, kid?.id ?? "");
  expect(childCode).toBe(403);
  await child.goto("/blocked?u=https://www.youtube.com/watch?v=1&list=2");
  await expect(child.getByText("www.youtube.com")).toBeVisible();
  await childCtx.close();
});

// ---------------------------------------------------------------------------
// S3d — "Trang học" (parent's allowlist) and "Xin mở trang" (child asks, parent decides)
// ---------------------------------------------------------------------------

test("S3d: parent adds a study site; YouTube cannot be added for good; a child cannot edit the list", async ({ page, browser }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/allowlist");
  const form = page.getByRole("form", { name: "Thêm trang học" });
  await form.getByLabel("Trang (tên miền hoặc dán link)").fill("https://meet.google.com/abc-defg-hij");
  await form.getByRole("button", { name: "Thêm trang" }).click();
  await expect(form.getByRole("status")).toContainText("Đã thêm");
  await expect(page.getByRole("listitem", { name: "meet.google.com" })).toContainText("Cả 2 con");
  await form.getByLabel("Trang (tên miền hoặc dán link)").fill("youtube.com");
  await form.getByRole("button", { name: "Thêm trang" }).click();
  await expect(form.getByRole("alert")).toContainText("YouTube");

  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await login(child, childEmail, childPassword);
  const st = await child.evaluate(async () => (await fetch("/api/admin/allowlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: "x.com", childId: null, duration: "permanent" }) })).status);
  expect(st).toBe(403);
  await childCtx.close();
});

test("S3d: the child asks to open a blocked site; the parent opens it for 15 minutes", async ({ page, browser }) => {
  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await login(child, childEmail, childPassword);
  await child.goto("/blocked?u=https://notebooklm.google.com/notebook/1?x=2");
  const box = child.getByRole("region", { name: "Xin mở trang" });
  await box.getByLabel("Để làm gì (tùy chọn)").fill("học với gia sư");
  await box.getByRole("button", { name: "Xin bố mẹ mở trang này" }).click();
  await expect(box.getByRole("status")).toContainText("Đang chờ bố mẹ");
  // Asking again for the same site does not create a second request.
  const again = await child.evaluate(async () => (await (await fetch("/api/unlock-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://notebooklm.google.com/other" }) })).json()) as { status: string });
  expect(again.status).toBe("pending");
  const { count } = await admin().from("unlock_requests").select("id", { count: "exact", head: true }).eq("domain", "notebooklm.google.com");
  expect(count).toBe(1);

  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/requests");
  await expect(page.getByLabel("1 yêu cầu đang chờ")).toBeVisible();
  const card = page.getByRole("region", { name: "Yêu cầu notebooklm.google.com" });
  await expect(card).toContainText("học với gia sư");
  await card.getByRole("button", { name: "Mở 15 phút" }).click();
  await expect(page.getByText("Đã mở 15 phút")).toBeVisible();

  const { data: entry } = await admin().from("allowlist_entries").select("grp, expires_at, child_id").eq("domain", "notebooklm.google.com").single();
  expect(entry?.grp).toBe("request");
  expect(entry?.child_id).toBeTruthy();
  const mins = (new Date(entry?.expires_at ?? 0).getTime() - Date.now()) / 60_000;
  expect(mins).toBeGreaterThan(0);
  expect(mins).toBeLessThanOrEqual(15.1);

  await expect(box.getByText("Bố mẹ đã mở trang này 15 phút.")).toBeVisible({ timeout: 15_000 });
  await childCtx.close();
});

test("S3d: the parent opens the whole zalo.me for good from one request (no Google offer)", async ({ page, browser }) => {
  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await login(child, childEmail, childPassword);
  for (const url of ["https://redirect.zalo.me/v3/verifyv2/pc?token=abc", "https://docs.google.com/document/d/1"]) {
    const st = await child.evaluate(async (u) => (await fetch("/api/unlock-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: u }) })).status, url);
    expect(st).toBeLessThan(300);
  }
  await childCtx.close();

  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/requests");
  await expect(page.getByRole("region", { name: "Yêu cầu docs.google.com" }).getByRole("button", { name: /Luôn cho phép cả/ })).toHaveCount(0);
  const card = page.getByRole("region", { name: "Yêu cầu redirect.zalo.me" });
  await card.getByRole("button", { name: /Luôn cho phép cả zalo\.me/ }).click();
  await expect(page.getByRole("region", { name: "Yêu cầu redirect.zalo.me" })).toHaveCount(0);

  const { data: entry } = await admin().from("allowlist_entries").select("grp, expires_at").eq("domain", "zalo.me").single();
  expect(entry?.grp).toBe("request");
  expect(entry?.expires_at).toBeNull();
  const { count } = await admin().from("allowlist_entries").select("id", { count: "exact", head: true }).eq("domain", "redirect.zalo.me");
  expect(count).toBe(0);
  await page.getByRole("region", { name: "Yêu cầu docs.google.com" }).getByRole("button", { name: "Không" }).click();
  await expect(page.getByRole("region", { name: "Yêu cầu docs.google.com" })).toHaveCount(0);
});

test("S3d: after login the child lands on the page they asked for (/ghep-may)", async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto("/ghep-may");
  await expect(p).toHaveURL(/\/login\?next=%2Fghep-may|\/login\?next=\/ghep-may/);
  await p.getByLabel("Email").fill(childEmail);
  await p.getByLabel("Mật khẩu").fill(childPassword);
  await p.getByRole("button", { name: /Đăng nhập/ }).click();
  await expect(p).toHaveURL(/\/ghep-may$/);
  await ctx.close();
});
