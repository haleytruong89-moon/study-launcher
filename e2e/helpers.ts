import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { e2eEnv } from "./env";

/** Shared e2e helpers (no test state lives here: the ordered tests keep theirs in their file). */

export const env = e2eEnv();

/** Service-role client for test setup and checks (local Supabase only). */
export const admin = () => createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } });

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  // Wait until the session cookie is set and the app has redirected away from /login.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Runs SQL on the local Supabase database (E2E_DB_URL), e.g. to age Góc bình yên rows. */
export function byPsql(sql: string): string {
  const dbUrl = process.env.E2E_DB_URL ?? "";
  expect(dbUrl, "E2E_DB_URL (local Supabase) is needed to age Góc bình yên rows").not.toBe("");
  return execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-qAt", "-c", sql], { encoding: "utf8" }).trim();
}

/** HTTP status of a same-origin JSON request made from inside the page (its cookies). */
export const byCall = (p: Page, method: string, url: string, body?: unknown) =>
  p.evaluate(
    async ([m, u, b]) => (await fetch(u as string, { method: m as string, headers: { "Content-Type": "application/json" }, body: b === undefined ? undefined : JSON.stringify(b) })).status,
    [method, url, body] as const,
  );
