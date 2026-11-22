import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";

/**
 * "Dán học thêm" (22/11/2026): the parent pastes a child's whole list of extra classes on the
 * Thời khóa biểu page; it is saved for the child; pasting again without a subject turns it off.
 * Rows added here are removed in `finally`.
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

test("Dán học thêm: the parent pastes the list, it is saved; a subject left out is turned off", async ({ page }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, display_name").eq("role", "child").single();
  const childId = kid?.id as string;
  try {
    await login(page, env.parentEmail, env.parentPassword);
    await page.goto("/parent/timetable");
    const box = page.getByRole("region", { name: `Học thêm của ${kid?.display_name}` });
    await box.getByRole("button", { name: /Dán học thêm|Sửa bằng cách dán/ }).click();
    await box.getByLabel("Học thêm (dán nhanh)").fill(
      ["# Môn | Buổi | Ở đâu | Cô giao bài ở | Cần mang", "DHT Văn | T3 13:30-15:30; T5 14:30-16:30 | Trung tâm | | Vở văn", "DHT Gia sư | T5 T6 T7 CN 20:30-22:30 | Online | |"].join("\n"),
    );
    await expect(box.getByRole("list", { name: "Xem trước" })).toContainText("DHT Văn");
    await box.getByRole("button", { name: "Lưu học thêm" }).click();
    await expect(box.getByRole("status")).toContainText("thêm 2");
    await expect(box).toContainText("DHT Gia sư · T5 20:30–22:30");
    const { data: rows } = await db.from("extra_classes").select("subject, place, bring, active").eq("child_id", childId).like("subject", "DHT %").order("subject");
    expect(rows).toEqual([
      { subject: "DHT Gia sư", place: "online", bring: "", active: true },
      { subject: "DHT Văn", place: "center", bring: "Vở văn", active: true },
    ]);

    // The box starts with the current list; leave one subject out → it is turned off.
    await box.getByRole("button", { name: "Sửa bằng cách dán" }).click();
    const text = await box.getByLabel("Học thêm (dán nhanh)").inputValue();
    expect(text).toContain("DHT Văn | T3 13:30-15:30; T5 14:30-16:30 | Trung tâm |  | Vở văn");
    await box.getByLabel("Học thêm (dán nhanh)").fill(text.split("\n").filter((l) => !l.startsWith("DHT Gia sư")).join("\n"));
    await expect(box.getByRole("list", { name: "Xem trước" })).toContainText("Sẽ bỏ: DHT Gia sư");
    await box.getByRole("button", { name: "Lưu học thêm" }).click();
    await expect(box.getByRole("status")).toContainText("bỏ 1");
    const { data: after } = await db.from("extra_classes").select("subject, active").eq("child_id", childId).like("subject", "DHT %").order("subject");
    expect(after).toEqual([
      { subject: "DHT Gia sư", active: false },
      { subject: "DHT Văn", active: true },
    ]);
  } finally {
    await db.from("extra_classes").delete().eq("child_id", childId).like("subject", "DHT %");
  }
});
