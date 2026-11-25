import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, env, login } from "./helpers";

/**
 * Ôn tập trong Launcher (SQL 0029): the parent uploads a review app (.html) at /parent/on-tap; it
 * opens at /on-tap/<slug> for the family with the Launcher login only, with no network for the
 * app; a child sees it in /on-tap; turned off, the child gets 404; signed out → /login.
 * Self-contained (flow.spec.ts runs first and creates the family and the child); the app row and
 * its file are removed in `finally`.
 */

const SLUG = "e2e-on-tap";
const MARK = "E2E-ON-TAP-OK";
// The app writes a mark, then tries the network: the CSP must refuse it (connect-src 'none').
const APP_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>App thử</title></head><body>
<h1 id="m">${MARK}</h1><p id="net">chưa thử</p>
<script>
fetch("/api/health").then(function(){document.getElementById("net").textContent="mở mạng được";})
  .catch(function(){document.getElementById("net").textContent="không có mạng";});
</script></body></html>`;

async function cleanup() {
  const db = admin();
  const { data } = await db.from("study_apps").select("id, file_path").eq("slug", SLUG);
  for (const row of data ?? []) {
    await db.storage.from("study-apps").remove([row.file_path as string]);
    await db.from("study_apps").delete().eq("id", row.id);
  }
}

async function childLogin(): Promise<{ email: string; password: string }> {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id").eq("role", "child").limit(1).single();
  const { data } = await db.auth.admin.getUserById(kid?.id as string);
  const password = `OnTap-${randomBytes(9).toString("base64url")}`;
  expect((await db.auth.admin.updateUserById(kid?.id as string, { password })).error).toBeNull();
  return { email: data.user?.email ?? "", password };
}

test.describe.configure({ mode: "serial" });

test("App ôn tập: upload, open with no network, the child sees it, turned off → 404, signed out → login", async ({ browser, baseURL }) => {
  await cleanup();
  try {
    // Signed out: the app address sends to the login page and comes back after.
    const anon = await browser.newPage();
    await anon.goto(`/on-tap/${SLUG}`);
    await expect(anon).toHaveURL(/\/login\?next=%2Fon-tap%2Fe2e-on-tap/);
    await anon.close();

    // Parent uploads the app.
    const parent = await browser.newPage();
    await login(parent, env.parentEmail, env.parentPassword);
    await parent.goto("/parent/on-tap");
    await parent.getByLabel("Tên app (con thấy)").fill("App thử e2e");
    await parent.locator('input[maxlength="48"]').fill(SLUG);
    await parent.getByLabel("Tệp .html").setInputFiles({ name: "app.html", mimeType: "text/html", buffer: Buffer.from(APP_HTML) });
    await parent.getByRole("button", { name: "Thêm app" }).click();
    await expect(parent.getByRole("status")).toHaveText("Đã thêm app.");
    await expect(parent.getByText(`Cả nhà · /on-tap/${SLUG}`)).toBeVisible();

    // A non-HTML file is refused.
    await parent.getByLabel("Tên app (con thấy)").fill("Không phải html");
    await parent.getByLabel("Tệp .html").setInputFiles({ name: "x.html", mimeType: "text/html", buffer: Buffer.from("%PDF-1.7 fake") });
    await parent.getByRole("button", { name: "Thêm app" }).click();
    await expect(parent.getByRole("alert")).toContainText("không phải trang .html");

    // The app page: the app runs, has no network, carries the strict headers.
    const res = await parent.goto(`/on-tap/${SLUG}`);
    expect(res?.status()).toBe(200);
    expect(res?.headers()["content-security-policy"]).toContain("connect-src 'none'");
    expect(res?.headers()["cache-control"]).toContain("no-store");
    await expect(parent.locator("#m")).toHaveText(MARK);
    await expect(parent.locator("#net")).toHaveText("không có mạng");

    // Child: sees it in Ôn tập and opens it with the Launcher login only.
    const { email, password } = await childLogin();
    const child = await browser.newPage();
    await login(child, email, password);
    await child.goto("/on-tap");
    await child.getByRole("link", { name: /App thử e2e/ }).click();
    await expect(child.locator("#m")).toHaveText(MARK);

    // Parent turns it off: the child gets 404, the parent can still try it.
    await parent.goto("/parent/on-tap");
    const row = parent.getByRole("listitem").filter({ hasText: "App thử e2e" });
    await row.getByRole("button", { name: "Tắt app" }).click();
    await expect(row.getByRole("button", { name: "Bật lại" })).toBeVisible();
    expect((await child.goto(`/on-tap/${SLUG}`))?.status()).toBe(404);
    expect((await parent.goto(`/on-tap/${SLUG}`))?.status()).toBe(200);

    // Same address again = replace the file; the old file is gone from the bucket.
    const before = (await admin().from("study_apps").select("file_path").eq("slug", SLUG).single()).data?.file_path as string;
    await parent.goto("/parent/on-tap");
    await parent.getByLabel("Thay tệp cho app có sẵn (không bắt buộc)").selectOption(SLUG);
    await parent.getByLabel("Tệp .html").setInputFiles({ name: "app.html", mimeType: "text/html", buffer: Buffer.from(APP_HTML.replace(MARK, `${MARK}-2`)) });
    await parent.getByRole("button", { name: "Thay tệp" }).click();
    await expect(parent.getByRole("status")).toHaveText("Đã thay tệp, link giữ nguyên.");
    await parent.goto(`/on-tap/${SLUG}`);
    await expect(parent.locator("#m")).toHaveText(`${MARK}-2`);
    const old = await admin().storage.from("study-apps").download(before);
    expect(old.data).toBeNull();
    expect(baseURL).toBeTruthy();
  } finally {
    await cleanup();
  }
});
