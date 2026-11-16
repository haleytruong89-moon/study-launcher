import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { addDays, localDate } from "../lib/time";

/**
 * L-5 "Tổng kết tuần" (parent decisions 15–16/11/2026): the parents' week page (Thêm → Tổng kết
 * tuần) shows each child's block, and "Gợi ý kèm con cuối tuần" is drawn from the data (here: a
 * homework past due and not done). Self-contained; the homework row is removed in `finally`.
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

test("L-5: Tổng kết tuần shows each child's week and a suggestion drawn from the data", async ({ page }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, display_name").eq("role", "child").single();
  const subject = "Sinh học (e2e L-5)";
  // 10 days ago: always before the end of the week the page shows, and never done.
  const hw = await db
    .from("homework_items")
    .insert({ family_id: kid?.family_id, child_id: kid?.id, subject, due_date: addDays(localDate(new Date()), -10) })
    .select("id")
    .single();
  expect(hw.error).toBeNull();
  try {
    await login(page, env.parentEmail, env.parentPassword);
    await page.goto("/parent/more");
    await page.getByRole("link", { name: /Tổng kết tuần/ }).click();
    await page.waitForURL(/\/parent\/week/);
    await expect(page.getByRole("heading", { level: 1, name: /^Tuần \d{2}\/\d{2} – \d{2}\/\d{2}$/ })).toBeVisible();

    const block = page.getByRole("region", { name: kid?.display_name as string });
    await expect(block.getByRole("heading", { name: "Tuần qua" })).toBeVisible();
    await expect(block.getByText(/\/7 ngày đạt/)).toBeVisible();
    await expect(block.getByRole("heading", { name: "Con tự viết" })).toBeVisible();
    await expect(block.getByRole("listitem").filter({ hasText: /bài quá hạn chưa làm \(Sinh học \(e2e L-5\)/ })).toBeVisible();

    // Previous week, then back: the newest week has no "Tuần sau".
    await page.getByRole("link", { name: "Tuần trước" }).click();
    await page.waitForURL(/tuan=/);
    await page.getByRole("link", { name: "Tuần sau" }).click();
    await expect(page.getByRole("link", { name: "Tuần sau" })).toHaveCount(0);
  } finally {
    if (hw.data?.id) await db.from("homework_items").delete().eq("id", hw.data.id);
  }
});
