import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { makePng } from "./png";
import { addDays, localDate, weekStart } from "../lib/time";
import { inEveningWindow } from "../lib/push/window";

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
  // R8b: "Nghỉ giữa giờ" shows the 4 tiers + breaks per day; the old "Nghỉ giữa 2 phần" is hidden.
  const breaks = page.getByRole("group", { name: "Nghỉ giữa giờ" });
  await expect(breaks.getByLabel("Bậc 1: phút tập trung")).toHaveValue("45");
  await expect(breaks.getByLabel("Bậc 4: phút nghỉ")).toHaveValue("60");
  await expect(breaks.getByLabel("Số lần nghỉ tối đa mỗi ngày")).toHaveValue("6");
  await expect(page.getByLabel("Nghỉ giữa 2 phần (phút)")).toHaveCount(0);

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
  // R8b: break tiers must go up (validated by the server too).
  const badTiers = await page.evaluate(async () => {
    const r = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        breakMinutes: 10, freeMinutes: 40, extraMinMinutes: 20, skillMinMinutes: 20, passesPerWeek: 1,
        trustUpPct: 90, trustUpWeeks: 3, trustDownPct: 70, homeworkLookaheadDays: 1, photoRetentionDays: 120,
        breakTiers: [[90, 30], [45, 10]], breakMaxPerDay: 6,
      }),
    });
    return r.status;
  });
  expect(badTiers).toBe(400);

  const { data: s } = await admin().from("family_settings").select("free_minutes, break_minutes, break_tiers, break_max_per_day").single();
  expect(s).toEqual({ free_minutes: 40, break_minutes: 10, break_tiers: [[45, 10], [90, 30], [120, 45], [180, 60]], break_max_per_day: 6 });
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
  // R8b: the run below is backdated 51 minutes; between 00:00 and 00:51 VN it would start
  // yesterday and earn no break, so skip that hour (same as e2e/r8b.spec.ts).
  const vnHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  test.skip(vnHour < 1, "a 51-minute-old run would start yesterday in Vietnam");
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
  await expect(banner).toContainText("Còn 2 bài tập · 1 kỹ năng");
  await expect(page.getByText("Giờ học · máy chỉ mở trang học")).toBeVisible();
  // New screen (S2d): one "Việc tiếp theo" card suggests the overdue/near homework first.
  await expect(banner.getByText("Việc tiếp theo")).toBeVisible();

  // R2 (07/11/2026): Hôm nay shows the four areas; the task lists live in Góc học tập.
  const tabs = page.getByRole("navigation", { name: "Các mục của con" });
  await expect(page.getByRole("list", { name: "Bốn mảng hôm nay" })).toContainText("Học tập");
  await expect(page.getByRole("listitem", { name: "Đọc sách e2e" })).toHaveCount(0);
  await expect(tabs.getByRole("link", { name: "Hôm nay" })).toHaveAttribute("aria-current", "page");
  // R6d: each card says what is next; free time can be planned (remembered in this browser only).
  const cards = page.getByRole("list", { name: "Bốn mảng hôm nay" });
  await expect(cards.getByRole("listitem")).toHaveCount(3); // Góc bình yên is still off
  const study = cards.getByRole("listitem", { name: "2 · Học tập" });
  await expect(study.getByRole("progressbar", { name: "Bài tập hôm nay" })).toHaveAttribute("aria-valuenow", "0");
  await expect(study).toContainText("Việc tiếp theo · Bài trên lớp");
  await expect(study).toContainText("Ngữ văn");
  await expect(cards.getByRole("listitem", { name: "3 · Kỹ năng" })).toContainText("Đọc sách e2e");
  const play = cards.getByRole("listitem", { name: "4 · Vui chơi" });
  await expect(play).toContainText("Còn 3 việc nữa là có");
  const chip = play.getByRole("group", { name: "Giờ tự do con định làm gì" }).getByRole("button").first();
  const chipName = (await chip.textContent()) ?? "";
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await tabs.getByRole("link", { name: "Góc học tập" }).click();
  await expect(page).toHaveURL(/\/today\?tab=hoc-tap$/);
  await expect(page.getByRole("navigation", { name: "Con đang ở" })).toContainText("Hôm nay › Góc học tập");
  await expect(page.getByRole("heading", { name: "Thứ tự hôm nay" })).toBeVisible();
  // R6c: "Chỉ hiện bài này" (R7a name) shows only the work panel; "← Quay lại" goes back to Hôm nay.
  await page.getByRole("button", { name: "Chỉ hiện bài này" }).click();
  await expect(page.getByRole("heading", { name: "Thứ tự hôm nay" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Khung làm bài" })).toBeVisible();
  await page.getByRole("button", { name: "Hiện cả danh sách" }).click();
  await expect(page.getByRole("heading", { name: "Thứ tự hôm nay" })).toBeVisible();
  await page.getByRole("button", { name: "← Quay lại" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(tabs.getByRole("link", { name: "Hôm nay" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "← Quay lại" })).toHaveCount(0);
  await tabs.getByRole("link", { name: "Góc học tập" }).click();
  await expect(page.getByRole("heading", { name: "Thứ tự hôm nay" })).toBeVisible();

  // R1 (07/11/2026): skills are open from the start, in parallel with homework.
  // R6c: a row's first button selects it; its buttons are in the work panel ("Khung làm bài").
  const work = page.getByRole("region", { name: "Khung làm bài" });
  const skill = page.getByRole("listitem", { name: "Đọc sách e2e" });
  await skill.getByRole("button").first().click();
  await expect(skill.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
  await expect(work.getByRole("heading", { name: "Đọc sách e2e" })).toBeVisible();
  await expect(work.getByRole("button", { name: "Bắt đầu" })).toBeEnabled();

  // The server refuses a break before 45' of focus (R8b), and an early finish, whatever the browser does.
  const today1 = await page.evaluate(async () => (await (await fetch("/api/today")).json()) as { state: { part1: { items: { id: string; title: string }[] }; part2: { items: { id: string; title: string }[] } } });
  const skillId = today1.state.part2.items.find((i) => i.title === "Đọc sách e2e")?.id;
  const extraId = today1.state.part1.items.find((i) => i.title === "Luyện đề e2e")?.id;
  await expect(banner.getByRole("button", { name: /^Nghỉ \d+'$/ })).toHaveCount(0);
  await expect(banner).toContainText("Tập trung đủ 45' để được nghỉ 10'");
  const earlyBreak = await page.evaluate(async () => (await fetch("/api/day/break", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) })).status);
  expect(earlyBreak).toBe(409);
  const oldSkip = await page.evaluate(async () => (await fetch("/api/day/break", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "skip" }) })).status);
  expect(oldSkip).toBe(400);

  // Homework: start from "Việc tiếp theo" on Hôm nay (R6d; same server route). R7a: a small
  // "Mục tiêu nhỏ" card appears, never the focus screen by itself; the child opens it from the
  // card, then "Nộp ảnh bài": 2 photos, one is removed, then send.
  const homework = page.getByRole("listitem", { name: "Ngữ văn" });
  const focus = page.getByRole("dialog", { name: /^Màn tập trung/ });
  const homeworkId = today1.state.part1.items.find((i) => i.title === "Ngữ văn")?.id ?? "";
  await tabs.getByRole("link", { name: "Hôm nay" }).click();
  await study.getByRole("button", { name: "Bắt đầu" }).click();
  const hwStart = page.getByRole("dialog", { name: "Mục tiêu nhỏ: Ngữ văn" });
  await expect(hwStart).toBeVisible();
  await expect(hwStart).toContainText("Làm xong trong vở thì chụp ảnh nộp.");
  await expect(focus).toHaveCount(0);
  await expect.poll(async () => (await db.from("task_runs").select("id").eq("homework_item_id", homeworkId).is("done_at", null)).data?.length ?? 0).toBe(1);
  await hwStart.getByRole("button", { name: "Ngồi cùng màn tập trung" }).click();
  await expect(hwStart).toHaveCount(0);
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
  await expect(sheet).toHaveCount(0);
  await expect(focus).toHaveCount(0);
  await expect(study.getByRole("progressbar", { name: "Bài tập hôm nay" })).toHaveAttribute("aria-valuenow", "1");
  await tabs.getByRole("link", { name: "Góc học tập" }).click();
  await expect(homework.getByText("✓ Xong")).toBeVisible();
  const { data: twoPhotos } = await admin().from("task_runs").select("proof_paths").eq("source", "homework").not("done_at", "is", null).single();
  expect(twoPhotos?.proof_paths).toHaveLength(2);

  // Supplementary task: 20 minutes minimum on the SERVER clock.
  const extra = page.getByRole("listitem", { name: "Luyện đề e2e" });
  await extra.getByRole("button").first().click();
  await expect(work.getByRole("timer")).toHaveText("20 phút"); // the minimum, before starting (R7a: minutes only)
  await work.getByRole("button", { name: "Bắt đầu" }).click();
  const exStart = page.getByRole("dialog", { name: "Mục tiêu nhỏ: Luyện đề e2e" });
  await expect(exStart).toContainText("Toán · ít nhất 20 phút");
  await expect(focus).toHaveCount(0);
  await exStart.getByRole("button", { name: "Để sau" }).click();
  await expect(exStart).toHaveCount(0);
  await expect(extra).toContainText("đang làm");
  await expect(work).toContainText("Đang làm · Bài bổ sung");
  await expect(work.getByRole("timer")).toHaveText(/^còn (19|20) phút$/);
  // "🎯 Tập trung" opens the focus screen; "← Về Hôm nay" closes it; the header chip reopens it.
  await work.getByRole("button", { name: "Tập trung" }).click();
  await expect(focus).toBeVisible();
  await expect(focus.getByRole("button", { name: /^Xong/ })).toBeDisabled();
  await focus.getByRole("button", { name: "← Về Hôm nay" }).click();
  await expect(focus).toHaveCount(0);
  await page.getByRole("button", { name: /^Đang làm Luyện đề e2e/ }).click();
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

  // Pretend 51 minutes have passed (server data), then the button works. The focus screen the
  // child opened stays open after a reload (this tab only). R8b: 51' of focus earn a 10' break.
  await db.from("task_runs").update({ started_at: new Date(Date.now() - 51 * 60_000).toISOString() }).eq("id", run?.id ?? "");
  await page.reload();
  await focus.getByRole("button", { name: "Xong", exact: true }).click();
  await expect(focus).toHaveCount(0);
  await expect(page.getByRole("listitem", { name: "Luyện đề e2e" }).getByText("✓ Xong")).toBeVisible();

  // R8b: 51' of focus -> a 10' break may start (optional; no part needed). During it the task
  // buttons pause; "Học tiếp" resumes and the unused minutes stay in the bank.
  await expect(banner).toContainText("Xong bài tập — còn 1 kỹ năng");
  await expect(banner).toContainText(/Con đã tập trung 5\d' · nghỉ được 10'/);
  await banner.getByRole("button", { name: "Nghỉ 10'" }).click();
  await expect(banner).toContainText("Đang nghỉ");
  await expect(banner).toContainText(/Đang nghỉ · còn (9|10) phút/);
  await expect(page.getByText(/Giờ nghỉ · còn (9|10) phút/)).toBeVisible();
  await skill.getByRole("button").first().click();
  await expect(work.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();
  const duringBreak = await page.evaluate(async (id) => (await fetch("/api/tasks/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "template", id }) })).status, skillId);
  expect(duringBreak).toBe(409);
  await banner.getByRole("button", { name: "Học tiếp" }).click();
  await expect(banner).toContainText("Xong bài tập — còn 1 kỹ năng");
  await expect(banner).toContainText(/Con còn (9|10)' nghỉ để dành/); // "Học tiếp" at once: the minutes stay in the bank
  await work.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("dialog", { name: "Mục tiêu nhỏ: Đọc sách e2e" }).getByRole("button", { name: "Để sau" }).click();
  await work.getByRole("button", { name: "Xong", exact: true }).click(); // R7a: no minimum, so Xong is right in the panel

  // Free time (40 minutes: the parent changed it in the S1 settings test).
  await expect(banner).toContainText("Xong cả hai phần");
  await expect(page.getByText(/Giờ tự do · còn \d\d:\d\d/)).toBeVisible();
  // Back on Hôm nay: the four areas are ticked, no pass offered; the browser's Back button works too.
  await page.goBack();
  await expect(page).toHaveURL(/\/today$/);
  await expect(study).toContainText("Xong hết bài hôm nay ✓");
  await expect(cards.getByRole("listitem", { name: "3 · Kỹ năng" })).toContainText("✓ Xong");
  await expect(play).toContainText("Giờ tự do đang chạy");
  // R8b: the unused break minutes are added to free time (40' set by the parent in S1).
  await expect(play).toContainText(/Giờ tự do 40' \+ (9|10)' nghỉ chưa dùng = (49|50)'/);
  await expect(play).toContainText(`Con định: ${chipName}`);
  await expect(page.getByRole("button", { name: "Dùng thẻ hôm nay" })).toHaveCount(0);
  // Tuần của con: today's three areas are ticked.
  await tabs.getByRole("link", { name: "Tập của tuần" }).click();
  await expect(page.getByRole("heading", { name: "Tuần này của con" })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Học tập");

  const { data: day } = await db.from("day_sessions").select("part1_done_at, part2_done_at, free_started_at, break_started_at, break_ended_at, break_skipped").eq("child_id", childId).eq("local_date", today).single();
  expect(day?.part1_done_at).toBeTruthy();
  expect(day?.part2_done_at).toBeTruthy();
  expect(day?.free_started_at).toBe(day?.part2_done_at);
  // R8b: the break is a day_breaks row (the legacy day_sessions columns stay empty).
  expect(day?.break_started_at).toBeNull();
  expect(day?.break_skipped).toBe(false);
  const { data: breaks } = await db.from("day_breaks").select("planned_minutes, ended_at").eq("child_id", childId).eq("local_date", today);
  expect(breaks).toHaveLength(1);
  expect(breaks?.[0]?.planned_minutes).toBe(10);
  expect(breaks?.[0]?.ended_at).toBeTruthy();
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
  // R2: the child's week (with feelings) is for the child only — parents have no route to it.
  const weekStatus = await page.evaluate(async () => (await fetch("/api/week/days")).status);
  expect(weekStatus).toBe(403);
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
  // The child sees that a parent looked at the work, never the verdict itself (R2: in Góc học tập).
  await page.getByRole("navigation", { name: "Các mục của con" }).getByRole("link", { name: "Góc học tập" }).click();
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
  const tabs = page.getByRole("navigation", { name: "Các mục của con" });
  await tabs.getByRole("link", { name: "Góc học tập" }).click();
  await expect(page.getByRole("heading", { name: "Làm trước ★ — bài sắp tới" })).toBeVisible();
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
  await expect(page.getByRole("dialog", { name: /^Màn tập trung/ })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: /^Mục tiêu nhỏ/ })).toHaveCount(0);
  await sheet.locator('input[type="file"]').setInputFiles({ name: "vo.png", mimeType: "image/png", buffer: makePng(1200, 1600) });
  await sheet.getByRole("button", { name: "Nộp 1 ảnh và xong" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/\/today$/);
  await tabs.getByRole("link", { name: "Góc học tập" }).click();
  await expect(page.getByRole("listitem", { name: "Tiếng Anh" }).getByText("✓ Xong · ★ sớm")).toBeVisible();
  await tabs.getByRole("link", { name: "Tập của tuần" }).click();
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
  await expect(banner.getByText("Theo thứ tự của con · 0/2 xong")).toBeVisible();
  // R2: the order is changed in Góc học tập with ↑ ↓ (saved at once).
  await banner.getByRole("button", { name: "Xếp lại ở Góc học tập" }).click();
  await expect(page).toHaveURL(/\/today\?tab=hoc-tap$/);
  await page.getByRole("button", { name: "Đưa “Vật lí” lên" }).click();
  await expect(page.getByRole("button", { name: "Đưa “Hóa học” lên" })).toBeEnabled(); // saved: Vật lí is now first
  await expect(page.getByRole("button", { name: "Đưa “Vật lí” lên" })).toBeDisabled();
  const savedOrder = async () => ((await db.from("day_plans").select("item_keys").eq("child_id", kid?.id ?? "").eq("local_date", today).single()).data?.item_keys ?? []).slice(0, 2);
  await expect.poll(savedOrder).toEqual([keys[1], keys[0]]);
  // R6c: drag ⋮⋮ (mouse here; the same pointer events serve touch and pen) puts Hóa học back on top.
  await expect(page.getByRole("button", { name: "Đưa “Hóa học” xuống" })).toBeEnabled(); // not saving any more
  const rows = page.getByRole("list", { name: "Thứ tự hôm nay" }).getByRole("listitem");
  await expect(rows.nth(0)).toHaveAccessibleName("Vật lí");
  await expect(rows.nth(1)).toHaveAccessibleName("Hóa học");
  // page.mouse does not scroll: bring both rows into the 720 px viewport first.
  await rows.nth(0).evaluate((el) => el.scrollIntoView({ block: "center" }));
  const from = await rows.nth(1).locator("[data-grip]").boundingBox();
  const to = await rows.nth(0).locator("[data-grip]").boundingBox();
  expect(from && to).toBeTruthy();
  await page.mouse.move((from?.x ?? 0) + (from?.width ?? 0) / 2, (from?.y ?? 0) + (from?.height ?? 0) / 2);
  await page.mouse.down();
  await page.mouse.move((to?.x ?? 0) + (to?.width ?? 0) / 2, (to?.y ?? 0) + (to?.height ?? 0) / 2, { steps: 8 });
  await page.mouse.up();
  await expect(rows.nth(0)).toHaveAccessibleName("Hóa học");
  await expect.poll(savedOrder).toEqual([keys[0], keys[1]]);
  await page.getByRole("navigation", { name: "Các mục của con" }).getByRole("link", { name: "Hôm nay" }).click();
  await expect(banner.getByText("Hóa học", { exact: true })).toBeVisible();

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
  await child.getByRole("navigation", { name: "Các mục của con" }).getByRole("link", { name: "Góc học tập" }).click();
  const row = child.getByRole("listitem", { name: "Mỹ thuật" });
  await row.getByRole("button").first().click(); // R6c: select the row; its buttons are in the work panel
  await child.getByRole("region", { name: "Khung làm bài" }).getByRole("button", { name: "Làm xong trong vở rồi · nộp ảnh" }).click();
  const sheet = child.getByRole("dialog", { name: "Nộp ảnh bài Mỹ thuật" });
  await sheet.getByRole("button", { name: "Không chụp được? Nhờ bố mẹ xem trực tiếp" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(row.getByText("Đang chờ bố mẹ xem…")).toBeVisible();
  await expect(child.getByRole("dialog", { name: /^Màn tập trung/ })).toHaveCount(0);
  await expect(child.getByRole("dialog", { name: /^Mục tiêu nhỏ/ })).toHaveCount(0);

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
  const evening = await ok.json();
  expect(evening.ok).toBe(true);
  // 07/11/2026: outside 20:00–23:00 Vietnam time nothing is sent, whoever calls (a late run never pings at night).
  if (!inEveningWindow(new Date())) expect(evening.skipped).toBe("outside_window");
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

// ---------------------------------------------------------------------------
// S3d — "Chế độ Tin tưởng" (the system suggests, the parent decides) and "Nhật ký"
// ---------------------------------------------------------------------------

test("S3d trust: suggestion -> 'Để sau'; parent switches to Tin tưởng and back; child cannot; Nhật ký lists it", async ({ page, browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, display_name").eq("role", "child").single();
  const childId = kid?.id ?? "";
  const name = kid?.display_name ?? "";
  const today = localDate(new Date());
  const { data: rules } = await db.from("family_settings").select("trust_up_weeks").single();
  const weeks = rules?.trust_up_weeks ?? 3;

  // Every day of the last complete weeks was "đạt" (both parts done in the morning, before bedtime; R1).
  const monday = weekStart(today);
  const rows = Array.from({ length: 7 * weeks }, (_, i) => {
    const date = addDays(monday, -(i + 1));
    return { child_id: childId, family_id: kid?.family_id, local_date: date, part1_done_at: new Date(`${date}T09:00:00+07:00`).toISOString(), part2_done_at: new Date(`${date}T10:00:00+07:00`).toISOString() };
  });
  const { error: seedError } = await db.from("day_sessions").upsert(rows, { onConflict: "child_id,local_date" });
  expect(seedError).toBeNull();
  await db.from("audit_log").delete().in("action", ["trust.set", "trust.dismissed"]);

  // Parent: the card suggests Tin tưởng; "Để sau" hides it for the week.
  await login(page, env.parentEmail, env.parentPassword);
  await page.goto("/parent");
  const card = page.getByRole("region", { name });
  const suggestion = card.getByRole("region", { name: "Gợi ý chế độ Tin tưởng" });
  await expect(suggestion).toContainText(`${name} đã đạt ${weeks}/${weeks} tuần liên tiếp`);
  await expect(suggestion).toContainText("mở mọi trang ngay cả khi chưa xong việc");
  await suggestion.getByRole("button", { name: "Để sau" }).click();
  await expect(suggestion).toBeHidden();
  await page.reload();
  await expect(card).toBeVisible();
  await expect(card.getByRole("region", { name: "Gợi ý chế độ Tin tưởng" })).toHaveCount(0);
  const { data: modeAfterLater } = await db.from("trust_state").select("mode").eq("child_id", childId).single();
  expect(modeAfterLater?.mode).toBe("lock"); // "Để sau" never switches anything

  // Parent: manual switch in Thêm › Các con, with a confirm step.
  await page.goto("/parent/children");
  await page.getByRole("listitem").filter({ hasText: name }).locator("summary").click();
  const box = page.getByRole("group", { name: `Chế độ của ${name}` });
  await expect(box).toContainText("Chế độ hiện tại: Khóa");
  await box.getByRole("button", { name: "Chuyển sang chế độ Tin tưởng…" }).click();
  await box.getByRole("button", { name: "Xác nhận: Tin tưởng" }).click();
  await expect(box.getByRole("status")).toContainText("Đã chuyển");
  const { data: trusted } = await db.from("trust_state").select("mode, updated_by").eq("child_id", childId).single();
  expect(trusted?.mode).toBe("trust");

  // Child: the day is OPEN_TRUST, the screen says so; nothing else changes.
  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await login(child, childEmail, childPassword);
  type S = { status: string; open: boolean; trust: { mode: string } };
  const state = async () => child.evaluate(async () => ((await (await fetch("/api/today")).json()) as { state: S }).state);
  let s = await state();
  expect(s.status).toBe("OPEN_TRUST");
  expect(s.open).toBe(true);
  expect(s.trust.mode).toBe("trust");
  await child.reload();
  await expect(child.getByText("Tin tưởng · mở mọi trang")).toBeVisible();
  await child.getByRole("navigation", { name: "Các mục của con" }).getByRole("link", { name: "Tập của tuần" }).click();
  await expect(child.getByText("Đang ở chế độ Tin tưởng")).toBeVisible();

  // Child: no write path — not the route, not the database.
  const viaApi = await child.evaluate(
    async (id) => (await fetch("/api/admin/trust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: id, mode: "lock" }) })).status,
    childId,
  );
  expect(viaApi).toBe(403);
  const direct = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await direct.auth.signInWithPassword({ email: childEmail, password: childPassword });
  const write = await direct.from("trust_state").update({ mode: "lock" }).eq("child_id", childId).select("child_id");
  expect(write.data ?? []).toHaveLength(0);
  const insert = await direct.from("trust_state").upsert({ child_id: childId, family_id: kid?.family_id, mode: "lock" });
  expect(insert.error).not.toBeNull();
  expect((await db.from("trust_state").select("mode").eq("child_id", childId).single()).data?.mode).toBe("trust");
  // A child cannot read the Nhật ký either.
  await child.goto("/parent/log");
  await expect(child).toHaveURL(/\/today$/);

  // Parent: back to Khóa.
  await page.reload();
  await page.getByRole("listitem").filter({ hasText: name }).locator("summary").click();
  await expect(box).toContainText("Chế độ hiện tại: Tin tưởng");
  await box.getByRole("button", { name: "Chuyển về chế độ Khóa…" }).click();
  await box.getByRole("button", { name: "Xác nhận: Khóa" }).click();
  await expect(box.getByRole("status")).toContainText("Đã chuyển");
  s = await state();
  expect(s.status).not.toBe("OPEN_TRUST");
  expect(s.trust.mode).toBe("lock");
  await childCtx.close();
  // Decided this week: no suggestion on the home card until Monday.
  await page.goto("/parent");
  await expect(card).toBeVisible();
  await expect(card.getByRole("region", { name: "Gợi ý chế độ Tin tưởng" })).toHaveCount(0);

  const { data: logs } = await db.from("audit_log").select("action, payload").in("action", ["trust.set", "trust.dismissed"]).order("created_at");
  expect(logs?.map((l) => [l.action, (l.payload as { mode?: string; previous?: string }).mode ?? null])).toEqual([
    ["trust.dismissed", null],
    ["trust.set", "trust"],
    ["trust.set", "lock"],
  ]);

  // Nhật ký (Thêm › Nhật ký): Vietnamese sentences, filters, never raw data.
  await page.goto("/parent/more");
  await page.getByRole("link", { name: /^Nhật ký/ }).click();
  await expect(page).toHaveURL(/\/parent\/log$/);
  await expect(page.getByText(`Chuyển ${name} sang chế độ Tin tưởng`, { exact: true })).toBeVisible();
  const body = (await page.locator("main").innerText()).toLowerCase();
  for (const raw of ["child_id", "payload", "token", "endpoint", "{", childId]) expect(body).not.toContain(raw);

  await page.getByLabel("Con", { exact: true }).selectOption({ label: name });
  await page.getByLabel("Nhóm", { exact: true }).selectOption({ label: "Tin tưởng" });
  await page.getByRole("button", { name: "Xem", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`con=${childId}.*nhom=trust`));
  const items = page.locator("main li");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText(`Chuyển ${name} về chế độ Khóa`);
  await expect(items.nth(1)).toContainText(`Chuyển ${name} sang chế độ Tin tưởng`);
  await expect(items.nth(2)).toContainText(`Để sau gợi ý chuyển ${name} sang chế độ Tin tưởng`);
  await expect(page.getByRole("link", { name: "Xem thêm" })).toHaveCount(0);

  // Another group: the S3c lock earlier in this run reads as a sentence too.
  await page.goto("/parent/log?nhom=lock");
  await expect(page.getByText(new RegExp(`^Khóa máy của ${name} đến`)).first()).toBeVisible();
  await expect(page.getByText(/^Đưa máy của .* về bình thường/).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// Góc bình yên S-BY0 (docs/BINH_YEN.md). Parent decision 07/11/2026: NO separate PIN and no idle
// lock — the child's own login opens the corner; the server still holds one visit per browser
// (study-time limit, R5). "Con muốn nói chuyện" → parent "Đã thấy".
// ---------------------------------------------------------------------------

function byPsql(sql: string): string {
  const dbUrl = process.env.E2E_DB_URL ?? "";
  expect(dbUrl, "E2E_DB_URL (local Supabase) is needed to age Góc bình yên rows").not.toBe("");
  return execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-qAt", "-c", sql], { encoding: "utf8" }).trim();
}

const byCall = (p: Page, method: string, url: string, body?: unknown) =>
  p.evaluate(
    async ([m, u, b]) => (await fetch(u as string, { method: m as string, headers: { "Content-Type": "application/json" }, body: b === undefined ? undefined : JSON.stringify(b) })).status,
    [method, url, body] as const,
  );

test("Góc bình yên: off by default; the child opens it WITHOUT a PIN; one server-held visit; no idle lock; parents and anon refused", async ({ page, browser, request }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, display_name").eq("role", "child").single();
  const childId = kid?.id as string;
  const openVisits = async () => (await db.from("by_sessions").select("id", { count: "exact", head: true }).eq("child_id", childId).is("ended_at", null)).count;

  // Off by default: friendly page, no visit is started, and the old PIN routes are gone.
  const kCtx = await browser.newContext();
  const k = await kCtx.newPage();
  await login(k, childEmail, childPassword);
  await k.goto("/binh-yen");
  await expect(k.getByRole("heading", { name: "Góc bình yên chưa mở." })).toBeVisible();
  const head = await k.request.get("/binh-yen");
  expect(head.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(head.headers()["content-security-policy"]).toContain("connect-src 'self'");
  const off = await k.evaluate(async () => (await (await fetch("/api/by/open", { method: "POST" })).json()) as { enabled: boolean; open: boolean });
  expect(off).toMatchObject({ enabled: false, open: false });
  expect(await openVisits()).toBe(0);
  expect(await byCall(k, "POST", "/api/by/pin/set", { pin: "593817", again: "593817" })).toBe(410);
  expect(await byCall(k, "POST", "/api/by/pin/verify", { pin: "593817" })).toBe(410);

  // Parents and strangers have no corner.
  await login(page, env.parentEmail, env.parentPassword);
  expect(await byCall(page, "POST", "/api/by/open")).toBe(403);
  expect(await byCall(page, "GET", "/api/by/state")).toBe(403);
  for (const url of ["/api/by/open", "/api/by/ping", "/api/by/checkins/delete"]) expect((await request.post(url, { data: {} })).status()).toBe(401);
  expect((await request.get("/api/by/checkins")).status()).toBe(401);

  // The parent turns it on in "Luật trong nhà": no "tự khóa" setting any more.
  await page.goto("/parent/settings");
  const box = page.getByRole("group", { name: "Góc bình yên" });
  await expect(box.getByLabel(/Tự khóa sau bao lâu/)).toHaveCount(0);
  await expect(box).toContainText("Không cần PIN riêng");
  await box.getByLabel("Bật Góc bình yên cho các con").check();
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu cài đặt");
  const { data: fs } = await db.from("family_settings").select("by_enabled").eq("family_id", kid?.family_id).single();
  expect(fs).toEqual({ by_enabled: true });

  // The child opens it: straight to the corner's home — no PIN screen, no password box.
  await k.goto("/binh-yen");
  const home = k.getByRole("region", { name: "Góc của con" });
  await expect(home.getByRole("heading", { name: /^Chào/ })).toBeVisible();
  await expect(k.locator("input[type=password]")).toHaveCount(0);
  await expect(k.getByRole("button", { name: "Khóa lại" })).toHaveCount(0);
  await home.getByText("🔒 Ai thấy gì?").click();
  const who = home.getByRole("listitem");
  await expect(who).toHaveCount(5);
  await expect(home.getByText(/hiện ở trang Hôm nay và Tuần trên máy con: ai đứng cạnh màn hình cũng thấy được/)).toBeVisible();
  await expect(home.getByText("Bố mẹ không có trang nào xem cảm xúc hay hoạt động con chọn ở đây.")).toBeVisible();
  await expect(home.getByText(/Ai đăng nhập bằng tài khoản của con cũng vào được góc này/)).toBeVisible();
  await expect(home.getByText(/lượt cũ hơn 12 tháng sẽ tự xóa/)).toBeVisible();
  await expect(home).not.toContainText("PIN");

  // One server-held visit; cookies httpOnly + Secure + SameSite=Strict, only for the corner's paths.
  await expect.poll(openVisits).toBe(1);
  const cookies = (await kCtx.cookies()).filter((c) => c.name.startsWith("sl_by"));
  expect(cookies.map((c) => [c.name, c.path, c.httpOnly, c.secure, c.sameSite]).sort()).toEqual([
    ["sl_by_api", "/api/by", true, true, "Strict"],
    ["sl_by_page", "/binh-yen", true, true, "Strict"],
  ]);
  const { data: first } = await db.from("by_sessions").select("id").eq("child_id", childId).is("ended_at", null).single();
  // A reload continues the same visit (the study-time limit cannot be reset by reloading).
  await k.reload();
  await expect(home).toBeVisible();
  const { data: same } = await db.from("by_sessions").select("id").eq("child_id", childId).is("ended_at", null).single();
  expect(same?.id).toBe(first?.id);
  // No one in the browser reads the visits.
  const asChild = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await asChild.auth.signInWithPassword({ email: childEmail, password: childPassword });
  expect((await asChild.from("by_sessions").select("id")).error).not.toBeNull();

  // No idle lock: away for 6 minutes (server clock) → the corner opens straight away, as a NEW visit.
  expect(byPsql(`with u as (update public.by_sessions set last_seen_at = now() - interval '6 minutes' where child_id = '${childId}' and ended_at is null returning 1) select count(*) from u`)).toBe("1");
  await k.reload();
  await expect(home).toBeVisible();
  await expect(k.locator("input[type=password]")).toHaveCount(0);
  await expect.poll(openVisits).toBe(1);
  const { data: second } = await db.from("by_sessions").select("id").eq("child_id", childId).is("ended_at", null).single();
  expect(second?.id).not.toBe(first?.id);
  const { data: old } = await db.from("by_sessions").select("ended_at").eq("id", first?.id as string).single();
  expect(old?.ended_at).not.toBeNull();
  // No trace of the child's visits in the audit log (D5).
  const { count: byLogs } = await db.from("audit_log").select("id", { count: "exact", head: true }).like("action", "%by%");
  expect(byLogs).toBe(0);

  // The parent has no "Xóa PIN Góc bình yên" any more (nor its route).
  await page.goto("/parent/children");
  const item = page.getByRole("listitem").filter({ hasText: kid?.display_name ?? "" });
  await item.getByText("Sửa").click();
  await expect(item.getByRole("button", { name: "Đặt lại mật khẩu" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Xóa PIN Góc bình yên/ })).toHaveCount(0);
  expect(await byCall(page, "POST", `/api/admin/children/${childId}/by-pin`, {})).not.toBe(200);
  await kCtx.close();
});

test("Con muốn nói chuyện: hidden without a parent phone; parent 'Đã thấy' reaches the child; siblings and direct writes refused; reminder after 10 minutes", async ({ page, browser, request }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, display_name").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const { data: parent } = await db.from("profiles").select("id").eq("role", "parent").limit(1).single();
  const parentId = parent?.id as string;
  await db.from("push_subscriptions").delete().eq("profile_id", parentId);

  // No parent phone with notifications → no button (the child is never told "đã báo" for nothing).
  const kCtx = await browser.newContext();
  const k = await kCtx.newPage();
  await login(k, childEmail, childPassword);
  await k.goto("/today");
  await expect(k.getByRole("navigation", { name: "Các mục của con" }).getByRole("link", { name: "Góc bình yên" })).toBeVisible(); // the corner is on (previous test)
  await expect(k.getByRole("button", { name: /Muốn nói chuyện|Đã gửi bố mẹ/ })).toHaveCount(0);
  expect(await byCall(k, "POST", "/api/by/signal", { kind: "want_talk", to: null })).toBe(409);

  // A parent phone turns notifications on → the button shows (on Hôm nay and in the corner).
  const endpoint = `https://push.example.invalid/by-${randomBytes(6).toString("hex")}`;
  expect((await db.from("push_subscriptions").insert({ profile_id: parentId, endpoint, p256dh: "B" + "A".repeat(86), auth: "A".repeat(22) })).error).toBeNull();
  await k.goto("/binh-yen");
  await expect(k.getByRole("region", { name: "Góc của con" })).toBeVisible();
  await expect(k.getByRole("region", { name: "Con muốn nói chuyện" })).toBeVisible();
  await k.goto("/today");
  await k.getByRole("button", { name: "💬 Muốn nói chuyện" }).click();
  const talk = k.getByRole("region", { name: "Con muốn nói chuyện" });
  expect(await byCall(k, "POST", "/api/by/signal", { kind: "needs_care", to: null })).toBe(400); // not a kind the child sends
  expect(await byCall(k, "POST", "/api/by/signal", { kind: "want_talk", to: null, note: "x" })).toBe(400); // no extra fields
  await talk.getByRole("button", { name: "💬 Con muốn nói chuyện" }).click();
  await expect(talk.getByRole("status")).toContainText("Đã gửi lúc");
  // The fake phone cannot be reached in CI: the child is told plainly what to do instead.
  await expect(talk.getByRole("status")).toContainText("Chưa báo được tới điện thoại của bố mẹ");
  await talk.getByRole("button", { name: "💬 Con muốn nói chuyện" }).click(); // within 2 minutes
  await expect(talk.getByRole("status")).toContainText("Con vừa gửi rồi");
  const { data: rows } = await db.from("by_signals").select("id, kind, to_parent_id, seen_at").eq("child_id", childId);
  expect(rows).toHaveLength(1);
  expect(rows?.[0]).toMatchObject({ kind: "want_talk", to_parent_id: null, seen_at: null });
  const signalId = rows?.[0]?.id as string;

  // Directly against the database: the child reads only their own, and cannot write.
  const asChild = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await asChild.auth.signInWithPassword({ email: childEmail, password: childPassword });
  expect((await asChild.from("by_signals").select("id")).data).toHaveLength(1);
  expect((await asChild.from("by_signals").insert({ family_id: familyId, child_id: childId, kind: "want_talk" })).error).not.toBeNull();
  const childSeen = await asChild.from("by_signals").update({ seen_at: new Date().toISOString(), seen_by: childId }).eq("id", signalId).select("id");
  expect(childSeen.data ?? []).toHaveLength(0);

  // A sibling sees nothing of it (neither in the database nor through the app).
  const sibEmail = `sibling-${randomBytes(4).toString("hex")}@example.com`;
  const sibPassword = `Sib-${randomBytes(12).toString("hex")}`;
  const { data: sibUser, error: sibErr } = await db.auth.admin.createUser({ email: sibEmail, password: sibPassword, email_confirm: true });
  expect(sibErr).toBeNull();
  const sibId = sibUser.user?.id as string;
  try {
    expect((await db.from("profiles").insert({ id: sibId, family_id: familyId, role: "child", display_name: "Em thử", grade: 6 })).error).toBeNull();
    const asSib = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    await asSib.auth.signInWithPassword({ email: sibEmail, password: sibPassword });
    expect((await asSib.from("by_signals").select("id")).data).toHaveLength(0);
    const sCtx = await browser.newContext();
    const s = await sCtx.newPage();
    await login(s, sibEmail, sibPassword);
    const sib = await s.evaluate(async () => (await (await fetch("/api/by/signal")).json()) as { status: unknown });
    expect(sib.status).toBeNull();
    await sCtx.close();
  } finally {
    await db.auth.admin.deleteUser(sibId);
  }

  // The parent: a banner on every page → "Con muốn nói chuyện" → "Đã thấy" in their own name.
  await login(page, env.parentEmail, env.parentPassword);
  expect(await byCall(page, "POST", "/api/by/signal", { kind: "want_talk", to: null })).toBe(403);
  await page.goto("/parent/more");
  await page.getByRole("link", { name: /Con muốn nói chuyện với bố mẹ/ }).click();
  await expect(page).toHaveURL(/\/parent\/talk$/);
  const card = page.getByRole("article", { name: `${kid?.display_name} muốn nói chuyện` });
  await expect(card).toContainText("gửi cho cả bố và mẹ");
  const asParent = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await asParent.auth.signInWithPassword({ email: env.parentEmail, password: env.parentPassword });
  const inOtherName = await asParent.from("by_signals").update({ seen_at: new Date().toISOString(), seen_by: childId }).eq("id", signalId).select("id");
  expect(inOtherName.error).not.toBeNull();
  expect((await asParent.from("by_signals").update({ kind: "x" }).eq("id", signalId)).error).not.toBeNull();
  expect((await asParent.from("by_signals").delete().eq("id", signalId)).error).not.toBeNull();
  expect((await asParent.from("by_sessions").select("id")).error).not.toBeNull();
  expect((await asParent.from("profiles").select("by_pin_hash")).error).not.toBeNull();
  await card.getByRole("button", { name: "Đã thấy" }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByText(/Bạn đã thấy lúc/)).toBeVisible();
  const { data: seen } = await db.from("by_signals").select("seen_at, seen_by").eq("id", signalId).single();
  expect(seen?.seen_by).toBe(parentId);
  await expect(page.getByRole("link", { name: /Con muốn nói chuyện với bố mẹ/ })).toHaveCount(0);

  // The child sees it was seen.
  await k.reload();
  await k.getByRole("button", { name: "💬 Muốn nói chuyện" }).click();
  await expect(talk.getByRole("status")).toContainText("Bố/mẹ đã thấy lúc");

  // 10 minutes and nobody saw it. Parent decision 05/11/2026: "Con muốn nói chuyện" is NOT
  // re-pushed; the child is told to find a parent in person. The cron still needs the secret.
  await k.goto("about:blank");
  await db.from("by_signals").update({ seen_at: null, seen_by: null, created_at: new Date(Date.now() - 11 * 60_000).toISOString() }).eq("id", signalId);
  expect((await request.get("/api/cron/by-escalate")).status()).toBe(401);
  expect((await request.get("/api/cron/by-escalate", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
  const auth = { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` };
  const first = await request.get("/api/cron/by-escalate", { headers: auth });
  expect(first.status()).toBe(200);
  expect((await first.json()).escalated).toBe(0);
  const { data: esc } = await db.from("by_signals").select("escalated_at").eq("id", signalId).single();
  expect(esc?.escalated_at).toBeNull();
  await k.goto("/today");
  await k.getByRole("button", { name: /Đã gửi bố mẹ/ }).click();
  await expect(talk.getByRole("status")).toContainText("Bố mẹ chưa thấy tin. Con tìm bố mẹ trực tiếp để nói chuyện nhé.");

  // Góc bình yên turned off: the corner hides, "Con muốn nói chuyện" stays.
  await db.from("family_settings").update({ by_enabled: false }).eq("family_id", familyId);
  await k.goto("/binh-yen");
  await expect(k.getByRole("heading", { name: "Góc bình yên chưa mở." })).toBeVisible();
  await expect(k.getByRole("region", { name: "Con muốn nói chuyện" })).toBeVisible();
  await k.goto("/today");
  await expect(k.getByRole("button", { name: /Muốn nói chuyện|Đã gửi bố mẹ/ })).toBeVisible();
  await expect(k.getByRole("navigation", { name: "Các mục của con" }).getByRole("link", { name: "Góc bình yên" })).toHaveCount(0);
  await kCtx.close();
  await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
});

// ---------------------------------------------------------------------------
// Góc bình yên S-BY1 (docs/BINH_YEN.md §4, R1, R5, D1, Q6, Q7): one visit stores keys only, once;
// the child deletes; nobody else can read; in study time each visit lasts by_study_minutes.
// ---------------------------------------------------------------------------

test("Góc bình yên S-BY1: red → lo lắng → 5 → 'Nhắn bố mẹ' first; breathing → Xong stores keys only, once; child deletes; nobody else reads; study-time limit", async ({ page, browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, display_name").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const today = localDate(new Date());
  await db.from("family_settings").update({ by_enabled: true, by_study_minutes: 10 }).eq("family_id", familyId);

  // Study time (LOCK_P1): one homework due today, a normal day, lock mode, no parent override.
  await db.from("overrides").delete().eq("child_id", childId).eq("local_date", today);
  await db.from("trust_state").update({ mode: "lock" }).eq("child_id", childId);
  await db.from("day_sessions").upsert({ child_id: childId, family_id: familyId, local_date: today }, { onConflict: "child_id,local_date", ignoreDuplicates: true });
  await db
    .from("day_sessions")
    .update({ day_type: "normal", disabled_template_ids: [], part1_done_at: null, part2_done_at: null, free_started_at: null, pass_used_at: null, break_started_at: null, break_ended_at: null, break_skipped: false })
    .eq("child_id", childId)
    .eq("local_date", today);
  const { data: hw } = await db.from("homework_items").insert({ family_id: familyId, child_id: childId, subject: "Toán", due_date: today, note: "BY1" }).select("id").single();
  // Sessions left open by the earlier tests' closed browsers: end them, so only this visit counts.
  await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", childId).is("ended_at", null);

  const kCtx = await browser.newContext();
  const k = await kCtx.newPage();
  await login(k, childEmail, childPassword);
  expect((await (await k.request.get("/api/today")).json()).state.status).toBe("LOCK_P1");

  await k.goto("/binh-yen"); // no PIN (07/11/2026): straight in
  const home = k.getByRole("region", { name: "Góc của con" });
  const firstName = (kid?.display_name ?? "").trim().split(/\s+/).pop() ?? "";
  await expect(home.getByRole("heading", { name: `Chào ${firstName}.`, exact: true })).toBeVisible(); // lớp 9 → the detective voice
  await expect(home.getByRole("status")).toContainText("Giờ học: mỗi lần tối đa 10 phút");
  await expect(k.getByRole("region", { name: "Lần ghé gần đây" })).toContainText("Chưa có lần nào");

  // Một lượt: Hồ sơ đỏ → lo lắng (with its meaning) → "Ổn thôi, mình ở đây" → mức 5.
  await home.getByRole("button", { name: /^Hồ sơ đỏ/ }).click();
  const words = k.getByRole("region", { name: "Chọn từ" });
  await words.getByRole("button", { name: "lo lắng" }).click();
  await expect(words).toContainText("Đầu nghĩ mãi về điều có thể xảy ra.");
  await words.getByRole("button", { name: "Tiếp →" }).click();
  const ack = k.getByRole("region", { name: "Công nhận" });
  await expect(ack.getByRole("heading", { name: "Ổn thôi, mình ở đây" })).toBeVisible();
  await ack.getByRole("group", { name: "Mức độ" }).getByRole("button", { name: /^5/ }).click();
  await ack.getByRole("button", { name: "Làm dịu một chút →" }).click();

  // R1: unpleasant + 5 → "Nhắn bố mẹ" first. No text box anywhere (D1, S-BY1).
  const ideas = k.getByRole("region", { name: "Gợi ý cho con" }).getByRole("list", { name: "3 gợi ý" }).getByRole("button");
  await expect(ideas).toHaveCount(3);
  await expect(ideas.first()).toContainText("Nhắn bố mẹ");
  await expect(k.locator("main textarea, main input:not([type]), main input[type=text]")).toHaveCount(0);
  // "Nhắn bố mẹ" shows the talk card inside the visit (no parent phone here → find them in person); one card only.
  await ideas.first().click();
  const talkAct = k.getByRole("region", { name: "Nhắn bố mẹ" });
  await expect(talkAct.getByRole("region", { name: "Cần bố mẹ?" })).toContainText("Con tìm bố mẹ trực tiếp");
  await expect(k.getByRole("region", { name: "Cần bố mẹ?" })).toHaveCount(1);
  await talkAct.getByRole("button", { name: "← Gợi ý khác" }).click();

  // Breathing → Xong → one row with keys only.
  await ideas.filter({ hasText: "Thở cho dịu lại" }).click();
  const act = k.getByRole("region", { name: "Thở cho dịu lại" });
  await act.getByRole("button", { name: "Xong", exact: true }).click();
  await expect(k.getByRole("region", { name: "Xong rồi" }).getByRole("status")).toContainText("Đầu đã nguội bớt");
  const { data: rows } = await db.from("by_checkins").select("*").eq("child_id", childId);
  expect(rows).toHaveLength(1);
  expect(rows?.[0]).toMatchObject({ family_id: familyId, local_date: today, quad: "red", word_key: "lo_lang", intensity: 5, activity_key: "breath", cause_key: null, understood_at: null });
  expect(byPsql("select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'by_checkins'")).toBe(
    "activity_key,cause_key,child_id,client_run_id,created_at,family_id,id,intensity,local_date,quad,understood_at,word_key",
  );

  // Two "Xong" with the same client_run_id → one row; free text and wrong keys are refused before the database.
  const run = randomUUID();
  const twice = await k.evaluate(async (id) => {
    const send = () => fetch("/api/by/checkins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientRunId: id, quad: "yellow", word: "vui", intensity: null, activity: "share" }) }).then(async (r) => [r.status, (await r.json()).repeated]);
    return [await send(), await send()];
  }, run);
  expect(twice).toEqual([
    [200, false],
    [200, true],
  ]);
  const { count: once } = await db.from("by_checkins").select("id", { count: "exact", head: true }).eq("client_run_id", run);
  expect(once).toBe(1);
  expect(await byCall(k, "POST", "/api/by/checkins", { clientRunId: randomUUID(), quad: "red", word: "con buồn lắm", intensity: 3, activity: null })).toBe(400);
  expect(await byCall(k, "POST", "/api/by/checkins", { clientRunId: randomUUID(), quad: "red", word: "lo_lang", intensity: 3, activity: null, note: "x" })).toBe(400);
  expect(await byCall(k, "POST", "/api/by/checkins", { clientRunId: randomUUID(), quad: "red", word: "lo_lang", intensity: 3, activity: "heart" })).toBe(400); // An's activity
  const { count: logs } = await db.from("audit_log").select("id", { count: "exact", head: true }).like("action", "%checkin%");
  expect(logs).toBe(0); // D5

  // Nobody else reads it: not the child's own browser login, not the parent, not a sibling, not the API without a visit.
  const asChild = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await asChild.auth.signInWithPassword({ email: childEmail, password: childPassword });
  expect((await asChild.from("by_checkins").select("id")).error).not.toBeNull();
  expect((await asChild.from("by_checkins").insert({ family_id: familyId, child_id: childId, local_date: today, quad: "red", word_key: "lo_lang", client_run_id: randomUUID() })).error).not.toBeNull();
  const asParent = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await asParent.auth.signInWithPassword({ email: env.parentEmail, password: env.parentPassword });
  expect((await asParent.from("by_checkins").select("id")).error).not.toBeNull();
  expect((await asParent.from("by_checkins").delete().eq("child_id", childId)).error).not.toBeNull();
  await login(page, env.parentEmail, env.parentPassword);
  expect(await byCall(page, "GET", "/api/by/checkins")).toBe(403);
  // R2: the feelings reach the child's Hôm nay / Tuần through a child-only route; they are never
  // part of /api/today (parent pages reuse that data) and never on a parent page.
  expect(await byCall(page, "GET", "/api/week/days")).toBe(403);
  await page.goto("/parent");
  await expect(page.locator("body")).not.toContainText("lo lắng");
  const childToday = await k.evaluate(async () => (await fetch("/api/today")).text());
  expect(childToday).not.toContain("lo_lang");
  expect(childToday).not.toContain('"quad"');
  const childWeek = await k.evaluate(async () => (await (await fetch("/api/week/days")).json()) as { byEnabled: boolean; today: string; days: { date: string; feel: { word: string } | null }[] });
  expect(childWeek.byEnabled).toBe(true);
  expect(childWeek.days.find((d) => d.date === childWeek.today)?.feel).not.toBeNull();
  const sibEmail = `sibling-${randomBytes(4).toString("hex")}@example.com`;
  const sibPassword = `Sib-${randomBytes(12).toString("hex")}`;
  const { data: sibUser } = await db.auth.admin.createUser({ email: sibEmail, password: sibPassword, email_confirm: true });
  const sibId = sibUser.user?.id as string;
  try {
    expect((await db.from("profiles").insert({ id: sibId, family_id: familyId, role: "child", display_name: "Em thử", grade: 6 })).error).toBeNull();
    const asSib = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    await asSib.auth.signInWithPassword({ email: sibEmail, password: sibPassword });
    expect((await asSib.from("by_checkins").select("id")).error).not.toBeNull();
    const sCtx = await browser.newContext();
    const s = await sCtx.newPage();
    await login(s, sibEmail, sibPassword);
    expect(await byCall(s, "GET", "/api/by/checkins")).toBe(401); // no Góc bình yên visit of their own (they never opened it)
    expect(await byCall(s, "POST", "/api/by/checkins/delete", { all: true })).toBe(401);
    await sCtx.close();
  } finally {
    await db.auth.admin.deleteUser(sibId);
  }

  // The child deletes the breathing visit (a real delete, Q7); the other one stays.
  await k.getByRole("region", { name: "Xong rồi" }).getByRole("button", { name: "Về góc của con" }).click();
  const recent = k.getByRole("region", { name: "Lần ghé gần đây" });
  await expect(recent.getByRole("listitem")).toHaveCount(2);
  await expect(recent).toContainText(/lo lắng · \S* ?Thở cho dịu lại/);
  await recent.getByRole("button", { name: /^Xóa lượt .* lo lắng$/ }).click();
  await expect(recent.getByRole("listitem")).toHaveCount(1);
  const { data: left } = await db.from("by_checkins").select("word_key").eq("child_id", childId);
  expect(left).toEqual([{ word_key: "vui" }]);

  // R5: in study time a visit lasts 10 minutes (server clock). Age it → back to Hôm nay.
  expect(byPsql(`with u as (update public.by_sessions set started_at = now() - interval '11 minutes' where child_id = '${childId}' and ended_at is null returning 1) select count(*) from u`)).toBe("1");
  await k.goto("/binh-yen");
  await expect(k.getByRole("heading", { name: "Quay lại học nhé, lúc nào cần thì vào lại." })).toBeVisible();
  await k.waitForURL(/\/today$/);
  const { count: open } = await db.from("by_sessions").select("id", { count: "exact", head: true }).eq("child_id", childId).is("ended_at", null);
  expect(open).toBe(0);
  expect(await byCall(k, "POST", "/api/by/checkins", { clientRunId: randomUUID(), quad: "yellow", word: "vui", intensity: null, activity: null })).toBe(401);

  // Q6: back in at once — a NEW visit, no PIN. Outside study time (free time) there is no limit.
  await db.from("day_sessions").update({ free_started_at: new Date().toISOString() }).eq("child_id", childId).eq("local_date", today);
  await k.goto("/binh-yen");
  await expect(home).toBeVisible();
  await expect(home.getByText(/Giờ học: mỗi lần tối đa/)).toHaveCount(0);
  expect(byPsql(`with u as (update public.by_sessions set started_at = now() - interval '11 minutes' where child_id = '${childId}' and ended_at is null returning 1) select count(*) from u`)).toBe("1");
  await k.reload();
  await expect(home).toBeVisible();

  // "Xóa hết của con": not in "Lần ghé gần đây" any more; folded in "Dữ liệu của con", needs XÓA typed.
  await expect(recent.getByRole("button", { name: "Xóa hết của con" })).toHaveCount(0);
  const data = k.locator("details", { hasText: "Dữ liệu của con" });
  const wipeAll = data.getByRole("button", { name: "Xóa hết của con" });
  await expect(wipeAll).toBeHidden(); // folded
  await data.getByText("Dữ liệu của con", { exact: true }).click();
  await expect(wipeAll).toBeDisabled();
  const confirmBox = data.getByLabel("Gõ XÓA để xác nhận");
  await confirmBox.fill("xoa");
  await expect(wipeAll).toBeDisabled();
  await confirmBox.fill(" xóa ");
  await expect(wipeAll).toBeEnabled();
  await wipeAll.click();
  await expect(recent).toContainText("Chưa có lần nào");
  const { count: none } = await db.from("by_checkins").select("id", { count: "exact", head: true }).eq("child_id", childId);
  expect(none).toBe(0);

  await kCtx.close();
  await db.from("homework_items").update({ archived_at: new Date().toISOString() }).eq("id", hw?.id as string);
});

// ---------------------------------------------------------------------------
// Góp ý (parent decision 07/11/2026): the children's feedback about the app. Not private —
// parents read it on Thêm › Góp ý của con. Inserts only through POST /api/feedback.
// ---------------------------------------------------------------------------

test("Góp ý: the child sends from the Góp ý tab (told parents read it); limits; no direct writes; sibling and other roles refused; parent reads and marks Đã đọc", async ({ page, browser, request }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, display_name").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  await db.from("app_feedback").delete().eq("family_id", familyId);

  const kCtx = await browser.newContext();
  const k = await kCtx.newPage();
  await login(k, childEmail, childPassword);
  await k.goto("/today");
  // R2: Góp ý is a tab of the child's screen.
  await k.getByRole("navigation", { name: "Các mục của con" }).getByRole("link", { name: "Góp ý" }).click();
  await expect(k).toHaveURL(/\/today\?tab=gop-y$/);
  const sheet = k.getByRole("region", { name: "Góp ý cho app" });
  await expect(sheet).toContainText("Bố mẹ sẽ đọc góp ý này.");
  const send = sheet.getByRole("button", { name: "Gửi", exact: true });
  await expect(send).toBeDisabled();
  await sheet.getByText("💡 Ý tưởng").click();
  await sheet.getByLabel("Con muốn nói gì về app?").fill("  Cho con chọn màu nền tối  ");
  await send.click();
  await expect(sheet.getByRole("status")).toContainText("Đã gửi. Cảm ơn con!");
  const { data: rows } = await db.from("app_feedback").select("family_id, child_id, kind, body, seen_at").eq("child_id", childId);
  expect(rows).toEqual([{ family_id: familyId, child_id: childId, kind: "idea", body: "Cho con chọn màu nền tối", seen_at: null }]);

  // The server checks everything; the family and the child always come from the session.
  expect(await byCall(k, "POST", "/api/feedback", { kind: "angry", body: "x" })).toBe(400);
  expect(await byCall(k, "POST", "/api/feedback", { kind: "like", body: "   " })).toBe(400);
  expect(await byCall(k, "POST", "/api/feedback", { kind: "like", body: "x".repeat(501) })).toBe(400);
  expect(await byCall(k, "POST", "/api/feedback", { kind: "like", body: "x", child_id: randomUUID() })).toBe(400);
  expect((await request.post("/api/feedback", { data: { kind: "like", body: "x" } })).status()).toBe(401);
  // At most 10 per child per day: 9 more today → the 11th is refused.
  expect((await db.from("app_feedback").insert(Array.from({ length: 9 }, (_, n) => ({ family_id: familyId, child_id: childId, kind: "like", body: `seed ${n}` })))).error).toBeNull();
  const limited = await k.evaluate(async () => {
    const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "like", body: "một nữa" }) });
    return [r.status, ((await r.json()) as { error: string }).error];
  });
  expect(limited).toEqual([429, "Hôm nay con đã gửi 10 góp ý rồi. Mai gửi tiếp nhé."]);
  await db.from("app_feedback").delete().eq("child_id", childId).like("body", "seed %");

  // Straight to the database: the child reads only their own and cannot write.
  const asChild = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await asChild.auth.signInWithPassword({ email: childEmail, password: childPassword });
  expect((await asChild.from("app_feedback").select("id")).data).toHaveLength(1);
  expect((await asChild.from("app_feedback").insert({ family_id: familyId, child_id: childId, kind: "like", body: "x" })).error).not.toBeNull();
  expect((await asChild.from("app_feedback").update({ body: "đổi" }).eq("child_id", childId)).error).not.toBeNull();
  const childRead = await asChild.from("app_feedback").update({ seen_at: new Date().toISOString() }).eq("child_id", childId).select("id");
  expect(childRead.data ?? []).toHaveLength(0);

  // A sibling sees none of it.
  const sibEmail = `sibling-${randomBytes(4).toString("hex")}@example.com`;
  const sibPassword = `Sib-${randomBytes(12).toString("hex")}`;
  const { data: sibUser } = await db.auth.admin.createUser({ email: sibEmail, password: sibPassword, email_confirm: true });
  const sibId = sibUser.user?.id as string;
  try {
    expect((await db.from("profiles").insert({ id: sibId, family_id: familyId, role: "child", display_name: "Em thử", grade: 6 })).error).toBeNull();
    const asSib = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    await asSib.auth.signInWithPassword({ email: sibEmail, password: sibPassword });
    expect((await asSib.from("app_feedback").select("id")).data).toHaveLength(0);
  } finally {
    await db.auth.admin.deleteUser(sibId);
  }

  // Inside Góc bình yên the link says plainly that this is NOT private like the corner.
  await db.from("family_settings").update({ by_enabled: true }).eq("family_id", familyId);
  await k.goto("/binh-yen");
  await expect(k.getByRole("region", { name: "Góc của con" })).toBeVisible();
  await expect(k.getByText("Góp ý không riêng tư như góc này: bố mẹ sẽ đọc.")).toBeVisible();
  await k.getByRole("button", { name: "Góp ý cho app" }).click();
  await expect(k.getByRole("dialog", { name: "Góp ý cho app" })).toContainText("Khác với Góc bình yên, góp ý không phải chuyện riêng");
  await kCtx.close();

  // The parent: cannot send; unread count on Thêm; reads; "Đã đọc" sets seen_at only.
  await login(page, env.parentEmail, env.parentPassword);
  expect(await byCall(page, "POST", "/api/feedback", { kind: "like", body: "x" })).toBe(403);
  const asParent = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
  await asParent.auth.signInWithPassword({ email: env.parentEmail, password: env.parentPassword });
  expect((await asParent.from("app_feedback").select("id")).data).toHaveLength(1);
  expect((await asParent.from("app_feedback").update({ body: "đổi" }).eq("child_id", childId)).error).not.toBeNull();
  expect((await asParent.from("app_feedback").insert({ family_id: familyId, child_id: childId, kind: "like", body: "x" })).error).not.toBeNull();
  await page.goto("/parent/more");
  const row = page.getByRole("link", { name: /Góp ý của con/ });
  await expect(row).toContainText("1 chưa đọc");
  await row.click();
  await expect(page).toHaveURL(/\/parent\/feedback$/);
  const card = page.getByRole("article", { name: `Góp ý của ${kid?.display_name}` });
  await expect(card).toContainText("💡 Ý tưởng");
  await expect(card).toContainText("Cho con chọn màu nền tối");
  await expect(card).toContainText("Mới");
  await card.getByRole("button", { name: "Đã đọc" }).click();
  await expect(card).toContainText("Đã đọc lúc");
  const { data: seen } = await db.from("app_feedback").select("seen_at, body").eq("child_id", childId).single();
  expect(seen?.seen_at).not.toBeNull();
  expect(seen?.body).toBe("Cho con chọn màu nền tối");
  await page.goto("/parent/more");
  await expect(page.getByRole("link", { name: /Góp ý của con/ })).not.toContainText("chưa đọc");
});

test("R3a nhân vật: the child makes a character (codes only); bad codes refused; parent and anon refused; no direct writes; emoji beside words", async ({ page, browser, request }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const grade = kid?.grade as number | null;
  // Nguyên's voice (lớp 9): the quadrants show her character.
  await db.from("profiles").update({ grade: 9, avatar: null }).eq("id", childId);
  await db.from("family_settings").update({ by_enabled: true }).eq("family_id", familyId);
  try {
    const kCtx = await browser.newContext();
    const k = await kCtx.newPage();
    await login(k, childEmail, childPassword);
    await k.goto("/binh-yen");
    const corner = k.getByRole("region", { name: "Góc của con" });
    await expect(corner).toBeVisible();
    await corner.getByRole("link", { name: "Hình tạm — chạm để tạo nhân vật của con" }).click();
    await expect(k).toHaveURL(/\/nhan-vat\?tu=binh-yen$/);
    await expect(k.getByText("Đang là hình tạm.")).toBeVisible();
    await k.getByRole("group", { name: "Kiểu tóc" }).getByRole("button", { name: "Đuôi ngựa" }).click();
    await k.getByRole("group", { name: /^Màu tóc/ }).getByRole("button", { name: "Tím" }).click();
    await k.getByRole("group", { name: "Phụ kiện" }).getByRole("button", { name: "Tai nghe" }).click();
    await k.getByLabel("Tên nhân vật (không bắt buộc)").fill("  Mèo   Thám Tử ");
    await k.getByRole("button", { name: "Lưu nhân vật" }).click();
    await expect(k.getByRole("status")).toContainText("Đã lưu nhân vật của con.");
    const { data: saved } = await db.from("profiles").select("avatar").eq("id", childId).single();
    expect(saved?.avatar).toEqual({ style: "ponytail", hair: "tim", eye: "nau", skin: "sang", outfit: "nau", acc: "phones", name: "Mèo Thám Tử" });

    // The server takes known codes only; the child is always the session's.
    const good = { style: "short", hair: "nau", eye: "nau", skin: "vua", outfit: "do", acc: "none", name: "" };
    expect(await byCall(k, "POST", "/api/profile/avatar", { avatar: { ...good, hair: "xanhneon" } })).toBe(400);
    expect(await byCall(k, "POST", "/api/profile/avatar", { avatar: { ...good, photo: "https://x" } })).toBe(400);
    expect(await byCall(k, "POST", "/api/profile/avatar", { avatar: { ...good, name: "x".repeat(25) } })).toBe(400);
    expect(await byCall(k, "POST", "/api/profile/avatar", {})).toBe(400);
    expect((await request.post("/api/profile/avatar", { data: { avatar: good } })).status()).toBe(401);
    expect((await db.from("profiles").select("avatar").eq("id", childId).single()).data?.avatar).toMatchObject({ style: "ponytail" });

    // Straight to the database: the child reads it but cannot write it.
    const asChild = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    await asChild.auth.signInWithPassword({ email: childEmail, password: childPassword });
    expect((await asChild.from("profiles").select("avatar").eq("id", childId).single()).data?.avatar).toMatchObject({ name: "Mèo Thám Tử" });
    expect((await asChild.from("profiles").update({ avatar: good }).eq("id", childId)).error).not.toBeNull();

    // Back in the corner: her character, no "Hình tạm" line; emoji sit beside the words.
    await k.getByRole("link", { name: "‹ Góc bình yên" }).click();
    await expect(corner.getByRole("link", { name: "Đổi nhân vật của con" })).toBeVisible();
    await expect(corner.getByText("Hình tạm — chạm để tạo nhân vật của con")).toHaveCount(0);
    await corner.getByRole("button", { name: /^Hồ sơ đỏ/ }).click();
    await expect(k.getByRole("button", { name: "lo lắng", exact: true })).toContainText("😟");

    // "Về hình tạm" clears it.
    await k.goto("/nhan-vat");
    await k.getByRole("button", { name: "Về hình tạm" }).click();
    await expect(k.getByRole("status")).toContainText("Đã về hình tạm.");
    expect((await db.from("profiles").select("avatar").eq("id", childId).single()).data?.avatar).toBeNull();
    await kCtx.close();

    // A parent cannot save a character for the child.
    await login(page, env.parentEmail, env.parentPassword);
    expect(await byCall(page, "POST", "/api/profile/avatar", { avatar: good })).toBe(403);
    const asParent = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    await asParent.auth.signInWithPassword({ email: env.parentEmail, password: env.parentPassword });
    expect((await asParent.from("profiles").update({ avatar: good }).eq("id", childId)).error).not.toBeNull();
  } finally {
    await db.from("profiles").update({ grade, avatar: null }).eq("id", childId);
  }
});

test("R3b Picrew: the child puts pictures on faces (shrunk, checked); family sees them; replace/remove deletes files; parent removes all; no direct writes", async ({ page, browser, request }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade, display_name").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const grade = kid?.grade as number | null;
  const folder = `${familyId}/${childId}`;
  const files = async () => ((await db.storage.from("avatars").list(folder)).data ?? []).map((o) => `${folder}/${o.name}`).sort();
  const pics = async () => (await db.from("profiles").select("avatar_pics").eq("id", childId).single()).data?.avatar_pics as Record<string, string> | null;
  await db.from("profiles").update({ grade: 9, avatar: null, avatar_pics: null }).eq("id", childId);
  await db.from("family_settings").update({ by_enabled: true }).eq("family_id", familyId);
  try {
    const kCtx = await browser.newContext();
    const k = await kCtx.newPage();
    await login(k, childEmail, childPassword);
    await k.goto("/nhan-vat");
    const box = k.getByRole("region", { name: "Ảnh từ Picrew" });
    await expect(box).toContainText("Chỉ hình vẽ, không dùng ảnh chụp con.");
    await box.getByLabel("Chọn ảnh khi bình yên").setInputFiles({ name: "picrew.png", mimeType: "image/png", buffer: makePng(1200, 1200) });
    await expect(box.getByRole("status")).toContainText("Đã thêm ảnh khi bình yên.");
    const first = (await pics())?.calm as string;
    expect(first).toMatch(new RegExp(`^${folder}/[0-9a-f-]{36}\\.(png|jpg)$`));
    expect(await files()).toEqual([first]);
    // The browser redrew it: longest side 800 px at most.
    const blob = (await db.storage.from("avatars").download(first)).data as Blob;
    const head = Buffer.from(await blob.arrayBuffer());
    if (first.endsWith(".png")) expect(head.readUInt32BE(16)).toBeLessThanOrEqual(800);
    await expect(k.getByText("Đang dùng ảnh Picrew của con.")).toBeVisible();

    // Served from our own address to the family; never to anyone else.
    const served = await k.evaluate(async (u) => {
      const r = await fetch(u);
      return [r.status, r.headers.get("content-type"), r.headers.get("x-content-type-options")];
    }, `/api/files/avatar?path=${encodeURIComponent(first)}`);
    expect(served).toEqual([200, first.endsWith(".png") ? "image/png" : "image/jpeg", "nosniff"]);
    expect((await request.get(`/api/files/avatar?path=${encodeURIComponent(first)}`)).status()).toBe(401);
    expect(await byCall(k, "GET", `/api/files/avatar?path=${encodeURIComponent(`${randomUUID()}/${childId}/${randomUUID()}.png`)}`)).toBe(404);

    // The server checks again: type by its first bytes, size, the face.
    const sendRaw = (slot: string, bytes: number[] | string, type: string) =>
      k.evaluate(
        async ([s, b, t]) => {
          const form = new FormData();
          form.set("slot", s as string);
          form.set("file", new Blob([typeof b === "string" ? b : new Uint8Array(b as number[])], { type: t as string }), "x.png");
          return (await fetch("/api/profile/avatar/pics", { method: "POST", body: form })).status;
        },
        [slot, bytes, type] as const,
      );
    expect(await sendRaw("sad", "<svg onload=alert(1)>", "image/png")).toBe(400);
    expect(await sendRaw("photo", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png")).toBe(400);
    expect(await sendRaw("sad", "x".repeat(1_100_000), "image/png")).toBe(413);
    expect((await request.post("/api/profile/avatar/pics", { multipart: { slot: "sad", file: { name: "a.png", mimeType: "image/png", buffer: makePng(10, 10) } } })).status()).toBe(401);
    expect(await byCall(k, "POST", "/api/profile/avatar/pics/delete", { slot: "photo" })).toBe(400);
    expect(await byCall(k, "POST", "/api/admin/children/" + childId + "/avatar-pics", {})).toBe(403);

    // Straight to storage / the database: refused.
    const asChild = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    await asChild.auth.signInWithPassword({ email: childEmail, password: childPassword });
    expect((await asChild.storage.from("avatars").upload(`${folder}/${randomUUID()}.png`, makePng(10, 10), { contentType: "image/png" })).error).not.toBeNull();
    expect((await asChild.from("profiles").update({ avatar_pics: {} }).eq("id", childId)).error).not.toBeNull();

    // A second face, then a new picture on the first face: the old file is deleted.
    await box.getByLabel("Chọn ảnh khi buồn").setInputFiles({ name: "buon.png", mimeType: "image/png", buffer: makePng(600, 600) });
    await expect(box.getByRole("status")).toContainText("Đã thêm ảnh khi buồn.");
    await box.getByLabel("Đổi ảnh khi bình yên").setInputFiles({ name: "moi.png", mimeType: "image/png", buffer: makePng(500, 500) });
    await expect(box.getByRole("status")).toContainText("Đã thêm ảnh khi bình yên.");
    const now = (await pics()) ?? {};
    expect(now.calm).not.toBe(first);
    expect(await files()).toEqual([now.calm, now.sad].sort());

    // Góc bình yên shows the pictures (greeting + the 4 quadrants: buồn its own, others the first).
    await k.goto("/binh-yen");
    const corner = k.getByRole("region", { name: "Góc của con" });
    await expect(corner.getByRole("link", { name: "Đổi nhân vật của con" })).toBeVisible();
    await expect(corner.locator('img[src*="/api/files/avatar"]')).toHaveCount(5);
    await expect(corner.locator(`img[src*="${encodeURIComponent(now.sad as string)}"]`)).toHaveCount(1);

    // The child takes one off.
    await k.goto("/nhan-vat");
    await box.getByRole("button", { name: "Gỡ ảnh khi buồn" }).click();
    await expect(box.getByRole("status")).toContainText("Đã gỡ ảnh.");
    expect(await pics()).toEqual({ calm: now.calm });
    expect(await files()).toEqual([now.calm]);
    await kCtx.close();

    // The parent sees it in Các con and removes all (the app cannot tell a drawing from a photo).
    await login(page, env.parentEmail, env.parentPassword);
    await page.goto("/parent/children");
    await page.getByRole("listitem").filter({ hasText: kid?.display_name ?? "" }).locator("summary").click();
    const card = page.getByRole("region", { name: `Nhân vật của ${kid?.display_name}` });
    await expect(card).toContainText("Con đang dùng ảnh tải lên (Picrew).");
    await expect(card.locator('img[src*="/api/files/avatar"]')).toHaveCount(4);
    page.on("dialog", (d) => void d.accept());
    await card.getByRole("button", { name: "Gỡ ảnh nhân vật của con" }).click();
    await expect(card).toContainText("Con chưa tạo — đang là hình tạm.");
    expect(await pics()).toBeNull();
    expect(await files()).toEqual([]);
    const { data: log } = await db.from("audit_log").select("action, payload").eq("family_id", familyId).eq("action", "child.avatar_pics_removed");
    expect(log?.some((l) => (l.payload as { child_id?: string }).child_id === childId)).toBe(true);
    expect(await byCall(page, "POST", "/api/profile/avatar/pics/delete", { all: true })).toBe(403);
  } finally {
    const left = ((await db.storage.from("avatars").list(folder)).data ?? []).map((o) => `${folder}/${o.name}`);
    if (left.length) await db.storage.from("avatars").remove(left);
    await db.from("profiles").update({ grade, avatar: null, avatar_pics: null }).eq("id", childId);
  }
});

test("R4a thế giới: An's tab shows what grew from finished areas (stored once, never twice); cards open facts; parents and Nguyên's voice have no route", async ({ page, browser, request }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const grade = kid?.grade as number | null;
  const today = localDate(new Date());
  test.skip(today.endsWith("-01"), "needs a day before today in this month");
  const month = today.slice(0, 7);
  const first = `${month}-01`;
  const runId = randomUUID();
  await db.from("profiles").update({ grade: 6 }).eq("id", childId);
  await db.from("world_items").delete().eq("child_id", childId);
  await db.from("world_months").delete().eq("child_id", childId);
  const { data: before } = await db.from("day_sessions").select("*").eq("child_id", childId).eq("local_date", first).maybeSingle();
  try {
    // R4b: An picks the month's world; this test is about Rừng.
    expect((await db.from("world_months").insert({ family_id: familyId, child_id: childId, month: first, world_key: "rung" })).error).toBeNull();
    const at = `${first}T10:00:00+07:00`;
    expect((await db.from("day_sessions").upsert({ child_id: childId, family_id: familyId, local_date: first, part1_done_at: at, part2_done_at: at, free_started_at: at }, { onConflict: "child_id,local_date" })).error).toBeNull();
    expect((await db.from("by_checkins").insert({ family_id: familyId, child_id: childId, local_date: first, quad: "green", word_key: "binh_yen", client_run_id: runId })).error).toBeNull();

    const kCtx = await browser.newContext();
    const k = await kCtx.newPage();
    await login(k, childEmail, childPassword);
    await k.goto("/today");
    const nav = k.getByRole("navigation", { name: "Các mục của con" });
    await expect(nav.getByRole("link", { name: "Thế giới" })).toBeVisible();
    await expect(k.getByRole("region", { name: /Rừng nhiệt đới của con/ })).toContainText(/\d+ thứ đã mọc/);
    await nav.getByRole("link", { name: "Thế giới" }).click();
    await expect(k).toHaveURL(/\/today\?tab=tuan$/);
    await expect(k.getByRole("heading", { name: /Rừng nhiệt đới · tháng/ })).toBeVisible();

    // What should grow: one plant per finished area per day this month (from the durable records).
    const { data: days } = await db.from("day_sessions").select("local_date, part1_done_at, part2_done_at, free_started_at").eq("child_id", childId).gte("local_date", first).lte("local_date", today);
    const { data: visits } = await db.from("by_checkins").select("local_date").eq("child_id", childId).gte("local_date", first).lte("local_date", today);
    const expected = new Set<string>();
    for (const d of days ?? []) {
      if (d.part1_done_at) expected.add(`${d.local_date}|study`);
      if (d.part2_done_at) expected.add(`${d.local_date}|skill`);
      if (d.free_started_at) expected.add(`${d.local_date}|play`);
    }
    for (const v of visits ?? []) expected.add(`${v.local_date}|feel`);

    const rows = async () => (await db.from("world_items").select("local_date, pillar, world_key, item_key, variant").eq("child_id", childId).gte("local_date", first)).data ?? [];
    const planted = await rows();
    expect(new Set(planted.map((r) => `${r.local_date}|${r.pillar}`))).toEqual(expected);
    expect(planted.every((r) => r.world_key === "rung")).toBe(true);
    // The first Học tập plant of the month is always the first big tree.
    const firstStudy = planted.filter((r) => r.pillar === "study").sort((a, b) => (a.local_date < b.local_date ? -1 : 1))[0];
    expect(firstStudy?.item_key).toBe("cho_ngan_nam");

    const grown = k.getByRole("list", { name: "Những thứ đã mọc" });
    await grown.getByRole("button", { name: /^Chò ngàn năm, đã mọc \d+ lần/ }).click();
    const card = k.getByRole("region", { name: "Chò ngàn năm" });
    await expect(card).toContainText("Cúc Phương");
    await expect(card.getByRole("region", { name: "Nhiệm vụ ngoài đời" })).toBeVisible();
    await expect(card.getByRole("region", { name: "Tối nay dạy cả nhà" })).toBeVisible();
    // R6b: the card opens under the scene; "Con đã làm" / "Tối nay dạy cả nhà" are remembered on this device only.
    await card.getByRole("button", { name: "Con đã làm" }).click();
    await expect(card.getByRole("button", { name: "Đã làm ✓" })).toHaveAttribute("aria-pressed", "true");
    await card.getByRole("button", { name: "Tối nay dạy cả nhà điều này" }).click();
    await expect(card.getByRole("button", { name: "Tối nay con sẽ kể ✓" })).toBeVisible();
    await expect(k.getByRole("list", { name: "Hôm nay", exact: true }).getByRole("listitem")).toHaveCount(4);
    await expect(k.getByRole("region", { name: "Đang chờ dọn đến" })).toContainText("đến khi");
    await card.getByRole("button", { name: "Đóng" }).click();
    await expect(k.getByRole("region", { name: "Chò ngàn năm" })).toHaveCount(0);

    // Opening again never plants twice.
    await k.reload();
    await expect(k.getByRole("heading", { name: /Rừng nhiệt đới · tháng/ })).toBeVisible();
    await grown.getByRole("button", { name: /^Chò ngàn năm, đã mọc \d+ lần/ }).click();
    await expect(k.getByRole("region", { name: "Chò ngàn năm" }).getByRole("button", { name: "Đã làm ✓" })).toBeVisible();
    expect((await rows()).length).toBe(expected.size);
    // Deleting the visit does not take the flower away (BINH_YEN D2).
    await db.from("by_checkins").delete().eq("client_run_id", runId);
    await k.reload();
    await expect(k.getByRole("heading", { name: /Rừng nhiệt đới · tháng/ })).toBeVisible();
    expect((await rows()).some((r) => r.local_date === first && r.pillar === "feel")).toBe(true);

    // The server checks the month; Nguyên's voice has no world (R5 is her comic).
    expect(await byCall(k, "GET", "/api/world?month=2026-13")).toBe(400);
    expect(await byCall(k, "GET", "/api/world?month=2099-01")).toBe(404);
    expect(await byCall(k, "GET", "/api/world?month=2026-10")).toBe(404);
    await db.from("profiles").update({ grade: 9 }).eq("id", childId);
    expect(await byCall(k, "GET", "/api/world")).toBe(404);
    await k.goto("/today");
    await expect(nav.getByRole("link", { name: "Tập của tuần" })).toBeVisible();
    await kCtx.close();

    expect((await request.get("/api/world")).status()).toBe(401);
    await login(page, env.parentEmail, env.parentPassword);
    expect(await byCall(page, "GET", "/api/world")).toBe(403);
    // Straight to the database: neither parent nor child can read the world.
    const asParent = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    await asParent.auth.signInWithPassword({ email: env.parentEmail, password: env.parentPassword });
    expect((await asParent.from("world_items").select("id")).error).not.toBeNull();
  } finally {
    await db.from("by_checkins").delete().eq("client_run_id", runId);
    await db.from("world_items").delete().eq("child_id", childId);
    await db.from("world_months").delete().eq("child_id", childId);
    if (before) await db.from("day_sessions").upsert(before, { onConflict: "child_id,local_date" });
    else await db.from("day_sessions").delete().eq("child_id", childId).eq("local_date", first);
    await db.from("profiles").update({ grade }).eq("id", childId);
  }
});

test("R4b An chọn thế giới: a new month waits for An's pick (nothing planted, nothing lost); only offered worlds; picked once; then everything since the 1st grows there", async ({ browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const grade = kid?.grade as number | null;
  const today = localDate(new Date());
  test.skip(today.endsWith("-01"), "needs a day before today in this month");
  const first = `${today.slice(0, 7)}-01`;
  await db.from("profiles").update({ grade: 6 }).eq("id", childId);
  await db.from("world_items").delete().eq("child_id", childId);
  await db.from("world_months").delete().eq("child_id", childId);
  const { data: before } = await db.from("day_sessions").select("*").eq("child_id", childId).eq("local_date", first).maybeSingle();
  try {
    const at = `${first}T10:00:00+07:00`;
    expect((await db.from("day_sessions").upsert({ child_id: childId, family_id: familyId, local_date: first, part1_done_at: at, part2_done_at: at, free_started_at: at }, { onConflict: "child_id,local_date" })).error).toBeNull();
    const monthRows = async () => (await db.from("world_items").select("local_date, pillar, world_key, item_key").eq("child_id", childId).gte("local_date", first)).data ?? [];

    const kCtx = await browser.newContext();
    const k = await kCtx.newPage();
    await login(k, childEmail, childPassword);
    await k.goto("/today");
    await k.getByRole("button", { name: /Tháng mới! Chọn thế giới của con/ }).click();
    await expect(k).toHaveURL(/\/today\?tab=tuan$/);
    await expect(k.getByRole("heading", { name: /Tháng mới! Con chọn thế giới cho tháng này/ })).toBeVisible();
    const worlds = k.getByRole("list", { name: "Các thế giới" });
    // Every world with a pack is on offer in a first month; Núi lửa only from January 2027.
    const volcano = today >= "2027-01";
    await expect(worlds.getByRole("button")).toHaveCount(volcano ? 4 : 3);
    await expect(worlds.getByRole("button", { name: /Núi lửa và động đất/ })).toHaveCount(volcano ? 1 : 0);
    // Nothing grows before the pick (it is not lost: it grows once An picks).
    expect(await monthRows()).toEqual([]);

    // Only an offered world, only with a well-formed body.
    expect(await byCall(k, "POST", "/api/world/choose", { world: "sa_mac" })).toBe(400);
    expect(await byCall(k, "POST", "/api/world/choose", { world: "Biển!" })).toBe(400);
    expect(await byCall(k, "POST", "/api/world/choose", {})).toBe(400);

    await worlds.getByRole("button", { name: /Biển và rạn san hô/ }).click();
    await expect(worlds.getByRole("button", { name: /Biển và rạn san hô/ })).toHaveAttribute("aria-pressed", "true");
    await k.getByRole("button", { name: "Vào Biển và rạn san hô" }).click();
    await expect(k.getByRole("heading", { name: /Biển và rạn san hô · tháng/ })).toBeVisible();
    const rows = await monthRows();
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((r) => r.world_key === "bien")).toBe(true);
    expect(rows.find((r) => r.local_date === first && r.pillar === "study")?.item_key).toBe("co_bien");
    expect((await db.from("world_months").select("world_key").eq("child_id", childId)).data).toEqual([{ world_key: "bien" }]);
    await k.getByRole("list", { name: "Những thứ đã mọc" }).getByRole("button", { name: /^Cỏ biển, đã mọc/ }).click();
    await expect(k.getByRole("region", { name: "Cỏ biển" })).toContainText("cây có hoa");
    await k.getByRole("region", { name: "Cỏ biển" }).getByRole("button", { name: "Đóng" }).click();

    // Picked once: the month stays in Biển.
    expect(await byCall(k, "POST", "/api/world/choose", { world: "vu_tru" })).toBe(409);
    expect(await byCall(k, "POST", "/api/world/choose", { world: "vu_tru", month: "2020-01" })).toBe(409);
    await k.reload();
    await expect(k.getByRole("heading", { name: /Biển và rạn san hô · tháng/ })).toBeVisible();
    await kCtx.close();
  } finally {
    await db.from("world_items").delete().eq("child_id", childId);
    await db.from("world_months").delete().eq("child_id", childId);
    if (before) await db.from("day_sessions").upsert(before, { onConflict: "child_id,local_date" });
    else await db.from("day_sessions").delete().eq("child_id", childId).eq("local_date", first);
    await db.from("profiles").update({ grade }).eq("id", childId);
  }
});

test("R6a thấy ngay: a region tile on Hôm nay opens Góc bình yên at that region; \"Xong rồi\" shows what grew in An's world; the week shows region icons", async ({ browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const grade = kid?.grade as number | null;
  const today = localDate(new Date());
  const first = `${today.slice(0, 7)}-01`;
  await db.from("profiles").update({ grade: 6 }).eq("id", childId);
  await db.from("family_settings").update({ by_enabled: true }).eq("family_id", familyId);
  await db.from("world_items").delete().eq("child_id", childId);
  await db.from("world_months").delete().eq("child_id", childId);
  await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", childId).is("ended_at", null);
  // A fresh day for the corner: the visit below is the first today (its plant is "new").
  await db.from("by_checkins").delete().eq("child_id", childId);
  const { data: settings } = await db.from("family_settings").select("by_enabled").eq("family_id", familyId).single();
  try {
    expect((await db.from("world_months").insert({ family_id: familyId, child_id: childId, month: first, world_key: "rung" })).error).toBeNull();
    const kCtx = await browser.newContext();
    const k = await kCtx.newPage();
    await login(k, childEmail, childPassword);
    await k.goto("/today");

    // The 4 regions of An's corner are on Hôm nay; a tile goes straight to that region's words.
    const invite = k.getByRole("region", { name: "Hôm nay con thấy thế nào?" });
    for (const name of ["Núi lửa", "Mặt trời", "Biển sâu", "Khu rừng"]) await expect(invite.getByRole("link", { name: new RegExp(`^${name}:`) })).toBeVisible();
    // R6b: the child's own character greets them at the top.
    await expect(k.getByRole("link", { name: "Nhân vật của con", exact: true })).toBeVisible();
    await invite.getByRole("link", { name: /^Khu rừng:/ }).click();
    const words = k.getByRole("region", { name: "Chọn từ" });
    await expect(words).toBeVisible();
    await expect(k).toHaveURL(/\/binh-yen$/); // used once: a reload starts from the corner's home
    await words.getByRole("group", { name: "Từ cảm xúc" }).getByRole("button").first().click();
    await words.getByRole("button", { name: "Tiếp →" }).click();
    await k.getByRole("region", { name: "Công nhận" }).getByRole("button", { name: "Tận hưởng →" }).click();
    await k.getByRole("region", { name: "Gợi ý cho con" }).getByRole("button", { name: "Vậy là đủ cho hôm nay" }).click();

    // The reward: what grew in Cảm xúc today, a fact, and the way to the world.
    const done = k.getByRole("region", { name: "Xong rồi" });
    const grew = done.getByRole("group", { name: "Thế giới của con" });
    await expect(grew).toContainText(/trong Rừng nhiệt đới của con/);
    await expect(grew).toContainText("Con có biết?");
    const { data: plant } = await db.from("world_items").select("pillar, world_key").eq("child_id", childId).eq("local_date", today).eq("pillar", "feel");
    expect(plant).toEqual([{ pillar: "feel", world_key: "rung" }]);
    await grew.getByRole("link", { name: "Xem trong Thế giới →" }).click();
    await expect(k).toHaveURL(/\/today\?tab=tuan$/);
    await expect(k.getByRole("heading", { name: /Rừng nhiệt đới · tháng/ })).toBeVisible();

    // Hôm nay: the visit is remembered (only for the child) and the compact world card shows today's plant.
    await k.goto("/today");
    await expect(k.getByRole("region", { name: "Hôm nay con thấy thế nào?" })).toContainText("Hôm nay con đã ghé Góc bình yên");
    // R6d: the Cảm xúc card (child only) says the visit too, with the way back in.
    const feelCard = k.getByRole("list", { name: "Bốn mảng hôm nay" }).getByRole("listitem", { name: "1 · Cảm xúc" });
    await expect(feelCard).toContainText("Hôm nay con đã ghé:");
    await expect(feelCard.getByRole("link", { name: "Vào Góc bình yên lần nữa" })).toBeVisible();
    await expect(k.getByRole("region", { name: /Rừng nhiệt đới của con/ }).getByRole("list", { name: "Hôm nay đã mọc" }).getByRole("listitem")).not.toHaveCount(0);
    await kCtx.close();
  } finally {
    await db.from("world_items").delete().eq("child_id", childId);
    await db.from("world_months").delete().eq("child_id", childId);
    await db.from("by_checkins").delete().eq("child_id", childId);
    await db.from("family_settings").update({ by_enabled: settings?.by_enabled ?? false }).eq("family_id", familyId);
    await db.from("profiles").update({ grade }).eq("id", childId);
  }
});

test("R5 truyện của Nguyên: \"Xong rồi\" draws frame 1; Hôm nay shows today's comic page; Tập của tuần has a cover, pages and a shelf; child-only week route", async ({ page, browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const grade = kid?.grade as number | null;
  const today = localDate(new Date());
  const monday = weekStart(today);
  const lastWeek = addDays(monday, -7);
  const { data: settings } = await db.from("family_settings").select("by_enabled").eq("family_id", familyId).single();
  const { data: oldCheckins } = await db.from("by_checkins").select("*").eq("child_id", childId);
  const dates = [...new Set([today, monday, lastWeek])];
  const { data: oldSessions } = await db.from("day_sessions").select("*").eq("child_id", childId).in("local_date", dates);
  const at = (d: string) => `${d}T10:00:00+07:00`;
  await db.from("profiles").update({ grade: 9 }).eq("id", childId);
  await db.from("family_settings").update({ by_enabled: true }).eq("family_id", familyId);
  await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", childId).is("ended_at", null);
  await db.from("by_checkins").delete().eq("child_id", childId);
  try {
    // Today: Phần 1 is done. Monday (when it is not today): a full day with a visit + activity.
    // Last week: one record, so the shelf has a volume.
    const up = (row: Record<string, unknown>) => db.from("day_sessions").upsert({ child_id: childId, family_id: familyId, ...row }, { onConflict: "child_id,local_date" });
    expect((await up({ local_date: today, part1_done_at: at(today) })).error).toBeNull();
    if (monday !== today) {
      expect((await up({ local_date: monday, part1_done_at: at(monday), part2_done_at: at(monday), free_started_at: at(monday) })).error).toBeNull();
      expect((await db.from("by_checkins").insert({ family_id: familyId, child_id: childId, local_date: monday, quad: "green", word_key: "binh_yen", activity_key: "breath", client_run_id: randomUUID() })).error).toBeNull();
    }
    expect((await up({ local_date: lastWeek, part1_done_at: at(lastWeek) })).error).toBeNull();

    const kCtx = await browser.newContext();
    const k = await kCtx.newPage();
    await login(k, childEmail, childPassword);

    // Góc bình yên → Hồ sơ lục → bình yên → "Vậy là đủ": frame 1 of today's page is drawn.
    await k.goto("/binh-yen");
    await k.getByRole("button", { name: /^Hồ sơ lục:/ }).click();
    const words = k.getByRole("region", { name: "Chọn từ" });
    await words.getByRole("group", { name: "Từ cảm xúc" }).getByRole("button", { name: /bình yên/ }).click();
    await words.getByRole("button", { name: "Tiếp →" }).click();
    await k.getByRole("region", { name: "Công nhận" }).getByRole("button", { name: "Tận hưởng →" }).click();
    await k.getByRole("region", { name: "Gợi ý cho con" }).getByRole("button", { name: "Vậy là đủ cho hôm nay" }).click();
    const frame = k.getByRole("region", { name: "Xong rồi" }).getByRole("group", { name: "Trang truyện hôm nay" });
    await expect(frame).toContainText("KHUNG 1 · CẢM XÚC");
    await expect(frame).toContainText("Bình yên…");
    await expect(frame).toContainText("Khung 1 đã được vẽ");
    await frame.getByRole("link", { name: "Xem Tập của tuần →" }).click();
    await expect(k).toHaveURL(/\/today\?tab=tuan$/);

    // Tập của tuần: the cover, then Monday's page.
    await expect(k.getByRole("heading", { name: /^📕 Tập \d+ · tuần này$/ })).toBeVisible();
    const cover = k.getByRole("article", { name: /^Bìa tập \d+$/ });
    await expect(cover).toContainText("Thám tử");
    await expect(cover.getByRole("list", { name: "Mục lục" })).toContainText("bình yên");
    const pager = k.getByRole("navigation", { name: "Lật trang" });
    await expect(pager.getByRole("button", { name: "Bìa", exact: true })).toHaveAttribute("aria-current", "true");
    await pager.getByRole("button", { name: "Trang sau →" }).click();
    const mon = k.getByRole("article", { name: /^Trang Thứ Hai · / });
    await expect(mon).toContainText("Hồ sơ lục");
    await expect(mon).toContainText("bình yên");
    await expect(mon).toContainText(monday === today ? "Gọi tên là đủ cho hôm nay" : "Thở cho dịu lại");
    await expect(mon).toContainText("Bài hôm nay ✓");
    await expect(pager.getByRole("button", { name: "Thứ Hai", exact: true })).toHaveAttribute("aria-current", "true");
    await pager.getByRole("button", { name: "← Trang trước" }).click();
    await expect(cover).toBeVisible();

    // The shelf: last week's volume opens read-only, then back to this week.
    const shelf = k.getByRole("group", { name: "Kệ truyện" });
    await shelf.getByRole("button", { name: /^Tập \d+, tuần / }).first().click();
    await expect(k.getByRole("heading", { name: /^📕 Tập \d+ · tuần \d/ })).toBeVisible();
    await k.getByRole("button", { name: "← Về tập tuần này" }).click();
    await expect(k.getByRole("heading", { name: /^📕 Tập \d+ · tuần này$/ })).toBeVisible();
    // The 4 areas of the week are still there.
    await expect(k.getByRole("heading", { name: "Tuần này của con" })).toBeVisible();

    // Hôm nay: today's comic page — frame 1 (the visit) and frame 2 (Phần 1) are drawn.
    await k.goto("/today");
    await expect(k.getByRole("heading", { name: "Trang truyện hôm nay" })).toBeVisible();
    const feelPanel = k.getByRole("group", { name: /^KHUNG 1 · CẢM XÚC/ });
    await expect(feelPanel).toContainText("Bình yên…");
    const studyPanel = k.getByRole("group", { name: /^KHUNG 2 · HỌC TẬP/ });
    await expect(studyPanel).not.toContainText("Xong bài trên lớp");
    await expect(studyPanel).toContainText("✓");
    const nav = k.getByRole("navigation", { name: "Các mục của con" });
    await expect(nav.getByRole("link", { name: "Tập của tuần" })).toBeVisible();

    // The week route: a Monday from the first record's week to this week; else 400 / 404.
    expect(await byCall(k, "GET", `/api/week/days?week=${monday}`)).toBe(200);
    expect(await byCall(k, "GET", `/api/week/days?week=${lastWeek}`)).toBe(200);
    expect(await byCall(k, "GET", "/api/week/days?week=2020-01-06")).toBe(404);
    expect(await byCall(k, "GET", `/api/week/days?week=${addDays(monday, 7)}`)).toBe(404);
    expect(await byCall(k, "GET", `/api/week/days?week=${addDays(monday, 1)}`)).toBe(400);
    expect(await byCall(k, "GET", "/api/week/days?week=hello")).toBe(400);

    // An (scientist voice) has her world, never the comic.
    await db.from("profiles").update({ grade: 6 }).eq("id", childId);
    await k.goto("/today");
    await expect(nav.getByRole("link", { name: "Thế giới" })).toBeVisible();
    await expect(k.getByRole("heading", { name: "Trang truyện hôm nay" })).toHaveCount(0);
    await kCtx.close();

    // Parents never get the child's week (feelings are the child's own).
    await login(page, env.parentEmail, env.parentPassword);
    expect(await byCall(page, "GET", `/api/week/days?week=${monday}`)).toBe(403);
  } finally {
    await db.from("by_checkins").delete().eq("child_id", childId);
    if (oldCheckins?.length) await db.from("by_checkins").insert(oldCheckins);
    for (const d of dates) {
      const before = oldSessions?.find((r) => r.local_date === d);
      if (before) await db.from("day_sessions").upsert(before, { onConflict: "child_id,local_date" });
      else await db.from("day_sessions").delete().eq("child_id", childId).eq("local_date", d);
    }
    await db.from("family_settings").update({ by_enabled: settings?.by_enabled ?? false }).eq("family_id", familyId);
    await db.from("profiles").update({ grade }).eq("id", childId);
  }
});
