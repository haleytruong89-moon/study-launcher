import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { addDays, localDate } from "../lib/time";

/**
 * "✓ Con đã làm" (21/11/2026): homework done on paper away from the computer; the parent marks
 * it done from Giao bài (two taps). Self-contained; the rows are removed in `finally`.
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

test("Con đã làm: the parent marks an overdue homework done (Đạt), no photo needed", async ({ page }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const due = addDays(localDate(new Date()), -2);
  const subject = "Địa lí e2e";
  const hw = await db.from("homework_items").insert({ family_id: kid?.family_id, child_id: kid?.id, subject, due_date: due }).select("id").single();
  expect(hw.error).toBeNull();
  const id = hw.data?.id as string;
  try {
    await login(page, env.parentEmail, env.parentPassword);
    await page.goto("/parent/homework");
    const card = page.getByRole("listitem", { name: `${subject} nộp ${due.slice(8, 10)}/${due.slice(5, 7)}` });
    await expect(card).toContainText("Trễ 2 ngày");
    await card.getByRole("button", { name: /Con đã làm bài/ }).click();
    await card.getByRole("button", { name: /Bấm lần nữa/ }).click();
    await expect(card).toContainText("Đã xong");
    await expect(card.getByRole("button", { name: /Con đã làm/ })).toHaveCount(0);

    const { data: run } = await db.from("task_runs").select("done_at, confirmed_by, parent_verdict").eq("homework_item_id", id).single();
    expect(run?.done_at).not.toBeNull();
    expect(run?.confirmed_by).not.toBeNull();
    expect(run?.parent_verdict).toBe("ok");
  } finally {
    await db.from("task_runs").delete().eq("homework_item_id", id);
    await db.from("homework_items").delete().eq("id", id);
  }
});
