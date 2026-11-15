import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";

/**
 * "Mở app = bắt đầu luôn" (parent decision 15/11/2026): a skill with an app shows ONE action
 * "Bắt đầu · Mở {app} ↗" — the click opens the app in a new tab AND starts the task on the
 * server. While it runs, the link is a plain "Mở {app} ↗"; a task that cannot start now (another
 * timed task runs) keeps a disabled Bắt đầu and a plain link. Self-contained (flow.spec.ts runs
 * first and creates the family and the child); every row added here is removed in `finally`.
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
  const password = `Mo-${randomBytes(9).toString("base64url")}`;
  expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
  return { email: data.user?.email ?? "", password };
}

/** A 20-minute skill for every weekday whose app link is a page of this app (no outside site in CI). */
async function addSkill(title: string, deepLink: string): Promise<{ childId: string; id: string }> {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const { data: tpl, error } = await db
    .from("task_templates")
    .insert({ family_id: kid?.family_id, child_id: kid?.id, part: "skill", title, weekdays: [1, 2, 3, 4, 5, 6, 7], min_minutes: 20, deep_link: deepLink })
    .select("id")
    .single();
  expect(error).toBeNull();
  return { childId: kid?.id as string, id: tpl?.id as string };
}

async function removeTask(id: string) {
  const db = admin();
  await db.from("task_runs").delete().eq("template_id", id);
  await db.from("task_templates").delete().eq("id", id);
}

const openRuns = async (templateId: string) => (await admin().from("task_runs").select("id").eq("template_id", templateId).is("done_at", null)).data?.length ?? -1;

test.describe.configure({ mode: "serial" });

test("Mở app = bắt đầu: “Bắt đầu · Mở …” opens the app and starts the skill; then a plain “Mở …” link; another skill waits with a plain link", async ({ page, baseURL }) => {
  const link = new URL("/chinh-sach-rieng-tu", baseURL).toString();
  const first = await addSkill("Mở app Tiếng Anh", link);
  const second = await addSkill("Mở app Nghe", link);
  try {
    const { email, password } = await childLogin(first.childId);
    await login(page, email, password);
    await page.goto("/today?tab=hoc-tap");
    const work = page.getByRole("region", { name: "Khung làm bài" });
    const row = page.getByRole("listitem", { name: "Mở app Tiếng Anh" });
    await row.getByRole("button").first().click();
    await expect(work.getByRole("heading", { name: "Mở app Tiếng Anh" })).toBeVisible();

    // One action: no separate Bắt đầu button, no separate "Mở … ↗" link.
    const both = work.getByRole("link", { name: /^Bắt đầu · Mở .+ ↗$/ });
    await expect(both).toBeVisible();
    await expect(both).toHaveAttribute("target", "_blank");
    await expect(both).toHaveAttribute("href", link);
    await expect(work.getByRole("button", { name: "Bắt đầu", exact: true })).toHaveCount(0);
    await expect(work.getByRole("link", { name: /^Mở .+ ↗$/ })).toHaveCount(0);
    expect(await openRuns(first.id)).toBe(0);

    // The click opens the app in a new tab and starts the task on the server.
    const popupOpened = page.waitForEvent("popup");
    await both.click();
    const popup = await popupOpened;
    expect(popup.url()).toContain("/chinh-sach-rieng-tu");
    await popup.close();
    await expect.poll(() => openRuns(first.id)).toBe(1);
    await expect(work).toContainText("Đang làm · Kỹ năng");
    await expect(work.getByRole("timer")).toHaveText(/^còn (19|20) phút$/);
    // The app is already open: no "Bắt đầu rồi ✓" card on top of the launcher.
    await expect(page.getByRole("dialog", { name: "Mục tiêu nhỏ: Mở app Tiếng Anh" })).toHaveCount(0);
    // Running: a plain link only (opening it again never starts anything).
    await expect(work.getByRole("link", { name: /^Bắt đầu · Mở/ })).toHaveCount(0);
    const plain = work.getByRole("link", { name: /^Mở .+ ↗$/ });
    await expect(plain).toBeVisible();
    const again = page.waitForEvent("popup");
    await plain.click();
    await (await again).close();
    expect(await openRuns(first.id)).toBe(1);

    // Another timed skill waits (one at a time): disabled Bắt đầu + the reason + a plain link.
    await page.getByRole("listitem", { name: "Mở app Nghe" }).getByRole("button").first().click();
    await expect(work.getByRole("heading", { name: "Mở app Nghe" })).toBeVisible();
    await expect(work).toContainText("Làm xong “Mở app Tiếng Anh” rồi bắt đầu việc này.");
    await expect(work.getByRole("button", { name: "Bắt đầu", exact: true })).toBeDisabled();
    await expect(work.getByRole("link", { name: /^Bắt đầu · Mở/ })).toHaveCount(0);
    await expect(work.getByRole("link", { name: /^Mở .+ ↗$/ })).toBeVisible();
    expect(await openRuns(second.id)).toBe(0);
  } finally {
    await removeTask(first.id);
    await removeTask(second.id);
  }
});
