/**
 * AUDIT ONLY (branch audit/screens, never merged): screenshots of every page for parents and a
 * grade-6 child, on a laptop and an iPhone, after the full e2e flow has run on the throwaway
 * local Supabase. Every step is best-effort: a missing element is noted, never fails the run.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { devices, test, type Browser, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { localDate } from "../lib/time";

const env = e2eEnv();
const OUT = "audit-shots";
const notes: string[] = [];
const admin = () => createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } });

const LAPTOP = { viewport: { width: 1366, height: 768 } };
const PHONE = devices["iPhone 13"];

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

async function shot(page: Page, name: string) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    notes.push(`${name}: ${page.url().replace(/^https?:\/\/[^/]+/, "")}`);
  } catch (e) {
    notes.push(`${name}: SCREENSHOT FAILED ${(e as Error).message.split("\n")[0]}`);
  }
}

async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    notes.push(`STEP FAILED ${name}: ${(e as Error).message.split("\n")[0]}`);
  }
}

async function ctx(browser: Browser, kind: "laptop" | "phone") {
  const c = await browser.newContext(kind === "laptop" ? LAPTOP : PHONE);
  return c.newPage();
}

test("audit screenshots", async ({ browser }) => {
  test.setTimeout(15 * 60_000);
  mkdirSync(OUT, { recursive: true });
  const db = admin();

  // A fresh grade-6 child ("Đăng An"), created by the parent the normal way.
  const parentL = await ctx(browser, "laptop");
  await login(parentL, env.parentEmail, env.parentPassword);
  const created = await parentL.evaluate(async () => {
    const r = await fetch("/api/admin/children", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: "Đăng An", grade: 6, color: "#B85A1C" }) });
    return (await r.json()) as { child?: { id: string; email: string; password: string } };
  });
  const an = created.child!;
  const { data: prof } = await db.from("profiles").select("family_id").eq("id", an.id).single();
  const familyId = prof?.family_id as string;
  const today = localDate(new Date());

  // A normal study day: two homework items due today, lock mode, Góc bình yên on.
  await db.from("family_settings").update({ by_enabled: true, by_study_minutes: 10, by_idle_lock_minutes: 5 }).eq("family_id", familyId);
  await db.from("homework_items").insert([
    { family_id: familyId, child_id: an.id, subject: "Toán", due_date: today, note: "Bài 1–5 trang 42" },
    { family_id: familyId, child_id: an.id, subject: "Tiếng Anh", due_date: today, note: "Unit 4 workbook" },
  ]);

  // ---- Parent, laptop + iPhone ----
  const parentPages = ["/parent", "/parent/review", "/parent/requests", "/parent/homework", "/parent/templates", "/parent/control", "/parent/more", "/parent/settings", "/parent/allowlist", "/parent/slots", "/parent/children", "/parent/devices", "/parent/notifications", "/parent/talk", "/parent/log"];
  for (const p of parentPages) {
    await step(`parent laptop ${p}`, async () => {
      await parentL.goto(p);
      await shot(parentL, `p-laptop${p.replace(/\//g, "_")}`);
    });
  }
  const parentP = await ctx(browser, "phone");
  await step("parent phone login", () => login(parentP, env.parentEmail, env.parentPassword));
  for (const p of parentPages) {
    await step(`parent phone ${p}`, async () => {
      await parentP.goto(p);
      await shot(parentP, `p-phone${p.replace(/\//g, "_")}`);
    });
  }

  // ---- Child An, laptop ----
  const kidL = await ctx(browser, "laptop");
  await step("login page", async () => {
    await kidL.goto("/login");
    await shot(kidL, "c-laptop_login");
  });
  await step("child laptop login", () => login(kidL, an.email, an.password));
  await step("child today", async () => {
    await kidL.goto("/today");
    await shot(kidL, "c-laptop_today");
  });
  for (const p of ["/blocked?u=https%3A%2F%2Fwww.youtube.com%2F", "/ghep-may", "/da-go-extension"]) {
    await step(`child ${p}`, async () => {
      await kidL.goto(p);
      await shot(kidL, `c-laptop${(p.split("?")[0] ?? p).replace(/\//g, "_")}`);
    });
  }

  // Góc bình yên: set an own PIN, then one visit, screenshot each step.
  await step("BY set PIN", async () => {
    await kidL.goto("/binh-yen");
    await shot(kidL, "by-01-set-pin");
    const f = kidL.getByRole("form", { name: "Đặt PIN Góc bình yên" });
    await f.getByLabel("PIN mới (6 số)").fill("246810");
    await f.getByLabel("Gõ lại PIN").fill("246810");
    await f.getByRole("button").last().click();
    await kidL.waitForTimeout(1500);
    await shot(kidL, "by-02-after-pin");
  });
  await step("BY open with PIN if asked", async () => {
    const f = kidL.getByRole("form", { name: "Mở Góc bình yên" });
    if (await f.count()) {
      await f.getByLabel("PIN Góc bình yên").fill("246810");
      await f.getByRole("button", { name: "Mở", exact: true }).click();
      await kidL.waitForTimeout(1500);
    }
    await shot(kidL, "by-03-home");
  });
  await step("BY visit", async () => {
    const home = kidL.getByRole("region", { name: "Góc của con" });
    await home.getByRole("button").filter({ hasText: /núi lửa|Núi lửa/i }).first().click();
    await kidL.waitForTimeout(500);
    await shot(kidL, "by-04-words");
    const words = kidL.getByRole("region", { name: "Chọn từ" });
    await words.getByRole("button").nth(1).click();
    await kidL.waitForTimeout(300);
    await shot(kidL, "by-05-word-meaning");
    await words.getByRole("button", { name: "Tiếp →" }).click();
    await kidL.waitForTimeout(500);
    const ack = kidL.getByRole("region", { name: "Công nhận" });
    const lvl = ack.getByRole("group", { name: "Mức độ" });
    if (await lvl.count()) await lvl.getByRole("button", { name: /^4/ }).click();
    await shot(kidL, "by-06-ack");
    await ack.getByRole("button").last().click();
    await kidL.waitForTimeout(800);
    await shot(kidL, "by-07-ideas");
    const ideas = kidL.getByRole("region", { name: "Gợi ý cho con" }).getByRole("list", { name: "3 gợi ý" }).getByRole("button");
    await ideas.nth(1).click();
    await kidL.waitForTimeout(800);
    await shot(kidL, "by-08-activity");
    await kidL.getByRole("button", { name: "Xong", exact: true }).first().click();
    await kidL.waitForTimeout(1200);
    await shot(kidL, "by-09-done");
    await kidL.getByRole("button", { name: /Về góc của con/ }).click();
    await kidL.waitForTimeout(800);
    await shot(kidL, "by-10-home-after");
  });
  await step("today after BY", async () => {
    await kidL.goto("/today");
    await shot(kidL, "c-laptop_today_after");
  });

  // ---- Child An, iPhone ----
  const kidP = await ctx(browser, "phone");
  await step("child phone login", () => login(kidP, an.email, an.password));
  for (const p of ["/today", "/binh-yen"]) {
    await step(`child phone ${p}`, async () => {
      await kidP.goto(p);
      await shot(kidP, `c-phone${p.replace(/\//g, "_")}`);
    });
  }

  writeFileSync(`${OUT}/NOTES.txt`, notes.join("\n") + "\n");
});
