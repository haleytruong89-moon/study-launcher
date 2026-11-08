import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { addDays, localDate } from "../lib/time";
import { RUNG } from "../lib/world/rung";

/**
 * R7b — Góc bình yên's "Nhìn lại 7 ngày" column. Self-contained (helpers copied from
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

const fetchStatus = (p: Page, url: string) => p.evaluate(async (u) => (await fetch(u)).status, url);

/**
 * flow.spec.ts keeps the child's password in a variable of its own file; this file gives the
 * child a fresh password through the admin API (the old one is not needed after flow.spec.ts).
 */
async function childLogin(childId: string): Promise<{ email: string; password: string }> {
  const db = admin();
  const { data, error } = await db.auth.admin.getUserById(childId);
  expect(error).toBeNull();
  const password = `R7b-${randomBytes(9).toString("base64url")}`;
  expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
  return { email: data.user?.email ?? "", password };
}

test.describe.configure({ mode: "serial" });

test("R7b An: on a laptop the Nhìn lại column shows her world and the last 7 days; the route is child-only and scientist-only", async ({ page, browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const grade = kid?.grade as number | null;
  const today = localDate(new Date());
  const yesterday = addDays(today, -1);
  const first = `${today.slice(0, 7)}-01`;
  const { data: settings } = await db.from("family_settings").select("by_enabled").eq("family_id", familyId).single();
  const { data: oldItems } = await db.from("world_items").select("*").eq("child_id", childId);
  const { data: oldMonths } = await db.from("world_months").select("*").eq("child_id", childId);
  await db.from("profiles").update({ grade: 6 }).eq("id", childId);
  await db.from("family_settings").update({ by_enabled: true }).eq("family_id", familyId);
  await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", childId).is("ended_at", null);
  await db.from("world_items").delete().eq("child_id", childId);
  await db.from("world_months").delete().eq("child_id", childId);
  try {
    expect((await db.from("world_months").insert({ family_id: familyId, child_id: childId, month: first, world_key: "rung" })).error).toBeNull();
    const row = (local_date: string, pillar: string, item_key: string) => ({ family_id: familyId, child_id: childId, local_date, pillar, world_key: "rung", item_key, variant: 0 });
    expect((await db.from("world_items").insert([row(today, "feel", "lan_hai"), row(yesterday, "study", "cho_ngan_nam")])).error).toBeNull();

    const { email, password } = await childLogin(childId);
    const kCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const k = await kCtx.newPage();
    await login(k, email, password);
    await k.goto("/binh-yen");

    const side = k.getByRole("complementary", { name: "Nhìn lại 7 ngày" });
    await expect(side).toBeVisible();
    await expect(side.getByRole("heading", { name: /Rừng nhiệt đới của / })).toBeVisible();
    const week = side.getByRole("region", { name: "7 ngày qua" });
    await expect(week.getByRole("heading", { name: "Hôm nay", exact: true })).toBeVisible();
    await expect(week.getByRole("heading", { name: "Hôm qua", exact: true })).toBeVisible();
    await expect(week).toContainText("Lan hài");
    await expect(week).toContainText("Chò ngàn năm");
    // The fact today's growth opened, behind "Điều con biết thêm".
    const lan = RUNG.things.feel.find((t) => t.key === "lan_hai")!;
    await week.getByText("Điều con biết thêm").first().click();
    await expect(week).toContainText(lan.facts[0].slice(0, 40));
    await expect(side.getByRole("link", { name: /Xem cả Rừng nhiệt đới/ })).toHaveAttribute("href", "/today?tab=tuan");

    // The route sends no feelings (no region / word keys), only the world.
    const body = await k.evaluate(async () => (await fetch("/api/world/recent")).text());
    expect(body).not.toMatch(/"quad"|"word"/);
    expect(JSON.parse(body)).toMatchObject({ today, view: { world: { key: "rung" } } });
    await kCtx.close();

    // Parents never get it.
    await login(page, env.parentEmail, env.parentPassword);
    expect(await fetchStatus(page, "/api/world/recent")).toBe(403);
  } finally {
    await db.from("world_items").delete().eq("child_id", childId);
    await db.from("world_months").delete().eq("child_id", childId);
    if (oldItems?.length) await db.from("world_items").insert(oldItems);
    if (oldMonths?.length) await db.from("world_months").insert(oldMonths);
    await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", childId).is("ended_at", null);
    await db.from("family_settings").update({ by_enabled: settings?.by_enabled ?? false }).eq("family_id", familyId);
    await db.from("profiles").update({ grade }).eq("id", childId);
  }
});

test("R7b Nguyên: the Nhìn lại column shows today's comic page (no feelings timeline); the world route is not hers", async ({ browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const grade = kid?.grade as number | null;
  const { data: settings } = await db.from("family_settings").select("by_enabled").eq("family_id", familyId).single();
  await db.from("profiles").update({ grade: 9 }).eq("id", childId);
  await db.from("family_settings").update({ by_enabled: true }).eq("family_id", familyId);
  await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", childId).is("ended_at", null);
  try {
    const { email, password } = await childLogin(childId);
    const kCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const k = await kCtx.newPage();
    await login(k, email, password);
    await k.goto("/binh-yen");

    const side = k.getByRole("complementary", { name: "Nhìn lại 7 ngày" });
    await expect(side.getByRole("heading", { name: "Trang truyện hôm nay" })).toBeVisible();
    await expect(side.getByRole("article", { name: /^Trang / })).toBeVisible();
    await expect(side.getByRole("link", { name: "Xem Tập của tuần →" })).toHaveAttribute("href", "/today?tab=tuan");
    await expect(side.getByRole("region", { name: "7 ngày qua" })).toHaveCount(0);
    expect(await fetchStatus(k, "/api/world/recent")).toBe(404);
    await kCtx.close();

    // On a phone the column is a closed "Nhìn lại 7 ngày" after the talk card.
    const pCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await pCtx.newPage();
    await login(p, email, password);
    await p.goto("/binh-yen");
    const closed = p.getByRole("complementary", { name: "Nhìn lại 7 ngày" });
    await expect(closed.getByText("Nhìn lại 7 ngày")).toBeVisible();
    await expect(closed.getByRole("heading", { name: "Trang truyện hôm nay" })).toHaveCount(0);
    await closed.getByText("Nhìn lại 7 ngày").click();
    await expect(closed.getByRole("heading", { name: "Trang truyện hôm nay" })).toBeVisible();
    await pCtx.close();
  } finally {
    await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", childId).is("ended_at", null);
    await db.from("family_settings").update({ by_enabled: settings?.by_enabled ?? false }).eq("family_id", familyId);
    await db.from("profiles").update({ grade }).eq("id", childId);
  }
});
