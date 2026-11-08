import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { localDate } from "../lib/time";
import { dossierFor } from "../lib/binhYen/dossier";

/**
 * R7c — Hồ sơ mật for Nguyên. Self-contained (helpers copied from flow.spec.ts / r7b.spec.ts;
 * flow.spec.ts runs first and creates the family and the child "Hạnh Nguyên", grade 9).
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

/** A fresh password for the child through the admin API (flow.spec.ts keeps its own in its file). */
async function childLogin(childId: string): Promise<{ email: string; password: string }> {
  const db = admin();
  const { data, error } = await db.auth.admin.getUserById(childId);
  expect(error).toBeNull();
  const password = `R7c-${randomBytes(9).toString("base64url")}`;
  expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
  return { email: data.user?.email ?? "", password };
}

/** One visit: a region → its first word → "Tận hưởng →" → "Vậy là đủ cho hôm nay". */
async function checkIn(k: Page, region: RegExp) {
  await k.goto("/binh-yen");
  await k.getByRole("button", { name: region }).click();
  const words = k.getByRole("region", { name: "Chọn từ" });
  await words.getByRole("group", { name: "Từ cảm xúc" }).getByRole("button").first().click();
  await words.getByRole("button", { name: "Tiếp →" }).click();
  await k.getByRole("region", { name: "Công nhận" }).getByRole("button", { name: "Tận hưởng →" }).click();
  await k.getByRole("region", { name: "Gợi ý cho con" }).getByRole("button", { name: "Vậy là đủ cho hôm nay" }).click();
  const done = k.getByRole("region", { name: "Xong rồi" });
  await expect(done.getByRole("heading", { name: /Xong rồi/ })).toBeVisible();
  return done;
}

test.describe.configure({ mode: "serial" });

