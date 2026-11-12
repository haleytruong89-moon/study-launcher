import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { localDate } from "../lib/time";

/**
 * Đợt 2. A5 — the parent's "Ngày của con" shows a task's "Làm thêm" runs as one line under it, with
 * no verdict buttons of their own. C2 — the daily self-check route. Self-contained; named "s-…" so it runs after flow.spec.ts (which
 * creates the family and the child). Every row added here is removed in `finally`.
 */

const env = e2eEnv();
const admin = () => createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } });

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("D2 A5: extra runs are grouped under their task on the review page", async ({ page }) => {
  // The seeded runs start 70 minutes ago: they must still be today in Vietnam.
  const vnHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  test.skip(vnHour < 2, "a 70-minute-old run would start yesterday in Vietnam");
  const db = admin();
  const title = "D2 Luyện nghe";
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const { data: tpl, error } = await db
    .from("task_templates")
    .insert({ family_id: familyId, child_id: childId, part: "skill", title, weekdays: [1, 2, 3, 4, 5, 6, 7], min_minutes: 20 })
    .select("id")
    .single();
  expect(error).toBeNull();
  const templateId = tpl?.id as string;
  const today = localDate(new Date());
  const { data: before } = await db.from("day_sessions").select("*").eq("child_id", childId).eq("local_date", today).maybeSingle();
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  try {
    const base = { family_id: familyId, child_id: childId, local_date: today, source: "template", template_id: templateId };
    const { error: e1 } = await db.from("task_runs").insert([
      { ...base, started_at: ago(70), done_at: ago(45) }, // required, 25'
      { ...base, started_at: ago(40), done_at: ago(30) }, // Làm thêm, 10'
      { ...base, started_at: ago(25), done_at: ago(5) }, // Làm thêm, 20'
    ]);
    expect(e1).toBeNull();

    await login(page, env.parentEmail, env.parentPassword);
    await page.goto(`/parent/review?con=${childId}`);
    const cards = page.getByRole("listitem", { name: title, exact: true });
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText("Làm thêm: 2 lần · 30 phút");
    await expect(cards.getByRole("button", { name: "Đạt", exact: true })).toHaveCount(1); // the required run only
  } finally {
    await db.from("task_runs").delete().eq("template_id", templateId);
    await db.from("task_templates").delete().eq("id", templateId);
    if (before) await db.from("day_sessions").upsert(before, { onConflict: "child_id,local_date" });
    else await db.from("day_sessions").delete().eq("child_id", childId).eq("local_date", today);
  }
});

test("C2: the daily self-check needs the cron secret and reads the database", async ({ request }) => {
  expect((await request.get("/api/cron/health")).status()).toBe(401);
  expect((await request.get("/api/cron/health", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
  const res = await request.get("/api/cron/health", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, checks: { database: "ok", photoCleanup: "not_checked", backup: "not_checked" } });
  expect(typeof body.checks.silentLaptops).toBe("number");
});
