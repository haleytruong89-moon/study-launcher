import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { localDate } from "../lib/time";

/**
 * R7a — Bắt đầu nhẹ nhàng, tập trung tùy chọn. Self-contained (helpers copied from
 * flow.spec.ts, which runs first and creates the family and the child "Hạnh Nguyên", grade 9).
 * Every row and setting changed here is restored in `finally`.
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

/**
 * flow.spec.ts keeps the child's password in a variable of its own file; this file gives the
 * child a fresh password through the admin API (the old one is not needed after flow.spec.ts).
 */
async function childLogin(childId: string): Promise<{ email: string; password: string }> {
  const db = admin();
  const { data, error } = await db.auth.admin.getUserById(childId);
  expect(error).toBeNull();
  const password = `R7a-${randomBytes(9).toString("base64url")}`;
  expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
  return { email: data.user?.email ?? "", password };
}

/** A supplementary task for every weekday (20 minutes), removed again in `finally`. */
async function addTask(title: string): Promise<{ childId: string; familyId: string; grade: number | null; id: string }> {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade").eq("role", "child").single();
  const { data: tpl, error } = await db
    .from("task_templates")
    .insert({ family_id: kid?.family_id, child_id: kid?.id, part: "extra", title, subject: "Toán", weekdays: [1, 2, 3, 4, 5, 6, 7], min_minutes: 20 })
    .select("id")
    .single();
  expect(error).toBeNull();
  return { childId: kid?.id as string, familyId: kid?.family_id as string, grade: (kid?.grade as number | null) ?? null, id: tpl?.id as string };
}

async function removeTask(id: string) {
  const db = admin();
  await db.from("task_runs").delete().eq("template_id", id);
  await db.from("task_templates").delete().eq("id", id);
}

const SECONDS = /\d{1,2}:\d{2}/;

test.describe.configure({ mode: "serial" });

