import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";

/**
 * "Trang con mở được" (16/11/2026): in Góc học tập the child opens a folded card and sees the
 * sites the parents allowed, grouped (here: one site opened for a while, shown with its time).
 * Read only. Self-contained; the row is removed in `finally`.
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

test("Trang con mở được: the child sees the allowed sites, a temporary one with its time", async ({ page }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const domain = "e2e-trang-mo.example";
  const until = new Date(Date.now() + 15 * 60_000).toISOString();
  const row = await db.from("allowlist_entries").insert({ family_id: kid?.family_id, child_id: kid?.id, domain, grp: "request", expires_at: until }).select("id").single();
  expect(row.error).toBeNull();
  try {
    const { data: u } = await db.auth.admin.getUserById(kid?.id as string);
    const password = `Tm-${randomBytes(9).toString("base64url")}`;
    expect((await db.auth.admin.updateUserById(kid?.id as string, { password })).error).toBeNull();
    await login(page, u.user?.email ?? "", password);
    await page.goto("/today?tab=hoc-tap");

    const card = page.getByRole("region", { name: "Trang con mở được" });
    const toggle = card.getByRole("button", { name: /Trang con mở được lúc này/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(card.getByRole("heading", { name: "Mở tạm" })).toBeVisible();
    const link = card.getByRole("link", { name: new RegExp(domain) });
    await expect(link).toHaveAttribute("href", `https://${domain}`);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toContainText(/Bố mẹ cho mở đến \d\d:\d\d/);
  } finally {
    if (row.data?.id) await db.from("allowlist_entries").delete().eq("id", row.data.id);
  }
});
