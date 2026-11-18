import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { isoWeekday, localDate } from "../lib/time";

/**
 * Thời khóa biểu (18/11/2026): the parent pastes a timetable (Thêm → Thời khóa biểu), Giao bài
 * suggests the due date from it, and the child sees today's lessons in Góc học tập. The version
 * is removed in `finally`.
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

// Toán every school day, so the suggestion and "today" never depend on the weekday CI runs on.
const TEXT = `LỚP: E2E
S1 07:30-08:15 | Toán | Toán | Toán | Toán | Toán | Toán
S2 08:20-09:05 | Văn | Sinh học e2e | Văn | Văn | Văn | Văn
ĐỒNG PHỤC T2: Áo e2e`;

test("Thời khóa biểu: paste → Giao bài suggests the due date → the child sees today's lessons", async ({ page, browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, display_name").eq("role", "child").single();
  try {
    await login(page, env.parentEmail, env.parentPassword);
    await page.goto("/parent/more");
    await page.getByRole("link", { name: /Thời khóa biểu/ }).click();
    await page.waitForURL(/\/parent\/timetable/);
    const box = page.getByRole("region", { name: `Thời khóa biểu của ${kid?.display_name}` });
    await box.getByLabel("Thời khóa biểu (dán nhanh)").fill(TEXT);
    await expect(box.getByRole("table")).toContainText("Sinh học e2e");
    await box.getByRole("button", { name: "Lưu thời khóa biểu" }).click();
    await expect(box.getByRole("status")).toContainText("Đã lưu");
    await expect(box.getByRole("list", { name: "Các bản thời khóa biểu" })).toContainText("đang áp dụng");

    // Giao bài: Toán → the hint names the next lesson day.
    await page.goto("/parent/homework");
    await page.getByRole("button", { name: "Giao bài mới" }).click();
    const form = page.getByRole("form", { name: "Giao bài tập" });
    const pickKid = form.getByRole("button", { name: kid?.display_name as string, exact: true });
    if ((await pickKid.count()) > 0) await pickKid.click();
    await form.getByRole("button", { name: "Toán", exact: true }).click();
    await expect(form.getByText(/Theo thời khóa biểu: buổi Toán gần nhất là Thứ \d/)).toBeVisible();

    // The child: today's lessons (Monday–Saturday).
    const today = localDate(new Date());
    if (isoWeekday(today) <= 6) {
      const ctx = await browser.newContext();
      const k = await ctx.newPage();
      const { data: u } = await db.auth.admin.getUserById(kid?.id as string);
      const password = `Tkb-${randomBytes(9).toString("base64url")}`;
      expect((await db.auth.admin.updateUserById(kid?.id as string, { password })).error).toBeNull();
      await login(k, u.user?.email ?? "", password);
      await k.goto("/today?tab=hoc-tap");
      const card = k.getByRole("region", { name: "Thời khóa biểu" });
      await expect(card.getByRole("heading", { name: /Hôm nay ở trường/ })).toBeVisible();
      await expect(card.getByRole("list", { name: "Các tiết hôm nay" })).toContainText("Toán");
      await ctx.close();
    }
  } finally {
    await db.from("timetables").delete().eq("child_id", kid?.id as string).eq("label", "E2E");
  }
});
