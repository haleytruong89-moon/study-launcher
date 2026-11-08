import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { localDate } from "../lib/time";
import { activeScienceTopics, fieldNoteFor } from "../lib/binhYen/fieldNotes";

/**
 * R7d — Sổ tay nhà khoa học for An. Self-contained (helpers copied from flow.spec.ts / r7c.spec.ts;
 * flow.spec.ts runs first and creates the family and its one child, whose grade we switch).
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
  const password = `R7d-${randomBytes(9).toString("base64url")}`;
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

/** The family's one child, its settings and the rows these tests touch (restored in `finally`). */
async function snapshot() {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, grade").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const { data: settings } = await db.from("family_settings").select("by_enabled").eq("family_id", familyId).single();
  const { data: checkins } = await db.from("by_checkins").select("*").eq("child_id", childId);
  const { data: items } = await db.from("world_items").select("*").eq("child_id", childId);
  const { data: months } = await db.from("world_months").select("*").eq("child_id", childId);
  return { childId, familyId, grade: kid?.grade as number | null, byEnabled: settings?.by_enabled ?? false, checkins, items, months };
}

async function restore(s: Awaited<ReturnType<typeof snapshot>>) {
  const db = admin();
  await db.from("by_checkins").delete().eq("child_id", s.childId);
  if (s.checkins?.length) await db.from("by_checkins").insert(s.checkins);
  await db.from("world_items").delete().eq("child_id", s.childId);
  await db.from("world_months").delete().eq("child_id", s.childId);
  if (s.items?.length) await db.from("world_items").insert(s.items);
  if (s.months?.length) await db.from("world_months").insert(s.months);
  await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", s.childId).is("ended_at", null);
  await db.from("family_settings").update({ by_enabled: s.byEnabled }).eq("family_id", s.familyId);
  await db.from("profiles").update({ grade: s.grade }).eq("id", s.childId);
}

/** Grade 6 = An (scientist voice), grade 9 = Nguyên (detective voice); the corner switched on. */
async function prepare(s: Awaited<ReturnType<typeof snapshot>>, grade: 6 | 9) {
  const db = admin();
  await db.from("profiles").update({ grade }).eq("id", s.childId);
  await db.from("family_settings").update({ by_enabled: true }).eq("family_id", s.familyId);
  await db.from("by_sessions").update({ ended_at: new Date().toISOString() }).eq("child_id", s.childId).is("ended_at", null);
}

test.describe.configure({ mode: "serial" });

