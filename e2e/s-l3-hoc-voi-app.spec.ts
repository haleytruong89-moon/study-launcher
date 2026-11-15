import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { localDate } from "../lib/time";

/**
 * L-3 "Học với app" (parent decisions 15/11/2026, SQL 0021): a "cần chú ý" line written by the
 * tutor app's server shows on the parent's Hôm nay (one line) and on Ngày của con (a tile); the
 * child cannot read or write it, not even through the API. Self-contained (flow.spec.ts runs
 * first and creates the family and the child); the row is removed in `finally`.
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

test("L-3: the tutor's 'cần chú ý' line reaches the parent (Hôm nay + Ngày của con), never the child", async ({ page }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, display_name").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const today = localDate(new Date());
  const body = "Con thấy bài này dài, khó hiểu (e2e)";
  try {
    // Written by a server (service_role), as the tutor app will do (slice T-a).
    const { error } = await db.from("learning_attention").insert({ family_id: familyId, child_id: childId, local_date: today, source: "tutor:toan", slot: 1, body });
    expect(error).toBeNull();

    // The child: no row through the API, and no write.
    const { data: u } = await db.auth.admin.getUserById(childId);
    const password = `L3-${randomBytes(9).toString("base64url")}`;
    expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
    const child = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    expect((await child.auth.signInWithPassword({ email: u.user?.email ?? "", password })).error).toBeNull();
    const read = await child.from("learning_attention").select("id");
    expect(read.data ?? []).toHaveLength(0);
    const write = await child.from("learning_attention").insert({ family_id: familyId, child_id: childId, local_date: today, source: "tutor:toan", slot: 2, body: "tự viết" });
    expect(write.error).not.toBeNull();

    // The parent: one line under the child on Hôm nay, then the tile on Ngày của con.
    await login(page, env.parentEmail, env.parentPassword);
    await page.goto("/parent");
    const card = page.getByRole("region", { name: kid?.display_name as string });
    const lineLink = card.getByRole("link", { name: /Gia sư AI: 1 chỗ cần xem/ });
    await expect(lineLink).toBeVisible();
    await lineLink.click();
    await page.waitForURL(/\/parent\/review\?con=/);
    const tile = page.getByRole("article", { name: "Gia sư AI Toán" });
    await expect(page.getByRole("heading", { name: "Học với app" })).toBeVisible();
    await expect(tile.getByRole("list", { name: "Cần chú ý" })).toContainText(body);
  } finally {
    await db.from("learning_attention").delete().eq("child_id", childId).eq("local_date", today).eq("source", "tutor:toan");
  }
});