test("R7c Nguyên: after a visit she can open today's Hồ sơ mật, switch topic, keep it, and find it in her notebook (this device only)", async ({ browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const grade = kid?.grade as number | null;
  const { data: settings } = await db.from("family_settings").select("by_enabled").eq("family_id", familyId).single();
  const { data: oldCheckins } = await db.from("by_checkins").select("*").eq("child_id", childId);
  await db.from("profiles").update({ grade: 9 }).eq("id", childId);
  await db.from("family_settings").update({ by_enabled: true }).eq("family_id", familyId);
  await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", childId).is("ended_at", null);
  try {
    const { email, password } = await childLogin(childId);
    const kCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const k = await kCtx.newPage();
    await login(k, email, password);
    const done = await checkIn(k, /^Hồ sơ lục:/);
    const today = localDate(new Date());

    // Nothing about the dossier goes to the server: no API call mentions it while she reads and keeps one.
    const sent: string[] = [];
    let listening = true;
    k.on("request", (r) => {
      if (listening && r.url().includes("/api/")) sent.push(`${r.url()} ${r.postData() ?? ""}`);
    });

    // Collapsed until tapped.
    const offer = done.getByRole("button", { name: "Mở hồ sơ mật hôm nay?" });
    await expect(offer).toBeVisible();
    await expect(offer).toHaveAttribute("aria-expanded", "false");
    await expect(done.getByRole("region", { name: "Hồ sơ mật" })).toHaveCount(0);
    await offer.click();

    const panel = done.getByRole("region", { name: "Hồ sơ mật" });
    const chips = panel.getByRole("group", { name: "Chủ đề hồ sơ" });
    await expect(chips.getByRole("button")).toHaveCount(5);
    // Default topic: Não bộ; the card heading gets the focus.
    await expect(chips.getByRole("button", { name: /Não bộ/ })).toHaveAttribute("aria-pressed", "true");
    const nao = dossierFor(today, "green", "nao");
    await expect(panel.getByRole("heading", { name: nao.title })).toBeFocused();
    await expect(panel).toContainText("HỒ SƠ MẬT");
    await expect(panel).toContainText(`Nguồn: ${nao.source}`);

    // Switch topic.
    await chips.getByRole("button", { name: /Lịch sử/ }).click();
    await expect(chips.getByRole("button", { name: /Lịch sử/ })).toHaveAttribute("aria-pressed", "true");
    await expect(chips.getByRole("button", { name: /Não bộ/ })).toHaveAttribute("aria-pressed", "false");
    const card = dossierFor(today, "green", "lich_su");
    await expect(panel.getByRole("heading", { name: card.title })).toBeVisible();
    expect(await k.evaluate(() => window.localStorage.getItem("dossier-topic"))).toBe("lich_su");

    // Keep it.
    await expect(panel.getByRole("button", { name: "Cất vào sổ tay" })).toBeEnabled();
    await panel.getByRole("button", { name: "Cất vào sổ tay" }).click();
    await expect(panel.getByRole("button", { name: "Đã cất ✓" })).toBeDisabled();

    // The notebook in the "Nhìn lại 7 ngày" column lists it; tapping opens the full card.
    const side = k.getByRole("complementary", { name: "Nhìn lại 7 ngày" });
    const notebook = side.getByRole("region", { name: "Sổ tay thám tử" });
    await expect(notebook).toContainText("Trên máy này · chỉ con thấy");
    const kept = notebook.getByRole("list", { name: "Hồ sơ đã cất" }).getByRole("listitem");
    await expect(kept).toHaveCount(1);
    await expect(kept.first()).toContainText(card.title);
    await kept.first().getByText(card.title).click();
    await expect(kept.first().getByRole("heading", { name: card.title })).toBeVisible();
    await expect(kept.first()).toContainText(card.body.slice(0, 40));

    // Đóng folds it back.
    await panel.getByRole("button", { name: "Đóng" }).click();
    await expect(done.getByRole("button", { name: "Mở hồ sơ mật hôm nay?" })).toBeFocused();
    await expect(done.getByRole("region", { name: "Hồ sơ mật" })).toHaveCount(0);

    listening = false;
    const keys = [nao.key, card.key, "dossier", "lich_su"];
    expect(sent.filter((s) => keys.some((key) => s.includes(key)))).toEqual([]);

    // Still there after a reload (this browser).
    await k.reload();
    await expect(k.getByRole("complementary", { name: "Nhìn lại 7 ngày" }).getByRole("region", { name: "Sổ tay thám tử" })).toContainText(card.title);

    await kCtx.close();
  } finally {
    await db.from("by_checkins").delete().eq("child_id", childId);
    if (oldCheckins?.length) await db.from("by_checkins").insert(oldCheckins);
    await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", childId).is("ended_at", null);
    await db.from("family_settings").update({ by_enabled: settings?.by_enabled ?? false }).eq("family_id", familyId);
    await db.from("profiles").update({ grade }).eq("id", childId);
  }
});

test("R7c An: her \"Xong rồi\" has no Hồ sơ mật and her column no notebook", async ({ browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const grade = kid?.grade as number | null;
  const { data: settings } = await db.from("family_settings").select("by_enabled").eq("family_id", familyId).single();
  const { data: oldCheckins } = await db.from("by_checkins").select("*").eq("child_id", childId);
  const { data: oldItems } = await db.from("world_items").select("*").eq("child_id", childId);
  const { data: oldMonths } = await db.from("world_months").select("*").eq("child_id", childId);
  await db.from("profiles").update({ grade: 6 }).eq("id", childId);
  await db.from("family_settings").update({ by_enabled: true }).eq("family_id", familyId);
  await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", childId).is("ended_at", null);
  try {
    const { email, password } = await childLogin(childId);
    const kCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const k = await kCtx.newPage();
    await login(k, email, password);
    const done = await checkIn(k, /^Khu rừng:/);
    await expect(done.getByRole("button", { name: "Về góc của con" })).toBeVisible();
    await expect(done.getByRole("button", { name: /hồ sơ mật/i })).toHaveCount(0);
    await expect(done.getByRole("region", { name: "Hồ sơ mật" })).toHaveCount(0);
    await expect(k.getByRole("region", { name: "Sổ tay thám tử" })).toHaveCount(0);
    await kCtx.close();
  } finally {
    await db.from("by_checkins").delete().eq("child_id", childId);
    if (oldCheckins?.length) await db.from("by_checkins").insert(oldCheckins);
    await db.from("world_items").delete().eq("child_id", childId);
    await db.from("world_months").delete().eq("child_id", childId);
    if (oldItems?.length) await db.from("world_items").insert(oldItems);
    if (oldMonths?.length) await db.from("world_months").insert(oldMonths);
    await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", childId).is("ended_at", null);
    await db.from("family_settings").update({ by_enabled: settings?.by_enabled ?? false }).eq("family_id", familyId);
    await db.from("profiles").update({ grade }).eq("id", childId);
  }
});
