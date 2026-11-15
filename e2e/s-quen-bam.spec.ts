import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { localDate } from "../lib/time";

/**
 * "Con quên bấm Bắt đầu?" (parent decision 15/11/2026, SQL 0020): the child reports a 25' session
 * done without Bắt đầu; nothing counts while it waits; the parent presses Đồng ý on "Con nhờ" and
 * the task is done (a normal finished run). At most 2 reports a day. Self-contained (flow.spec.ts
 * runs first and creates the family and the child); every row changed here is restored in `finally`.
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

/** A fresh password for the child through the admin API (flow.spec.ts keeps the old one to itself). */
async function childLogin(childId: string): Promise<{ email: string; password: string }> {
  const db = admin();
  const { data, error } = await db.auth.admin.getUserById(childId);
  expect(error).toBeNull();
  const password = `Quen-${randomBytes(9).toString("base64url")}`;
  expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
  return { email: data.user?.email ?? "", password };
}

/** A 20-minute skill for every weekday, removed again in `finally`. */
async function addSkill(title: string): Promise<{ childId: string; familyId: string; id: string }> {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const { data: tpl, error } = await db
    .from("task_templates")
    .insert({ family_id: kid?.family_id, child_id: kid?.id, part: "skill", title, weekdays: [1, 2, 3, 4, 5, 6, 7], min_minutes: 20 })
    .select("id")
    .single();
  expect(error).toBeNull();
  return { childId: kid?.id as string, familyId: kid?.family_id as string, id: tpl?.id as string };
}

async function removeTask(id: string) {
  const db = admin();
  await db.from("task_run_reports").delete().eq("template_id", id);
  await db.from("task_runs").delete().eq("template_id", id);
  await db.from("task_templates").delete().eq("id", id);
}

/** "HH:MM" in Vietnam for an instant. */
const vnClock = (ms: number) => new Date(ms + 7 * 3600_000).toISOString().slice(11, 16);

test.describe.configure({ mode: "serial" });

test("Quên bấm Bắt đầu: the child reports 25'; nothing counts while it waits; the parent's Đồng ý makes it done; at most 2 reports a day", async ({ page, browser }) => {
  const vnHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  test.skip(vnHour < 1, "a 25-minute session must start today in Vietnam");
  const db = admin();
  const first = await addSkill("Quên bấm Tiếng Anh");
  const second = await addSkill("Quên bấm Nghe");
  const third = await addSkill("Quên bấm Đọc");
  const today = localDate(new Date());
  const { data: before } = await db.from("day_sessions").select("*").eq("child_id", first.childId).eq("local_date", today).maybeSingle();
  const parentContext = await browser.newContext();
  try {
    const nowMin = Math.floor(Date.now() / 60_000) * 60_000;
    const to = vnClock(nowMin);
    const from = vnClock(nowMin - 25 * 60_000);

    const { email, password } = await childLogin(first.childId);
    await login(page, email, password);
    await page.goto("/today?tab=hoc-tap");
    const work = page.getByRole("region", { name: "Khung làm bài" });
    await page.getByRole("listitem", { name: "Quên bấm Tiếng Anh" }).getByRole("button").first().click();
    await expect(work.getByRole("heading", { name: "Quên bấm Tiếng Anh" })).toBeVisible();

    // The small link opens the calm sheet (default: the last 30 minutes).
    await work.getByRole("button", { name: "Con quên bấm Bắt đầu?" }).click();
    const sheet = page.getByRole("dialog", { name: "Con quên bấm Bắt đầu?" });
    await expect(sheet).toContainText("Bố mẹ sẽ xác nhận giúp con");
    await sheet.getByLabel("Con đã làm từ").fill(from);
    await sheet.getByLabel("đến", { exact: true }).fill(to);
    await expect(sheet).toContainText("25 phút");
    await sheet.getByRole("button", { name: "Gửi bố mẹ" }).click();
    await expect(sheet).toHaveCount(0);

    // Pending: shown, but nothing counts (no run, still "Bắt đầu").
    await expect(work).toContainText(`Đang chờ bố mẹ xác nhận lượt ${from}–${to}`);
    await expect(work.getByRole("button", { name: "Con quên bấm Bắt đầu?" })).toHaveCount(0);
    await expect(work.getByRole("button", { name: "Bắt đầu" })).toBeEnabled();
    const { data: pending } = await db.from("task_run_reports").select("id, status, run_id").eq("template_id", first.id);
    expect(pending).toEqual([expect.objectContaining({ status: "pending", run_id: null })]);
    expect((await db.from("task_runs").select("id").eq("template_id", first.id)).data).toHaveLength(0);

    // The parent sees it on "Con nhờ" and presses Đồng ý.
    const mom = await parentContext.newPage();
    await login(mom, env.parentEmail, env.parentPassword);
    await mom.goto("/parent/requests");
    const card = mom.getByRole("article", { name: "Nhờ xác nhận Quên bấm Tiếng Anh" });
    await expect(card).toContainText(`${from}–${to} (25 phút)`);
    await card.getByRole("button", { name: "Đồng ý" }).click();
    await expect(card).toHaveCount(0);
    await expect.poll(async () => (await db.from("task_run_reports").select("status, run_id").eq("template_id", first.id).single()).data?.status).toBe("approved");
    const { data: runs } = await db.from("task_runs").select("id, started_at, done_at").eq("template_id", first.id);
    expect(runs).toHaveLength(1);
    expect(Date.parse(runs?.[0]?.done_at ?? "") - Date.parse(runs?.[0]?.started_at ?? "")).toBe(25 * 60_000);
    const { data: linked } = await db.from("task_run_reports").select("run_id").eq("template_id", first.id).single();
    expect(linked?.run_id).toBe(runs?.[0]?.id);

    // The child's task is done (a normal finished run).
    await page.reload();
    await expect(page.getByRole("listitem", { name: "Quên bấm Tiếng Anh" })).toContainText("✓ Xong");
    const view = (await (await page.request.get("/api/today")).json()) as { state: { part2: { items: { id: string; state: string }[] } } };
    expect(view.state.part2.items.find((i) => i.id === first.id)?.state).toBe("done");

    // Second report of the day is fine; a third is refused (the link is gone too).
    const send = (templateId: string) => page.request.post("/api/tasks/report", { data: { templateId, from, to } });
    expect((await send(second.id)).status()).toBe(200);
    const refused = await send(third.id);
    expect(refused.status()).toBe(409);
    expect(((await refused.json()) as { error: string }).error).toBe("Hôm nay con đã nhờ đủ 2 lần rồi.");
    await page.reload();
    await page.getByRole("listitem", { name: "Quên bấm Đọc" }).getByRole("button").first().click();
    await expect(work.getByRole("heading", { name: "Quên bấm Đọc" })).toBeVisible();
    await expect(work.getByRole("button", { name: "Con quên bấm Bắt đầu?" })).toHaveCount(0);
    expect((await db.from("task_run_reports").select("id").eq("child_id", first.childId).eq("local_date", today)).data).toHaveLength(2);

    // Only the server writes: the child cannot approve its own report.
    const { data: second0 } = await db.from("task_run_reports").select("id").eq("template_id", second.id).single();
    expect((await page.request.post(`/api/admin/run-reports/${second0?.id}`, { data: { decision: "approve" } })).status()).toBe(403);
  } finally {
    await parentContext.close();
    for (const t of [first, second, third]) await removeTask(t.id);
    if (before) await db.from("day_sessions").upsert(before, { onConflict: "child_id,local_date" });
    else await db.from("day_sessions").delete().eq("child_id", first.childId).eq("local_date", today);
  }
});
