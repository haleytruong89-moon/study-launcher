import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";

/**
 * 21/11/2026 parent comments on Góc học tập: the subject comes first ("English · Practice"),
 * "Ôn thi …" bài bổ sung get their own tag, the list comes before the tutor card, and the menu
 * reads Góc học tập before Hôm nay. Self-contained (flow.spec.ts creates the family first);
 * every row added here is removed in `finally`.
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

async function childLogin(childId: string): Promise<{ email: string; password: string }> {
  const db = admin();
  const { data, error } = await db.auth.admin.getUserById(childId);
  expect(error).toBeNull();
  const password = `Luong-${randomBytes(9).toString("base64url")}`;
  expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
  return { email: data.user?.email ?? "", password };
}

test("Góc học tập: subject first, “Ôn thi” tag, list before the tutor card, menu order", async ({ page }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const all = [1, 2, 3, 4, 5, 6, 7];
  const { data: rows, error } = await db
    .from("task_templates")
    .insert([
      { family_id: kid?.family_id, child_id: kid?.id, part: "extra", title: "Practice LH", subject: "English", weekdays: all, min_minutes: 20 },
      { family_id: kid?.family_id, child_id: kid?.id, part: "extra", title: "Ôn thi · Hàm số LH", subject: "Toán", weekdays: all, min_minutes: 20 },
    ])
    .select("id");
  expect(error).toBeNull();
  const ids = (rows ?? []).map((r) => r.id as string);
  try {
    const { email, password } = await childLogin(kid?.id as string);
    await login(page, email, password);

    // Menu: Góc học tập comes before Hôm nay (Góc bình yên, when on, is first).
    const nav = page.getByRole("navigation", { name: "Các mục của con" });
    await expect(nav.getByRole("link", { name: "Góc học tập" })).toBeVisible();
    const names = await nav.getByRole("link").allInnerTexts();
    const flat = names.map((n) => n.replace(/\s+/g, " ").trim());
    const at = (label: string) => flat.findIndex((n) => n.includes(label));
    expect(at("Góc học tập")).toBeGreaterThanOrEqual(0);
    expect(at("Góc học tập")).toBeLessThan(at("Hôm nay"));
    if (at("Góc bình yên") >= 0) expect(at("Góc bình yên")).toBe(0);

    await page.goto("/today?tab=hoc-tap");
    const practice = page.getByRole("listitem", { name: "English · Practice LH" });
    await expect(practice).toContainText("Bài bổ sung");
    const exam = page.getByRole("listitem", { name: "Toán · Hàm số LH" });
    await expect(exam).toContainText("Ôn thi");
    await expect(exam).not.toContainText("Ôn thi · Hàm số");

    await exam.getByRole("button").first().click();
    const work = page.getByRole("region", { name: "Khung làm bài" });
    await expect(work.getByRole("heading", { name: "Toán · Hàm số LH" })).toBeVisible();
    await expect(work).toContainText("Việc tiếp theo · Ôn thi");

    // "Thứ tự hôm nay" is above the tutor card (when the tutor is on, it sits in the right column).
    const list = await page.getByRole("heading", { name: "Thứ tự hôm nay" }).boundingBox();
    const tutor = page.getByRole("heading", { name: "Cô gia sư Toán" });
    if ((await tutor.count()) > 0) {
      const box = await tutor.boundingBox();
      expect(box && list ? box.y : 0).toBeGreaterThan(list?.y ?? 0);
    }
  } finally {
    await db.from("task_runs").delete().in("template_id", ids);
    await db.from("task_templates").delete().in("id", ids);
  }
});
