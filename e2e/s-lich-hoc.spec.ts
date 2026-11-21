import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { addDays, localDate } from "../lib/time";

/**
 * Lịch học con tự quản (21/11/2026): the child edits a period and adds an extra class (with a
 * clash warning); the parent sees both in "Con sửa gần đây" and restores the timetable. Rows
 * added here are removed in `finally`.
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

test("Lịch học: the child edits the timetable + adds an extra class; the parent sees it and restores", async ({ page, browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, display_name").eq("role", "child").single();
  const { data: tt, error } = await db
    .from("timetables")
    .insert({
      family_id: kid?.family_id,
      child_id: kid?.id,
      valid_from: addDays(localDate(new Date()), -1),
      label: "LH E2E",
      periods: [{ day: 3, session: "am", n: 3, subject: "Thể dục" }],
      times: { am: { "3": "09:20-10:05" } },
      uniform: { "3": "Áo trắng", pe: "Áo xanh lá e2e" },
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const ctx = await browser.newContext();
  try {
    // The child.
    const k = await ctx.newPage();
    const { data: u } = await db.auth.admin.getUserById(kid?.id as string);
    const password = `Lh-${randomBytes(9).toString("base64url")}`;
    expect((await db.auth.admin.updateUserById(kid?.id as string, { password })).error).toBeNull();
    await login(k, u.user?.email ?? "", password);
    await k.goto("/today");
    await k.getByRole("region", { name: "Lịch của con" }).getByRole("link", { name: "Sửa lịch học" }).click();
    await k.waitForURL(/\/lich-hoc/);

    const grid = k.getByRole("region", { name: "Thời khóa biểu tuần" });
    await grid.getByRole("button", { name: "T4 tiết 3: Thể dục" }).click();
    const picker = k.getByRole("group", { name: "Chọn môn" });
    await picker.getByLabel("Môn khác").fill("Toán e2e");
    await picker.getByRole("button", { name: "Thêm", exact: true }).click();
    await expect(grid.getByRole("button", { name: "T4 tiết 3: Toán e2e" })).toBeVisible();
    await k.getByRole("button", { name: /^Lưu thời khóa biểu/ }).click();
    await expect(k.getByRole("status")).toContainText("Đã lưu");

    await k.getByRole("tab", { name: /Học thêm/ }).click();
    await k.getByRole("button", { name: "+ Học thêm" }).click();
    const sheet = k.getByRole("dialog", { name: "Học thêm" });
    await sheet.getByLabel("Môn", { exact: true }).fill("Văn e2e");
    await sheet.getByLabel("Thứ", { exact: true }).selectOption("3");
    await sheet.getByLabel("Bắt đầu", { exact: true }).fill("09:30");
    await sheet.getByLabel("Kết thúc", { exact: true }).fill("10:30");
    await expect(sheet.getByText(/^Trùng giờ/)).toBeVisible(); // 09:20–10:05 at school
    await sheet.getByRole("button", { name: "Lưu học thêm" }).click();
    await expect(k.getByRole("list", { name: "Học thêm của con" })).toContainText("Văn e2e");

    // The parent.
    await login(page, env.parentEmail, env.parentPassword);
    await page.goto("/parent/timetable");
    const recent = page.getByRole("region", { name: "Con sửa gần đây" });
    await expect(recent).toContainText("T4 tiết 3: Thể dục → Toán e2e");
    await expect(recent).toContainText("Văn e2e");
    await expect(page.getByRole("region", { name: `Học thêm của ${kid?.display_name}` })).toContainText("Văn e2e");
    const row = recent.getByRole("listitem").filter({ hasText: "Thể dục → Toán e2e" }).first();
    await row.getByRole("button", { name: "Khôi phục bản trước" }).click();
    await row.getByRole("button", { name: "Bấm lần nữa để khôi phục" }).click();
    await expect
      .poll(async () => {
        const { data } = await db.from("timetables").select("periods").eq("id", tt?.id as string).single();
        return (data?.periods as { subject: string }[] | undefined)?.[0]?.subject;
      })
      .toBe("Thể dục");
  } finally {
    await ctx.close();
    await db
      .from("extra_classes")
      .delete()
      .eq("child_id", kid?.id as string)
      .like("subject", "%e2e%");
    await db
      .from("timetables")
      .delete()
      .eq("id", tt?.id as string);
  }
});
