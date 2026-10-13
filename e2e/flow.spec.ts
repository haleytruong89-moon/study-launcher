import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { makePng } from "./png";

const env = e2eEnv();

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
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

  await page.reload();
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
  await form.getByLabel("Chụp / chọn ảnh").setInputFiles({ name: "bai-toan.png", mimeType: "image/png", buffer: makePng(2400, 1800) });
  await expect(form.getByRole("img", { name: "Ảnh 1" })).toBeVisible();
  await form.getByLabel("Ghi chú (tùy chọn)").fill("Làm bài 1-3 trang 45");
  await form.getByRole("button", { name: "Giao Toán cho Hạnh Nguyên" }).click();
  await expect(form.getByRole("status")).toContainText("Đã giao Toán cho Hạnh Nguyên");
  await expect(form.getByRole("status")).toContainText("(1 ảnh)");

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

test("readiness now also reports the family as created", async ({ request }) => {
  const body = (await (await request.get("/api/health/ready")).json()) as {
    ok: boolean;
    checks: { name: string; ok: boolean }[];
  };
  expect(body.ok).toBe(true);
  expect(body.checks.find((c) => c.name === "family_created")?.ok).toBe(true);
});
