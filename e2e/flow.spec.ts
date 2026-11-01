import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
  await page.getByRole("link", { name: "Tạo tài khoản cho con" }).click();
  await expect(page).toHaveURL(/\/parent\/children$/);
  await page.getByLabel("Tên hiển thị").fill("Hạnh Nguyên");
  await page.getByLabel("Lớp").fill("9");
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();

  const status = page.getByRole("status");
  await expect(status).toContainText("Đã tạo");
  childEmail = (await status.locator("dd").nth(0).innerText()).trim();
  childPassword = (await status.locator("dd").nth(1).innerText()).trim();
  expect(childEmail).toMatch(/^hanh-nguyen-[0-9a-f]{6}@/);
  expect(childPassword.length).toBeGreaterThanOrEqual(24);

  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "Hạnh Nguyên" })).toHaveCount(1);
  await expect(page.getByText(childPassword)).toHaveCount(0); // never shown again
  // The home page now shows the child's day.
  await page.goto("/parent");
  await expect(page.getByRole("region", { name: "Hạnh Nguyên" })).toBeVisible();
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
  await page.getByRole("button", { name: "Giao bài mới" }).click();
  const form = page.getByRole("form", { name: "Giao bài tập" });
  await expect(form.getByRole("button", { name: "Hạnh Nguyên", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(form.getByRole("button", { name: /Ngày mai/ })).toHaveAttribute("aria-pressed", "true");
  await form.getByLabel("Chụp ảnh / chọn tệp").setInputFiles({ name: "bai-toan.png", mimeType: "image/png", buffer: makePng(2400, 1800) });
  await expect(form.getByRole("img", { name: "Tệp 1" })).toBeVisible();
  await form.getByLabel("Ghi chú (tùy chọn)").fill("Làm bài 1-3 trang 45");
  await form.getByRole("button", { name: "Giao Toán cho Hạnh Nguyên" }).click();
  await expect(page.getByRole("dialog", { name: "Giao bài mới" })).toBeHidden(); // the sheet closes
  await expect(page.getByRole("status")).toContainText("Đã giao Toán cho Hạnh Nguyên");
  await expect(page.getByRole("status")).toContainText("(1 tệp)");

  const list = page.getByRole("region", { name: /^Đang chờ con làm/ });
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
  const list = page.getByRole("region", { name: /^Đang chờ con làm/ });
  await list.getByRole("button", { name: /^Gỡ bài Toán/ }).click();
  await expect(page.getByRole("region", { name: /^Đang chờ con làm/ }).getByText("Không có bài nào đang chờ.")).toBeVisible();

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

  // Homework: start (focus mode opens), then "Nộp ảnh bài": 2 photos, one is removed, then send.
  const homework = page.getByRole("listitem", { name: "Ngữ văn" });
  const focus = page.getByRole("dialog", { name: "Đang tập trung" });
  await homework.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(focus).toBeVisible();
  await focus.getByRole("button", { name: "Nộp ảnh bài" }).click();
  const sheet = page.getByRole("dialog", { name: "Nộp ảnh bài Ngữ văn" });
  await expect(sheet.getByRole("img", { name: "Mã QR mở bài này trên điện thoại" })).toBeVisible(); // laptop: phone QR
  await sheet.locator('input[type="file"]').setInputFiles([
    { name: "vo-1.png", mimeType: "image/png", buffer: makePng(1800, 2400) },
    { name: "vo-2.png", mimeType: "image/png", buffer: makePng(1800, 2400) },
    { name: "mo.png", mimeType: "image/png", buffer: makePng(600, 800) },
  ]);
  await sheet.getByRole("button", { name: "Bỏ ảnh 3" }).click();
  await sheet.getByRole("button", { name: "Nộp 2 ảnh và xong" }).click();
  await expect(homework.getByText("✓ Xong")).toBeVisible();
  await expect(sheet).toHaveCount(0);
  await expect(focus).toHaveCount(0);
  const { data: twoPhotos } = await admin().from("task_runs").select("proof_paths").eq("source", "homework").not("done_at", "is", null).single();
  expect(twoPhotos?.proof_paths).toHaveLength(2);

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
  const ok = kid.getByRole("listitem", { name: "Luyện đề e2e" }).getByRole("button", { name: "Đạt", exact: true });
  await ok.click();
  await expect(ok).toHaveAttribute("aria-pressed", "true");
  // Saved on the server before reloading (the button flips at once, the request follows).
  await expect.poll(async () => (await admin().from("task_runs").select("id").not("parent_verdict", "is", null)).data?.length ?? 0).toBe(2);

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
  // The child sees that a parent looked at the work, never the verdict itself.
  await expect(page.getByText("Bố mẹ đã xem ✓").first()).toBeVisible();
  await expect(page.getByText("Chưa đạt")).toHaveCount(0);
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
  await page.getByRole("button", { name: "Giao bài mới" }).click();
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
  await expect(page.getByRole("status")).toContainText("(1 tệp)");

  const list = page.getByRole("region", { name: /^Đang chờ con làm/ });
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
  await expect(item.getByRole("button", { name: "Xong rồi · nộp ảnh" })).toBeVisible();
  // The laptop's QR code opens /today?nop=<id> on the phone: the sheet opens straight away,
  // without the focus screen (the homework was done in the notebook).
  const { data: english } = await admin().from("homework_items").select("id").eq("subject", "Tiếng Anh").single();
  await page.goto(`/today?nop=${english?.id ?? ""}`);
  const sheet = page.getByRole("dialog", { name: "Nộp ảnh bài Tiếng Anh" });
  await expect(sheet).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Đang tập trung" })).toHaveCount(0);
  await sheet.locator('input[type="file"]').setInputFiles({ name: "vo.png", mimeType: "image/png", buffer: makePng(1200, 1600) });
  await sheet.getByRole("button", { name: "Nộp 1 ảnh và xong" }).click();
  await expect(page.getByRole("listitem", { name: "Tiếng Anh" }).getByText("✓ Xong · ★ sớm")).toBeVisible();
  await expect(page).toHaveURL(/\/today$/);
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

test("Thêm nhanh: one tap adds Google Meet for both children; saved HTML/PDF files can be allowed", async ({ page }) => {
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/allowlist");
  await page.getByRole("button", { name: "Thêm Google Meet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã thêm Google Meet" })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "ogs.google.com" })).toContainText("Cả 2 con");
  const { data: meet } = await admin().from("allowlist_entries").select("child_id, expires_at").eq("domain", "meet.google.com");
  expect(meet?.some((r) => r.child_id === null && r.expires_at === null)).toBe(true);
  await expect(page.getByRole("region", { name: "Thêm nhanh" }).getByText("✓ Đã có").first()).toBeVisible();

  // "Luật trong nhà": the saved-files switch is stored (the extension reads it from /api/ext/state).
  await page.goto("/parent/settings");
  await page.getByLabel("Cho mở file HTML và PDF trên máy trong giờ học").check();
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(page.getByRole("status")).toHaveText("Đã lưu cài đặt.");
  const { data: fs } = await admin().from("family_settings").select("allow_local_files").single();
  expect(fs?.allow_local_files).toBe(true);
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

// ---------------------------------------------------------------------------
// "Nhờ bố mẹ xem trực tiếp": no photo possible, a parent nearby confirms (19/10/2026)
// ---------------------------------------------------------------------------

test("Confirm: the child asks a parent to look; the parent confirms on the phone; it counts as done and Đạt", async ({ page, browser }) => {
  const { data: kid } = await admin().from("profiles").select("id").eq("role", "child").single();
  await login(page, env.parentEmail, env.parentPassword);
  const due = addDays(localDate(new Date()), 1);
  const made = await page.evaluate(
    async ({ childId, dueDate }) => (await fetch("/api/admin/homework", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId, subject: "Mỹ thuật", dueDate, note: "Vẽ tranh trong vở" }) })).status,
    { childId: kid?.id ?? "", dueDate: due },
  );
  expect(made).toBeLessThan(300);

  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await login(child, childEmail, childPassword);
  const row = child.getByRole("listitem", { name: "Mỹ thuật" });
  await row.getByRole("button", { name: "Xong rồi · nộp ảnh" }).click();
  const sheet = child.getByRole("dialog", { name: "Nộp ảnh bài Mỹ thuật" });
  await sheet.getByRole("button", { name: "Không chụp được? Nhờ bố mẹ xem trực tiếp" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(row.getByText("Đang chờ bố mẹ xem…")).toBeVisible();
  await expect(child.getByRole("dialog", { name: "Đang tập trung" })).toHaveCount(0);

  // The child cannot confirm it.
  const { data: run } = await admin().from("task_runs").select("id").not("confirm_requested_at", "is", null).single();
  const self = await child.evaluate(async (id) => (await fetch(`/api/admin/runs/${id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "ok" }) })).status, run?.id ?? "");
  expect(self).toBe(403);

  // The parent sees it on the home page and confirms it.
  await page.goto("/parent");
  await expect(page.getByRole("region", { name: "Cần bố mẹ làm" })).toContainText("nhờ bố mẹ xem bài trực tiếp");
  await page.goto("/parent/requests");
  const ask = page.getByRole("article", { name: "Nhờ xem Mỹ thuật" });
  await ask.getByRole("button", { name: "Đã xem, cho xong" }).click();
  await expect(ask).toHaveCount(0);

  const { data: after } = await admin().from("task_runs").select("done_at, confirmed_by, parent_verdict, proof_paths").eq("id", run?.id ?? "").single();
  expect(after?.done_at).toBeTruthy();
  expect(after?.confirmed_by).toBeTruthy();
  expect(after?.parent_verdict).toBe("ok");
  expect(after?.proof_paths ?? []).toHaveLength(0);
  const { data: hw } = await admin().from("homework_items").select("done_at").eq("subject", "Mỹ thuật").single();
  expect(hw?.done_at).toBeTruthy();

  // The child's screen follows by itself (fast refresh while something is in progress).
  await expect(row.getByText("✓ Xong")).toBeVisible({ timeout: 20_000 });
  await childCtx.close();
});

// ---------------------------------------------------------------------------
// Child PIN sign-in on a remembered browser (child UI review 19/10/2026)
// ---------------------------------------------------------------------------

test("PIN: parent sets it; on the remembered laptop the child signs in with 6 digits; 5 wrong tries lock it", async ({ page, browser }) => {
  const { data: kid } = await admin().from("profiles").select("id, display_name").eq("role", "child").single();
  const childId = kid?.id ?? "";

  // The parent sets the PIN (an easy one is refused).
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/children");
  const item = page.getByRole("listitem").filter({ hasText: kid?.display_name ?? "" });
  await item.getByText("Sửa").click();
  const pinForm = item.getByRole("form", { name: /^PIN của/ });
  await pinForm.getByLabel("PIN 6 số mới").fill("123456");
  await pinForm.getByRole("button", { name: /PIN$/ }).click();
  await expect(pinForm.getByRole("alert")).toContainText("dễ đoán");
  await pinForm.getByLabel("PIN 6 số mới").fill("482916");
  await pinForm.getByRole("button", { name: /PIN$/ }).click();
  await expect(pinForm.getByRole("status")).toContainText("Đã lưu PIN");
  const { data: stored } = await admin().from("profiles").select("pin_hash").eq("id", childId).single();
  expect(stored?.pin_hash).toMatch(/^scrypt\$/);
  expect(stored?.pin_hash).not.toContain("482916");

  // A child cannot set a PIN.
  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await login(child, childEmail, childPassword); // remembers this browser
  const set = await child.evaluate(async (id) => (await fetch(`/api/admin/children/${id}/pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "777123" }) })).status, childId);
  expect(set).toBe(403);

  // Sign out -> the login page offers the PIN; the right PIN opens /today.
  await child.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(child).toHaveURL(/\/login$/);
  await expect(child.getByRole("region", { name: /^PIN của/ })).toBeVisible(); // only one child: chosen already
  await child.getByLabel("Nhập PIN 6 số").fill("482916");
  await expect(child).toHaveURL(/\/today$/);

  // Wrong PINs: 4 warnings, the 5th locks; then even the right PIN waits.
  const pinBox = child.getByRole("region", { name: /^PIN của/ }); // (Next.js also has a role=alert announcer)
  await child.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(child).toHaveURL(/\/login$/);
  for (let n = 1; n <= 4; n++) {
    await child.getByLabel("Nhập PIN 6 số").fill(`00000${n}`);
    await expect(pinBox.getByRole("alert")).toContainText(`Còn ${5 - n} lần thử`);
  }
  await child.getByLabel("Nhập PIN 6 số").fill("000005");
  await expect(pinBox.getByRole("alert")).toContainText("Đợi 15 phút");
  await child.getByLabel("Nhập PIN 6 số").fill("482916");
  await expect(pinBox.getByRole("alert")).toContainText("đang bị khóa");
  await expect(child).toHaveURL(/\/login$/);
  await childCtx.close();

  // A browser that was never used by the child cannot use the PIN at all.
  await admin().from("profiles").update({ pin_failed_count: 0, pin_locked_until: null }).eq("id", childId);
  const strangerCtx = await browser.newContext();
  const stranger = await strangerCtx.newPage();
  await stranger.goto("/login");
  await expect(stranger.getByLabel("Email")).toBeVisible(); // no PIN screen
  const res = await stranger.evaluate(async (id) => (await fetch("/api/pin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: id, pin: "482916" }) })).status, childId);
  expect(res).toBe(403);
  await strangerCtx.close();

  const { data: logs } = await admin().from("audit_log").select("action").in("action", ["child.pin_set", "pin.login", "pin.login_failed"]);
  expect(logs?.some((l) => l.action === "pin.login")).toBe(true);
  expect(logs?.filter((l) => l.action === "pin.login_failed").length).toBe(5);
});

// ---------------------------------------------------------------------------
// Blocked frames inside a study page become a "Con nhờ" entry (24/10/2026)
// ---------------------------------------------------------------------------

test("Frames: a same-site frame blocked inside Meet becomes one request; others are ignored", async ({ request }) => {
  const { data: kid } = await admin().from("profiles").select("id, family_id").eq("role", "child").single();
  const token = randomBytes(32).toString("base64url");
  await admin().from("extension_devices").insert({ family_id: kid?.family_id, child_id: kid?.id, token_hash: createHash("sha256").update(token).digest("hex"), label: "e2e frames" });
  const send = (page: string, frame: string, t = token) =>
    request.post("/api/ext/frame-block", { headers: { Authorization: `Bearer ${t}` }, data: { page, frame } });

  // meet.google.com is allowed (Thêm nhanh earlier); widgets.google.com is not.
  expect((await (await send("https://meet.google.com", "https://widgets.google.com/frame?x=1")).json()).ok).toBe(true);
  const { data: rows } = await admin().from("unlock_requests").select("domain, status, reason").eq("domain", "widgets.google.com");
  expect(rows).toHaveLength(1);
  expect(rows?.[0]?.status).toBe("pending");
  expect(rows?.[0]?.reason).toContain("Tự phát hiện");
  expect(rows?.[0]?.reason).toContain("meet.google.com");

  expect((await (await send("https://meet.google.com", "https://widgets.google.com/other")).json()).ignored).toBe("already asked");
  expect((await (await send("https://meet.google.com", "https://ads.doubleclick.net/x")).json()).ignored).toBe("not same site");
  expect((await (await send("https://www.example.com", "https://sub.example.com/x")).json()).ignored).toBe("page not allowed");
  expect((await (await send("https://meet.google.com", "https://ogs.google.com/x")).json()).ignored).toBe("already allowed");
  // Audit 24/10: never a "Tự phát hiện" request for Google Search.
  expect((await (await send("https://meet.google.com", "https://www.google.com/search?q=game")).json()).ignored).toBe("forbidden site");
  expect((await send("https://meet.google.com", "https://widgets.google.com/x", "not-a-real-token-0000000000000000000000000")).status()).toBe(401);
});

// ---------------------------------------------------------------------------
// Security fixes after the audit of 24/10/2026
// ---------------------------------------------------------------------------

test("Audit: parent signs the child out of every browser; 'Quên máy này'; login never leaves the site", async ({ page, browser }) => {
  const { data: kid } = await admin().from("profiles").select("id, display_name").eq("role", "child").single();
  const childId = kid?.id ?? "";

  // Laptop A remembers the child, then signs out (PIN offered). Browser B stays signed in.
  const aCtx = await browser.newContext();
  const a = await aCtx.newPage();
  a.on("dialog", (d) => void d.accept());
  await login(a, childEmail, childPassword);
  await a.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(a.getByRole("region", { name: /^PIN của/ })).toBeVisible();
  const bCtx = await browser.newContext();
  const b = await bCtx.newPage();
  await login(b, childEmail, childPassword);

  // The parent: "Đăng xuất con khỏi mọi máy".
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/children");
  const item = page.getByRole("listitem").filter({ hasText: kid?.display_name ?? "" });
  await item.getByText("Sửa").click();
  await expect(item.getByText(/Đang nhớ PIN trên \d+ trình duyệt/)).toBeVisible();
  page.on("dialog", (d) => void d.accept());
  await item.getByRole("button", { name: "Đăng xuất con khỏi mọi máy" }).click();
  await expect(item.getByRole("status")).toContainText("Đã đăng xuất con khỏi mọi máy");
  const { count: left } = await admin().from("pin_devices").select("id", { count: "exact", head: true }).eq("child_id", childId).is("revoked_at", null);
  expect(left).toBe(0);

  // Laptop A no longer offers the PIN, and the PIN is refused there.
  await a.goto("/login");
  await expect(a.getByLabel("Email")).toBeVisible();
  await expect(a.getByRole("region", { name: /^PIN của/ })).toHaveCount(0);
  const pinRes = await a.evaluate(async (id) => (await fetch("/api/pin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: id, pin: "482916" }) })).status, childId);
  expect(pinRes).toBe(403);

  // Browser B's old session cannot remember a browser again (signed out, or too old).
  const again = await b.evaluate(async () => (await fetch("/api/pin/remember", { method: "POST" })).status);
  expect([401, 409]).toContain(again);
  await bCtx.close();

  // A fresh password login on laptop A remembers it again; then the child forgets it.
  await login(a, childEmail, childPassword);
  await a.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(a.getByRole("region", { name: /^PIN của/ })).toBeVisible();
  await a.getByRole("button", { name: /Quên máy này/ }).click();
  await expect(a.getByLabel("Email")).toBeVisible();
  await a.reload();
  await expect(a.getByRole("region", { name: /^PIN của/ })).toHaveCount(0);
  await expect(a.getByRole("button", { name: /Quay lại đăng nhập bằng PIN/ })).toHaveCount(0);
  await aCtx.close();

  // A tricky "next" after login stays on our own site.
  const cCtx = await browser.newContext();
  const c = await cCtx.newPage();
  await c.goto("/login?next=/%09/example.com");
  await c.getByLabel("Email").fill(childEmail);
  await c.getByLabel("Mật khẩu").fill(childPassword);
  await c.getByRole("button", { name: /Đăng nhập/ }).click();
  await expect(c).toHaveURL(/\/today$/);
  expect(new URL(c.url()).hostname).toBe("localhost");
  await cCtx.close();

  const { data: logs } = await admin().from("audit_log").select("action").in("action", ["child.sign_out_all", "child.sessions_revoked"]);
  expect(logs?.some((l) => l.action === "child.sign_out_all")).toBe(true);
  expect(logs?.some((l) => l.action === "child.sessions_revoked")).toBe(true);
});

// ---------------------------------------------------------------------------
// S5 Web Push (01/11/2026)
// ---------------------------------------------------------------------------

test("Push: a parent turns notifications on/off for a device; children cannot; cron needs the secret", async ({ page, browser, request }) => {
  const sub = {
    endpoint: `https://push.example.invalid/e2e-${randomBytes(6).toString("hex")}`,
    keys: { p256dh: "B" + "A".repeat(86), auth: "A".repeat(22) },
  };
  const call = (p: Page, method: string, url: string, body?: unknown) =>
    p.evaluate(
      async ([m, u, b]) => (await fetch(u as string, { method: m as string, headers: { "Content-Type": "application/json" }, body: b === undefined ? undefined : JSON.stringify(b) })).status,
      [method, url, body] as const,
    );

  // The parent page loads and offers the switch (keys are set in CI).
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent/notifications");
  await expect(page.getByRole("heading", { name: "Thông báo", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Máy này", exact: true })).toBeVisible();

  const { data: parent } = await admin().from("profiles").select("id").eq("role", "parent").limit(1).single();
  expect(await call(page, "POST", "/api/push/subscribe", sub)).toBe(200);
  expect(await call(page, "POST", "/api/push/subscribe", sub)).toBe(200); // same device twice = one row
  const { data: rows } = await admin().from("push_subscriptions").select("profile_id").eq("endpoint", sub.endpoint);
  expect(rows).toHaveLength(1);
  expect(rows?.[0]?.profile_id).toBe(parent?.id);
  expect(await call(page, "POST", "/api/push/subscribe", { endpoint: "http://insecure.example/x", keys: sub.keys })).toBe(400);
  // "Gửi thử" answers even when the push service cannot be reached.
  expect(await call(page, "POST", "/api/push/test")).toBe(200);

  // A child cannot register a device for parent notifications.
  const kCtx = await browser.newContext();
  const k = await kCtx.newPage();
  await login(k, childEmail, childPassword);
  expect(await call(k, "POST", "/api/push/subscribe", { ...sub, endpoint: sub.endpoint + "-kid" })).toBe(403);
  await kCtx.close();

  // Turning it off removes the row.
  expect(await call(page, "DELETE", "/api/push/subscribe", { endpoint: sub.endpoint })).toBe(200);
  const { count } = await admin().from("push_subscriptions").select("id", { count: "exact", head: true }).eq("endpoint", sub.endpoint);
  expect(count).toBe(0);

  // Evening reminder: refused without the secret, runs with it.
  expect((await request.get("/api/cron/evening")).status()).toBe(401);
  expect((await request.get("/api/cron/evening", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
  const ok = await request.get("/api/cron/evening", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` } });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).ok).toBe(true);
});

// ---------------------------------------------------------------------------
// S3d — special days (sick / exam / holiday) set by the parent from the phone
// ---------------------------------------------------------------------------

test("S3d special days: sick opens the child's day; exam drops a task; a child cannot set it", async ({ page, browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, display_name").eq("role", "child").single();
  const childId = kid?.id ?? "";
  const name = kid?.display_name ?? "";
  const today = localDate(new Date());
  const tomorrow = addDays(today, 1);
  const { data: tpl } = await db.from("task_templates").select("id").eq("title", "Luyện đề e2e").single();

  // Parent: today is a sick day.
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent");
  const card = page.getByRole("region", { name });
  await card.getByRole("button", { name: /^Ngày đặc biệt/ }).click();
  const sheet = page.getByRole("dialog", { name: `Ngày đặc biệt của ${name}` });
  await expect(sheet.getByRole("button", { name: /^Hôm nay/ })).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("radio", { name: /^Ngày ốm/ }).click();
  await sheet.getByRole("button", { name: /^Đặt ngày ốm hôm nay/ }).click();
  await expect(sheet).toBeHidden();
  await expect(card.getByRole("status")).toContainText("Đã lưu");
  await expect(card.getByRole("button", { name: "Ngày đặc biệt · hôm nay: Ngày ốm" })).toBeVisible();

  // Child: the whole day is open, and the screen says why.
  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await login(child, childEmail, childPassword);
  type S = { status: string; open: boolean; dayType: string; part1: { items: { title: string }[] } };
  const state = async () => child.evaluate(async () => ((await (await fetch("/api/today")).json()) as { state: S }).state);
  let s = await state();
  expect(s.status).toBe("OPEN_SICK");
  expect(s.open).toBe(true);
  await expect(child.getByText("Ngày ốm · mở mọi trang")).toBeVisible();

  // Parent: change today to an exam day without "Luyện đề e2e" (the sheet shows what is set).
  await card.getByRole("button", { name: /^Ngày đặc biệt/ }).click();
  await expect(sheet.getByRole("radio", { name: /^Ngày ốm/ })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("radio", { name: /^Ngày thi/ }).click();
  await sheet.getByLabel(/Luyện đề e2e/).check();
  await sheet.getByRole("button", { name: /^Đặt ngày thi hôm nay .* bỏ 1 việc$/ }).click();
  await expect(sheet).toBeHidden();
  const { data: row } = await db.from("day_sessions").select("day_type, disabled_template_ids").eq("child_id", childId).eq("local_date", today).single();
  expect(row).toEqual({ day_type: "exam", disabled_template_ids: [tpl?.id] });

  s = await state();
  expect(s.dayType).toBe("exam");
  expect(s.status).not.toBe("OPEN_SICK");
  expect(s.part1.items.map((i) => i.title)).not.toContain("Luyện đề e2e");
  await child.reload();
  await expect(child.getByText("Ngày thi · xong các việc còn lại là đạt")).toBeVisible();

  // Parent: tomorrow is a holiday (planned ahead); today back to normal.
  await card.getByRole("button", { name: /^Ngày đặc biệt/ }).click();
  await sheet.getByRole("button", { name: /^Ngày mai/ }).click();
  await expect(sheet.getByRole("radio", { name: /^Ngày thường/ })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("radio", { name: /^Ngày lễ/ }).click();
  await sheet.getByRole("button", { name: /^Đặt ngày lễ ngày mai/ }).click();
  await expect(sheet).toBeHidden();
  await card.getByRole("button", { name: /^Ngày đặc biệt/ }).click();
  await sheet.getByRole("radio", { name: /^Ngày thường/ }).click();
  await sheet.getByRole("button", { name: /^Để hôm nay .* là ngày thường/ }).click();
  await expect(sheet).toBeHidden();
  await expect(card.getByRole("button", { name: /^Ngày đặc biệt · Ngày lễ/ })).toBeVisible();

  const { data: rows } = await db.from("day_sessions").select("local_date, day_type, disabled_template_ids").eq("child_id", childId).in("local_date", [today, tomorrow]).order("local_date");
  expect(rows).toEqual([
    { local_date: today, day_type: "normal", disabled_template_ids: [] },
    { local_date: tomorrow, day_type: "holiday", disabled_template_ids: [] },
  ]);
  expect((await state()).dayType).toBe("normal");

  // The server refuses a past day and a task that is not the child's.
  const refused = await page.evaluate(
    async ({ childId, past, today }) => {
      const post = async (body: unknown) => (await fetch("/api/admin/special-days", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status;
      return [
        await post({ childId, date: past, dayType: "sick" }),
        await post({ childId, date: today, dayType: "exam", disabledTemplateIds: ["00000000-0000-4000-8000-000000000000"] }),
      ];
    },
    { childId, past: addDays(today, -1), today },
  );
  expect(refused).toEqual([400, 400]);

  // A child cannot set a day type: not through the API, not directly in the database.
  const viaApi = await child.evaluate(
    async ({ childId, today }) => (await fetch("/api/admin/special-days", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId, date: today, dayType: "sick" }) })).status,
    { childId, today },
  );
  expect(viaApi).toBe(403);
  await childCtx.close();
  const direct = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await direct.auth.signInWithPassword({ email: childEmail, password: childPassword });
  const write = await direct.from("day_sessions").update({ day_type: "sick" }).eq("child_id", childId).select("local_date");
  expect(write.data ?? []).toHaveLength(0);
  const { data: still } = await db.from("day_sessions").select("day_type").eq("child_id", childId).eq("local_date", today).single();
  expect(still?.day_type).toBe("normal");

  const { data: logs } = await db.from("audit_log").select("action").eq("action", "day_type.set");
  expect(logs?.length).toBe(4);
});

// ---------------------------------------------------------------------------
// S3e weekly photo cleanup (01/11/2026)
// ---------------------------------------------------------------------------

test("S3e: weekly cleanup deletes only old files, keeps every row; parent preview; cron needs the secret", async ({ page, browser, request }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const familyId = kid?.family_id as string;
  const childId = kid?.id as string;
  const oldDay = "2025-01-06";
  const folder = `${familyId}/${childId}/${oldDay}`;
  const oldProof = `${folder}/${randomUUID()}.png`; // old file in an old folder -> deleted
  const newProof = `${folder}/${randomUUID()}.png`; // NEW file in an old folder -> kept
  const oldHwFile = `${folder}/${randomUUID()}.png`; // file of homework archived long ago -> deleted
  const activeHwFile = `${folder}/${randomUUID()}.png`; // file of still-active homework -> kept
  const png = () => new Blob([new Uint8Array(makePng(8, 8))], { type: "image/png" });
  for (const p of [oldProof, newProof]) expect((await db.storage.from("proofs").upload(p, png())).error).toBeNull();
  for (const p of [oldHwFile, activeHwFile]) expect((await db.storage.from("homework").upload(p, png())).error).toBeNull();
  const { data: hw, error: hwError } = await db
    .from("homework_items")
    .insert([
      { family_id: familyId, child_id: childId, subject: "Lịch sử", due_date: oldDay, created_at: "2025-01-05T03:00:00Z", archived_at: "2025-01-07T03:00:00Z", photo_paths: [oldHwFile] },
      { family_id: familyId, child_id: childId, subject: "Địa lí", due_date: oldDay, created_at: "2025-01-05T03:00:00Z", photo_paths: [activeHwFile] },
    ])
    .select("id");
  expect(hwError).toBeNull();
  const hwIds = (hw ?? []).map((h) => h.id as string);
  // Storage stamps uploads "now": age three of them in the local database (CI only).
  const dbUrl = process.env.E2E_DB_URL ?? "";
  expect(dbUrl, "E2E_DB_URL (local Supabase) is needed to age test files").not.toBe("");
  const aged = execFileSync(
    "psql",
    [dbUrl, "-v", "ON_ERROR_STOP=1", "-qAt", "-c", `with u as (update storage.objects set created_at = now() - interval '400 days' where name in ('${oldProof}', '${oldHwFile}', '${activeHwFile}') returning 1) select count(*) from u`],
    { encoding: "utf8" },
  ).trim();
  expect(aged).toBe("3");
  const exists = async (bucket: string, p: string) => !(await db.storage.from(bucket).download(p)).error;

  // Cron: refused without the secret; the dry run only counts.
  expect((await request.get("/api/cron/cleanup")).status()).toBe(401);
  expect((await request.get("/api/cron/cleanup", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
  const auth = { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` };
  const dry = await request.get("/api/cron/cleanup?dryRun=1", { headers: auth });
  expect(dry.status()).toBe(200);
  const dryBody = await dry.json();
  expect(dryBody).toMatchObject({ ok: true, dryRun: true, found: { proofs: 1, homework: 1 }, deleted: { proofs: 0, homework: 0 } });
  expect(await exists("proofs", oldProof)).toBe(true);
  expect(await exists("homework", oldHwFile)).toBe(true);

  // Parent preview (own session, RLS): the same counts, nothing deleted.
  await login(page, env.parentEmail, env.parentPassword);
  const previewJson = await page.evaluate(async () => (await fetch("/api/admin/photo-cleanup")).json());
  expect(previewJson).toMatchObject({ retentionDays: 120, proofs: 1, homework: 1, more: false });
  await page.goto("/parent/settings");
  await expect(page.getByRole("heading", { name: "Tự xóa ảnh cũ" })).toBeVisible();
  const result = page.getByRole("region", { name: "Kết quả xem trước" });
  // Retry the tap in case it lands before the page is interactive.
  await expect(async () => {
    await page.getByRole("button", { name: "Xem trước sẽ xóa gì" }).click();
    await expect(result).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await expect(result).toContainText("sẽ xóa 1 ảnh bài con nộp và 1 tệp đề bài");
  await expect(result).toContainText("Xem trước không xóa gì");
  expect(await exists("proofs", oldProof)).toBe(true);

  // A child cannot use the preview.
  const kCtx = await browser.newContext();
  const k = await kCtx.newPage();
  await login(k, childEmail, childPassword);
  expect(await k.evaluate(async () => (await fetch("/api/admin/photo-cleanup")).status)).toBe(403);
  await kCtx.close();

  // The real run deletes only the old files.
  const run = await request.get("/api/cron/cleanup", { headers: auth });
  expect(run.status()).toBe(200);
  const body = await run.json();
  expect(body).toMatchObject({ ok: true, dryRun: false, deleted: { proofs: 1, homework: 1 }, more: false });
  expect(JSON.stringify(body)).not.toContain(childId); // counts only, never paths
  expect(await exists("proofs", oldProof)).toBe(false);
  expect(await exists("homework", oldHwFile)).toBe(false);
  expect(await exists("proofs", newProof)).toBe(true);
  expect(await exists("homework", activeHwFile)).toBe(true);
  // Rows stay as they were (paths kept, so counts on every screen stay right).
  const { data: rows } = await db.from("homework_items").select("id, photo_paths").in("id", hwIds);
  expect(rows).toHaveLength(2);
  expect(rows?.find((r) => r.id === hwIds[0])?.photo_paths).toEqual([oldHwFile]);
  const { data: logs } = await db.from("audit_log").select("payload").eq("action", "photos.cleanup");
  expect(logs?.length).toBeGreaterThanOrEqual(1);
  // Nothing left to do on the next run.
  expect((await (await request.get("/api/cron/cleanup?dryRun=1", { headers: auth })).json()).found).toEqual({ proofs: 0, homework: 0 });

  // "Ngày của con" shows a neutral note instead of a broken photo for a day past retention.
  const today = localDate(new Date());
  const day = addDays(today, -10);
  const { error: runError } = await db.from("task_runs").insert({
    family_id: familyId, child_id: childId, local_date: day, source: "homework", homework_item_id: hwIds[0],
    started_at: new Date(Date.now() - 10 * 86400000).toISOString(), done_at: new Date(Date.now() - 10 * 86400000 + 600000).toISOString(), proof_paths: [oldProof],
  });
  expect(runError).toBeNull();
  await db.from("family_settings").update({ photo_retention_days: 7 }).eq("family_id", familyId);
  await page.goto(`/parent/review?con=${childId}&ngay=${day}`);
  await expect(page.getByText("Ảnh đã xóa sau 7 ngày")).toBeVisible();
  await db.from("family_settings").update({ photo_retention_days: 120 }).eq("family_id", familyId);
  await page.reload();
  await expect(page.getByText("Không mở được ảnh")).toBeVisible();

  // Tidy the test rows so later tests see the same data as before.
  await db.from("task_runs").delete().eq("child_id", childId).eq("local_date", day).eq("homework_item_id", hwIds[0]);
  await db.from("homework_items").delete().in("id", hwIds);
});

// ---------------------------------------------------------------------------
// S6 "Báo bố mẹ khi extension bị gỡ / không chạy" (01/11/2026)
// ---------------------------------------------------------------------------

test("S6: the uninstall address records once per laptop per hour and never needs the token", async ({ page, request }) => {
  const { data: kid } = await admin().from("profiles").select("id, family_id").eq("role", "child").single();
  const token = randomBytes(32).toString("base64url");
  const proof = createHash("sha256").update(token).digest("hex");
  const { data: dev } = await admin()
    .from("extension_devices")
    .insert({ family_id: kid?.family_id, child_id: kid?.id, token_hash: proof, label: "e2e gỡ" })
    .select("id")
    .single();
  const deviceId = dev?.id as string;
  const open = (k: string) => request.get(`/api/ext/uninstalled?k=${encodeURIComponent(k)}`, { maxRedirects: 0 });
  const forDevice = async () => (await admin().from("audit_log").select("payload").eq("action", "ext.uninstalled").eq("payload->>device_id", deviceId)).data ?? [];
  const total = async () => (await admin().from("audit_log").select("id", { count: "exact", head: true }).eq("action", "ext.uninstalled")).count ?? 0;

  // Valid proof (SHA-256 of the token): one record, the parents are told, the laptop is NOT revoked.
  const first = await open(proof);
  expect(first.status()).toBe(303);
  expect(first.headers().location).toContain("/da-go-extension");
  const rows = await forDevice();
  expect(rows).toHaveLength(1);
  expect(rows[0]?.payload).toMatchObject({ device_id: deviceId, label: "e2e gỡ", notified: true });
  const { data: still } = await admin().from("extension_devices").select("revoked_at").eq("id", deviceId).single();
  expect(still?.revoked_at).toBeNull();

  // Opening it again within the hour does nothing more.
  expect((await open(proof)).status()).toBe(303);
  expect(await forDevice()).toHaveLength(1);

  // Unknown proof, the token itself, garbage: same answer, nothing recorded.
  const before = await total();
  for (const k of [createHash("sha256").update("someone-else").digest("hex"), token, "x", proof.toUpperCase()]) {
    const r = await open(k);
    expect(r.status()).toBe(303);
    expect(r.headers().location).toContain("/da-go-extension");
  }
  expect(await total()).toBe(before);

  // What the browser shows after removing the extension: a short neutral page (public).
  await page.goto(`/api/ext/uninstalled?k=${proof}`);
  await expect(page).toHaveURL(/\/da-go-extension$/);
  await expect(page.getByRole("heading", { name: "Đã gỡ extension Study Launcher" })).toBeVisible();
});

test("S6: /today without the extension tells the parents at most once a day; child only; never on iPad", async ({ page, browser, request }) => {
  const { data: kid } = await admin().from("profiles").select("id, family_id").eq("role", "child").single();
  // Start the day clean (other tests may have opened /today without an extension already).
  await admin().from("audit_log").delete().eq("action", "ext.missing");
  const report = (p: Page) =>
    p.evaluate(async () => {
      const r = await fetch("/api/ext/missing", { method: "POST" });
      return { status: r.status, body: (await r.json()) as { status?: string } };
    });
  const count = async () => (await admin().from("audit_log").select("id", { count: "exact", head: true }).eq("action", "ext.missing")).count ?? 0;

  expect((await request.post("/api/ext/missing")).status()).toBe(401);

  // The child on a desktop Chromium with no extension: /today pings, nobody answers -> reported once.
  const kCtx = await browser.newContext();
  const k = await kCtx.newPage();
  await login(k, childEmail, childPassword);
  await expect(k).toHaveURL(/\/today/);
  await expect(k.getByRole("status", { name: "Extension" })).toContainText("bố mẹ đã được báo", { timeout: 20_000 });
  expect(await count()).toBe(1);
  const { data: row } = await admin().from("audit_log").select("payload").eq("action", "ext.missing").single();
  expect(row?.payload).toMatchObject({ browser: "Chrome", notified: true });
  // Again the same day: nothing new.
  expect(await report(k)).toEqual({ status: 200, body: { status: "already" } });
  await k.reload();
  await expect(k.getByRole("status", { name: "Extension" })).toBeVisible({ timeout: 20_000 });
  expect(await count()).toBe(1);
  await kCtx.close();

  // The child's iPad (Safari asks for the desktop site): never reported.
  await admin().from("audit_log").delete().eq("action", "ext.missing");
  const iCtx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  });
  const i = await iCtx.newPage();
  await login(i, childEmail, childPassword);
  expect((await report(i)).body.status).toBe("ignored");
  await i.waitForTimeout(7000); // longer than the page's own wait: it must not report either
  await expect(i.getByRole("status", { name: "Extension" })).toHaveCount(0);
  expect(await count()).toBe(0);
  await iCtx.close();

  // Parents cannot report; they see both events on "Thiết bị".
  await admin().from("audit_log").insert({ family_id: kid?.family_id, actor_id: kid?.id, action: "ext.missing", payload: { browser: "Edge", notified: true } });
  await login(page, env.parentEmail, env.parentPassword);
  expect((await report(page)).status).toBe(403);
  await page.goto("/parent/devices");
  await expect(page.getByText(/mở Study Launcher trên trình duyệt không có extension: Edge, hôm nay/)).toBeVisible();
  await expect(page.getByText(/Extension trên máy này đã bị gỡ \(hôm nay/)).toBeVisible();
});
