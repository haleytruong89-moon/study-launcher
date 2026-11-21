import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { isoWeekday, localDate } from "../lib/time";

/**
 * Lịch học con tự quản, Lát 3 (21/11/2026): an extra class today shows in "Chiều nay" on Hôm nay,
 * with the free time before it. The class is late (23:50) so the strip is not over yet whenever CI
 * runs; the test is skipped in the last minutes of the day. Rows added here are removed in `finally`.
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

const vnMinutes = () => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
};

test("Chiều nay: today's extra class and the free time before it show on Hôm nay", async ({ page }) => {
  test.skip(vnMinutes() >= 23 * 60 + 55, "the strip ends at 23:59");
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const childId = kid?.id as string;
  const today = localDate(new Date());
  try {
    expect(
      (
        await db.from("extra_classes").insert({
          family_id: kid?.family_id,
          child_id: childId,
          subject: "Cờ LH3",
          sessions: [{ day: isoWeekday(today), start: "23:50", end: "23:59" }],
          place: "center",
        })
      ).error,
    ).toBeNull();
    const { data: u } = await db.auth.admin.getUserById(childId);
    const password = `Cn-${randomBytes(9).toString("base64url")}`;
    expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
    await login(page, u.user?.email ?? "", password);
    await page.goto("/today?tab=hom-nay");
    const card = page.getByRole("region", { name: "Chiều nay" });
    await expect(card).toContainText("23:50–23:59");
    await expect(card).toContainText("Cờ LH3 · Trung tâm");
    await expect(card.getByRole("list", { name: "Các khoảng chiều nay" })).toContainText("Trống");
  } finally {
    await db.from("extra_classes").delete().eq("child_id", childId).eq("subject", "Cờ LH3");
  }
});
