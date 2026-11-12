import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { localDate } from "../lib/time";

/**
 * R8a — "Làm thêm": a done skill can be done again; the extra run never changes what is done.
 * Self-contained (helpers copied from r7a.spec.ts; flow.spec.ts runs first and creates the
 * family and the child). Every row changed here is restored in `finally`.
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
  const password = `R8a-${randomBytes(9).toString("base64url")}`;
  expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
  return { email: data.user?.email ?? "", password };
}

/** A skill for every weekday (20 minutes), removed again in `finally`. */
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
  await db.from("task_runs").delete().eq("template_id", id);
  await db.from("task_templates").delete().eq("id", id);
}

type Part = { total: number; done: number; complete: boolean; doneAt: string | null; items: { id: string; state: string; doneAt: string | null; sessions: number; extra: unknown }[] };

async function todayParts(page: Page): Promise<{ part1: Part; part2: Part }> {
  const res = await page.request.get("/api/today");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { state: { part1: Part; part2: Part } };
  return body.state;
}

const SECONDS = /\d{1,2}:\d{2}/;

test.describe.configure({ mode: "serial" });

test("R8a Làm thêm: a skill done today (25') starts again; the chip shows it; Xong at once; the row says “Hôm nay: … · 2 lần”; the part stays done", async ({ page }) => {
  // The seeded run starts 26 minutes ago: it must still be today in Vietnam.
  const vnHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  test.skip(vnHour < 1, "a 26-minute-old run would start yesterday in Vietnam");
  const db = admin();
  const title = "R8a Nghe tiếng Anh";
  const task = await addSkill(title);
  const today = localDate(new Date());
  const { data: before } = await db.from("day_sessions").select("*").eq("child_id", task.childId).eq("local_date", today).maybeSingle();
  try {
    const doneAt = new Date(Date.now() - 60_000);
    const startedAt = new Date(doneAt.getTime() - 25 * 60_000);
    const { error } = await db.from("task_runs").insert({
      family_id: task.familyId,
      child_id: task.childId,
      local_date: today,
      source: "template",
      template_id: task.id,
      started_at: startedAt.toISOString(),
      done_at: doneAt.toISOString(),
    });
    expect(error).toBeNull();

    const { email, password } = await childLogin(task.childId);
    await login(page, email, password);
    await page.goto("/today");
    const first = await todayParts(page);
    expect(first.part2.items.find((i) => i.id === task.id)).toMatchObject({ state: "done", sessions: 1, extra: null });

    // The done row on the Kỹ năng card: today's total and "Làm thêm".
    const card = page.getByRole("listitem", { name: "3 · Kỹ năng" });
    await expect(card).toContainText("Hôm nay: 25 phút · 1 lần");
    await card.getByRole("button", { name: `Làm thêm: ${title}` }).click();

    // The R7a start card, titled for the extra session, with no minimum.
    const sheet = page.getByRole("dialog", { name: `Làm thêm: ${title}` });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Không bắt buộc — làm bao lâu cũng được");
    await sheet.getByRole("button", { name: "Để sau" }).click();
    await expect(sheet).toHaveCount(0);

    await expect.poll(async () => (await db.from("task_runs").select("id").eq("template_id", task.id).is("done_at", null)).data?.length ?? 0).toBe(1);
    await expect(card).toContainText("Đang làm thêm");

    // The chip shows the extra run (minutes only); the focus view has Xong at once.
    const chip = page.getByRole("button", { name: new RegExp(`^Đang làm ${title}`) });
    await expect(chip).toBeVisible();
    await expect(chip).not.toHaveText(SECONDS);
    await chip.click();
    const focus = page.getByRole("dialog", { name: /^Màn tập trung/ });
    await expect(focus).toBeVisible();
    await expect(focus).toContainText("Không bắt buộc — làm bao lâu cũng được");
    const xong = focus.getByRole("button", { name: "Xong", exact: true });
    await expect(xong).toBeEnabled();
    await xong.click();
    await expect(focus).toHaveCount(0);
    await expect(chip).toHaveCount(0);
    await expect.poll(async () => (await db.from("task_runs").select("id").eq("template_id", task.id).is("done_at", null)).data?.length ?? -1).toBe(0);
    const { data: runs } = await db.from("task_runs").select("id").eq("template_id", task.id);
    expect(runs).toHaveLength(2);

    // Two sessions today; the task and its part are exactly as done as before.
    await expect(card).toContainText(/Hôm nay: (25|26) phút · 2 lần/);
    await expect(card.getByRole("button", { name: `Làm thêm: ${title}` })).toBeVisible();
    const after = await todayParts(page);
    const item = after.part2.items.find((i) => i.id === task.id);
    expect(item).toMatchObject({ state: "done", sessions: 2, extra: null });
    expect(Date.parse(item?.doneAt ?? "")).toBe(doneAt.getTime()); // still the first, required run
    expect([after.part2.total, after.part2.done, after.part2.complete, after.part2.doneAt]).toEqual([first.part2.total, first.part2.done, first.part2.complete, first.part2.doneAt]);
    expect([after.part1.total, after.part1.done, after.part1.complete, after.part1.doneAt]).toEqual([first.part1.total, first.part1.done, first.part1.complete, first.part1.doneAt]);
  } finally {
    await removeTask(task.id);
    if (before) await db.from("day_sessions").upsert(before, { onConflict: "child_id,local_date" });
    else await db.from("day_sessions").delete().eq("child_id", task.childId).eq("local_date", today);
  }
});
