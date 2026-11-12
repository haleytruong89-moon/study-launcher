import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { FIELD_NOTES } from "../lib/binhYen/fieldNotes";

/**
 * Đợt 4 — "Giữ sổ tay": An downloads her Sổ tay nhà khoa học to a file and loads it back after
 * the browser forgot it. Self-contained (helpers copied from r7d.spec.ts; flow.spec.ts runs first
 * and creates the family and its one child, whose grade we switch). Every row and setting
 * changed here is restored in `finally`. Nothing about the notebook may reach the server.
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
  const password = `D4-${randomBytes(9).toString("base64url")}`;
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

test("Đợt 4 An: download her notebook, lose it, load it back (merge, no server); a foreign file is refused calmly", async ({ browser }) => {
  const s = await snapshot();
  await prepare(s, 6);
  try {
    const { email, password } = await childLogin(s.childId);
    const kCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const k = await kCtx.newPage();
    await login(k, email, password);
    await checkIn(k, /^Khu rừng:/);

    const shown = FIELD_NOTES.filter((n) => !n.held);
    const [a, b] = [shown[0]!, shown[1]!];
    // Two kept pages on this device.
    await k.evaluate(
      ([ka, kb]) => window.localStorage.setItem("field-notebook", JSON.stringify([{ date: "2026-11-12", key: ka }, { date: "2026-11-10", key: kb }])),
      [a.key, b.key] as const,
    );

    const sent: string[] = [];
    k.on("request", (r) => {
      if (r.url().includes("/api/")) sent.push(`${r.url()} ${r.postData() ?? ""}`);
    });

    await k.reload();
    const side = k.getByRole("complementary", { name: "Nhìn lại 7 ngày" });
    const notebook = side.getByRole("region", { name: /Sổ tay nhà khoa học/ });
    const keep = notebook.getByRole("group", { name: "Giữ sổ tay" });
    await expect(keep).toContainText("Sổ tay chỉ nằm trên máy này. Tải về để giữ, hoặc nạp lại khi đổi máy.");
    await expect(notebook.getByRole("list", { name: "Trang đã cất" }).getByRole("listitem")).toHaveCount(2);

    // Download: ids + dates only, no card text.
    const [download] = await Promise.all([k.waitForEvent("download"), keep.getByRole("button", { name: "Tải sổ tay về máy" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^so-tay-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    const text = await readFile(path, "utf8");
    expect(JSON.parse(text)).toEqual({ version: 1, kind: "field", pages: [{ key: a.key, date: "2026-11-12" }, { key: b.key, date: "2026-11-10" }] });
    expect(text).not.toContain(a.title);

    // The browser forgets one page; loading the file brings it back and keeps the other.
    await k.evaluate((ka) => window.localStorage.setItem("field-notebook", JSON.stringify([{ date: "2026-11-12", key: ka }])), a.key);
    await k.reload();
    const keep2 = k.getByRole("complementary", { name: "Nhìn lại 7 ngày" }).getByRole("region", { name: /Sổ tay nhà khoa học/ }).getByRole("group", { name: "Giữ sổ tay" });
    await expect(keep2).toBeVisible();
    await keep2.locator('input[type="file"]').setInputFiles({ name: "so-tay.json", mimeType: "application/json", buffer: Buffer.from(text) });
    await expect(keep2.getByRole("status")).toHaveText("Đã nạp 2 trang (1 trang mới).");
    const list = k.getByRole("complementary", { name: "Nhìn lại 7 ngày" }).getByRole("list", { name: "Trang đã cất" }).getByRole("listitem");
    await expect(list).toHaveCount(2);
    await expect(list.nth(1)).toContainText(b.title);

    // Nguyên's notebook kind, or anything else: refused, nothing changes.
    const foreign = JSON.stringify({ version: 1, kind: "dossier", pages: [] });
    await keep2.locator('input[type="file"]').setInputFiles({ name: "ho-so.json", mimeType: "application/json", buffer: Buffer.from(foreign) });
    await expect(keep2.getByRole("status")).toHaveText("Tệp này không phải sổ tay của con.");
    await keep2.locator('input[type="file"]').setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{ not json") });
    await expect(keep2.getByRole("status")).toHaveText("Tệp này không phải sổ tay của con.");
    await expect(list).toHaveCount(2);
    expect(await k.evaluate(() => window.localStorage.getItem("dossier-notebook"))).toBeNull();

    // Nothing about the notebook went to the server.
    const keys = [a.key, b.key, "field-notebook", "so-tay"];
    expect(sent.filter((x) => keys.some((key) => x.includes(key)))).toEqual([]);

    await kCtx.close();
  } finally {
    await restore(s);
  }
});