test("R7a: Bắt đầu shows a small card, never the focus screen; the header chip opens it on any tab; minutes only; ← Về Hôm nay and Esc close it", async ({ page }) => {
  const task = await addTask("R7a Luyện đề");
  try {
    const { email, password } = await childLogin(task.childId);
    await login(page, email, password);
    await page.goto("/today?tab=hoc-tap");
    const row = page.getByRole("listitem", { name: "R7a Luyện đề" });
    await row.getByRole("button").first().click();
    const work = page.getByRole("region", { name: "Khung làm bài" });
    await expect(work.getByRole("heading", { name: "R7a Luyện đề" })).toBeVisible();
    await expect(work.getByRole("timer")).toHaveText("20 phút");
    await work.getByRole("button", { name: "Bắt đầu" }).click();

    // The small card: the goal and how long, not a full-screen timer.
    const sheet = page.getByRole("dialog", { name: "Mục tiêu nhỏ: R7a Luyện đề" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Bắt đầu rồi ✓");
    await expect(sheet).toContainText("Toán · ít nhất 20 phút");
    await expect(sheet.getByRole("button", { name: "Ngồi cùng màn tập trung" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Đang tập trung" })).toHaveCount(0);
    const focus = page.getByRole("dialog", { name: /^Màn tập trung/ });
    await expect(focus).toHaveCount(0);
    await sheet.getByRole("button", { name: "Để sau" }).click();
    await expect(sheet).toHaveCount(0);
    const { data: runs } = await admin().from("task_runs").select("id, done_at").eq("template_id", task.id);
    expect(runs).toHaveLength(1);
    expect(runs?.[0]?.done_at).toBeNull();

    // The chip shows minutes; a reload opens nothing by itself (no card, no focus screen).
    const chip = page.getByRole("button", { name: /^Đang làm R7a Luyện đề/ });
    await expect(chip).toBeVisible();
    await expect(chip).not.toHaveText(SECONDS);
    await expect(work.getByRole("timer")).toHaveText(/^còn (19|20) phút$/);
    await page.reload();
    await expect(chip).toBeVisible();
    await expect(sheet).toHaveCount(0);
    await expect(focus).toHaveCount(0);

    // Also on the Tuần tab (screenshot 08/11: it used to pop up there by itself).
    await page.goto("/today?tab=tuan");
    await expect(chip).toBeVisible();
    await expect(focus).toHaveCount(0);
    await chip.click();
    await expect(focus).toBeVisible();
    const timer = focus.getByRole("timer");
    await expect(timer).toBeVisible();
    await expect(timer).not.toHaveText(SECONDS);
    await expect(focus).toContainText(/Còn khoảng (19|20) phút nữa là bấm Xong được/);
    await expect(focus.getByRole("button", { name: /^Xong · mở sau (19|20) phút$/ })).toBeDisabled();
    await expect(focus.getByRole("button", { name: "Thu nhỏ" })).toHaveCount(0);

    // ← Về Hôm nay closes it and gives focus back to the chip; Esc closes it too.
    await focus.getByRole("button", { name: "← Về Hôm nay" }).click();
    await expect(focus).toHaveCount(0);
    await expect(chip).toBeFocused();
    await chip.click();
    await expect(focus).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(focus).toHaveCount(0);
    await page.reload();
    await expect(focus).toHaveCount(0); // closed stays closed
  } finally {
    await removeTask(task.id);
  }
});

test("R7a long run: a task started 3 hours ago asks kindly “Con vẫn đang làm … chứ?”; Vẫn đang làm waits an hour; Xong rồi finishes it (An's voice)", async ({ page }) => {
  // A run "3 hours ago" must still be today in Vietnam (it would cross 00:00 between 00:00 and 03:00 VN).
  const vnHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  test.skip(vnHour < 3, "a 3-hour-old run would start yesterday in Vietnam");
  const db = admin();
  const task = await addTask("R7a Luyện lâu");
  await db.from("profiles").update({ grade: 6 }).eq("id", task.childId);
  try {
    const started = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    const { data: run, error } = await db
      .from("task_runs")
      .insert({ family_id: task.familyId, child_id: task.childId, local_date: localDate(new Date()), source: "template", template_id: task.id, started_at: started })
      .select("id")
      .single();
    expect(error).toBeNull();

    const { email, password } = await childLogin(task.childId);
    await login(page, email, password);
    await page.goto("/today");
    const chip = page.getByRole("button", { name: /^Đang làm R7a Luyện lâu/ });
    await expect(chip).toContainText("hơn 2 giờ");
    await expect(chip).not.toHaveText(SECONDS);
    const focus = page.getByRole("dialog", { name: /^Màn tập trung/ });
    await expect(focus).toHaveCount(0);
    await chip.click();
    await expect(focus).toBeVisible();
    await expect(focus).toContainText("Con vẫn đang làm “R7a Luyện lâu” chứ?");
    await expect(focus.getByRole("timer")).toHaveCount(0);

    // "Vẫn đang làm": the question rests for an hour (this tab), even after a reload.
    await focus.getByRole("button", { name: "Vẫn đang làm" }).click();
    await expect(focus).not.toContainText("Con vẫn đang làm");
    await expect(focus.getByRole("timer")).toContainText(/3 giờ 0\d phút/);
    await expect(focus.getByRole("timer")).not.toHaveText(SECONDS);
    await page.reload();
    await expect(focus).toBeVisible(); // the child opened it, so it stays open
    await expect(focus.getByRole("timer")).toBeVisible();
    await expect(focus).not.toContainText("Con vẫn đang làm");

    // The question again, then "Xong rồi" finishes the run on the server (minimum long reached).
    await page.evaluate((key) => window.sessionStorage.removeItem(key), `focus-snooze:template:${task.id}`);
    await page.reload();
    await expect(focus).toContainText("Con vẫn đang làm “R7a Luyện lâu” chứ?");
    await focus.getByRole("button", { name: "Xong rồi" }).click();
    await expect(focus).toHaveCount(0);
    await expect(chip).toHaveCount(0);
    await expect.poll(async () => (await db.from("task_runs").select("done_at").eq("id", run?.id ?? "").single()).data?.done_at ?? null).not.toBeNull();
  } finally {
    await removeTask(task.id);
    await db.from("profiles").update({ grade: task.grade }).eq("id", task.childId);
  }
});