test("R7d An: after a visit she can open today's Sổ tay nhà khoa học page, switch topic, keep it, and find it in her notebook (this device only)", async ({ browser }) => {
  const s = await snapshot();
  await prepare(s, 6);
  try {
    const { email, password } = await childLogin(s.childId);
    const kCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const k = await kCtx.newPage();
    await login(k, email, password);
    const done = await checkIn(k, /^Khu rừng:/);
    const today = localDate(new Date());

    // Nothing about the notebook goes to the server: no API call mentions it while she reads and keeps a page.
    const sent: string[] = [];
    let listening = true;
    k.on("request", (r) => {
      if (listening && r.url().includes("/api/")) sent.push(`${r.url()} ${r.postData() ?? ""}`);
    });

    // An gets no Hồ sơ mật; her offer is collapsed until tapped.
    await expect(done.getByRole("button", { name: /hồ sơ mật/i })).toHaveCount(0);
    const offer = done.getByRole("button", { name: "Mở sổ tay nhà khoa học hôm nay?" });
    await expect(offer).toBeVisible();
    await expect(offer).toHaveAttribute("aria-expanded", "false");
    await expect(done.getByRole("region", { name: "Sổ tay nhà khoa học" })).toHaveCount(0);
    await offer.click();

    const panel = done.getByRole("region", { name: "Sổ tay nhà khoa học" });
    const chips = panel.getByRole("group", { name: "Chủ đề sổ tay" });
    await expect(chips.getByRole("button")).toHaveCount(activeScienceTopics().length);
    // Default topic: 🐾; the card heading gets the focus.
    const animals = chips.getByRole("button", { name: /Động vật và cảm xúc/ });
    await expect(animals).toHaveAttribute("aria-pressed", "true");
    const first = fieldNoteFor(today, "green", "dong_vat");
    expect(first).not.toBeNull();
    await expect(panel.getByRole("heading", { name: first!.title })).toBeFocused();
    await expect(panel).toContainText("SỔ TAY NHÀ KHOA HỌC");
    await expect(panel).toContainText(`Nguồn: ${first!.source}`);

    // Switch topic.
    const space = chips.getByRole("button", { name: /Vũ trụ bao la/ });
    await space.click();
    await expect(space).toHaveAttribute("aria-pressed", "true");
    await expect(animals).toHaveAttribute("aria-pressed", "false");
    const card = fieldNoteFor(today, "green", "vu_tru");
    expect(card).not.toBeNull();
    await expect(panel.getByRole("heading", { name: card!.title })).toBeVisible();
    expect(await k.evaluate(() => window.localStorage.getItem("field-topic"))).toBe("vu_tru");
    // Nguyên's topic key is untouched.
    expect(await k.evaluate(() => window.localStorage.getItem("dossier-topic"))).toBeNull();

    // Keep it.
    await expect(panel.getByRole("button", { name: "Cất vào sổ tay" })).toBeEnabled();
    await panel.getByRole("button", { name: "Cất vào sổ tay" }).click();
    await expect(panel.getByRole("button", { name: "Đã cất ✓" })).toBeDisabled();
    expect(await k.evaluate(() => window.localStorage.getItem("dossier-notebook"))).toBeNull();

    // Her "Nhìn lại 7 ngày" column lists it under "Sổ tay nhà khoa học"; tapping opens the full page.
    const side = k.getByRole("complementary", { name: "Nhìn lại 7 ngày" });
    const notebook = side.getByRole("region", { name: /Sổ tay nhà khoa học/ });
    await expect(notebook).toContainText("Trên máy này · chỉ con thấy");
    const kept = notebook.getByRole("list", { name: "Trang đã cất" }).getByRole("listitem");
    await expect(kept).toHaveCount(1);
    await expect(kept.first()).toContainText(card!.title);
    await kept.first().locator("summary").click();
    await expect(kept.first().getByRole("heading", { name: card!.title })).toBeVisible();
    await expect(kept.first()).toContainText(card!.body.slice(0, 40));
    await expect(side.getByRole("region", { name: /Sổ tay thám tử/ })).toHaveCount(0);

    // Đóng folds it back.
    await panel.getByRole("button", { name: "Đóng" }).click();
    await expect(done.getByRole("button", { name: "Mở sổ tay nhà khoa học hôm nay?" })).toBeFocused();
    await expect(done.getByRole("region", { name: "Sổ tay nhà khoa học" })).toHaveCount(0);

    listening = false;
    const keys = [first!.key, card!.key, "field-notebook", "field-topic", "vu_tru", "dong_vat"];
    expect(sent.filter((x) => keys.some((key) => x.includes(key)))).toEqual([]);

    // Still there after a reload (this browser).
    await k.reload();
    await expect(k.getByRole("complementary", { name: "Nhìn lại 7 ngày" }).getByRole("region", { name: /Sổ tay nhà khoa học/ })).toContainText(card!.title);

    await kCtx.close();
  } finally {
    await restore(s);
  }
});

test("R7d Nguyên: her \"Xong rồi\" and column have no Sổ tay nhà khoa học", async ({ browser }) => {
  const s = await snapshot();
  await prepare(s, 9);
  try {
    const { email, password } = await childLogin(s.childId);
    const kCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const k = await kCtx.newPage();
    await login(k, email, password);
    const done = await checkIn(k, /^Hồ sơ lục:/);
    // Her own offer is still there; the scientist's is not.
    await expect(done.getByRole("button", { name: "Mở hồ sơ mật hôm nay?" })).toBeVisible();
    await expect(done.getByText(/sổ tay nhà khoa học/i)).toHaveCount(0);
    await expect(k.getByRole("complementary", { name: "Nhìn lại 7 ngày" }).getByRole("region", { name: /Sổ tay thám tử/ })).toBeVisible();
    await expect(k.getByRole("region", { name: /Sổ tay nhà khoa học/ })).toHaveCount(0);
    await kCtx.close();
  } finally {
    await restore(s);
  }
});
