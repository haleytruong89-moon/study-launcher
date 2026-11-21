import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { addDays, isoWeekday, localDate } from "../lib/time";

/**
 * Lịch học con tự quản, Lát 2 (21/11/2026):
 * - an extra class tomorrow that gives homework on an app pulls that app's task to the top of
 *   "Thứ tự hôm nay" (no saved order), with the chip "⏰ Mai học thêm …";
 * - once the day is complete, "Chuẩn bị cho ngày mai" shows (before 19:00 too); the child ticks
 *   every row and the parent sees "Chuẩn bị cho …: ✓".
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

test("Ngày mai: app homework before tomorrow's extra class comes first; the child ticks the checklist, the parent sees ✓", async ({ page, browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, display_name").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const today = localDate(new Date());
  const tomorrow = addDays(today, 1);
  let slotId = "";
  let templateId = "";
  let timetableId = "";
  const ctx = await browser.newContext();
  try {
    // A clean day: no runs, no saved order, nothing done.
    await db.from("task_runs").delete().eq("child_id", childId).eq("local_date", today);
    await db.from("day_plans").delete().eq("child_id", childId).eq("local_date", today);
    await db.from("day_sessions").upsert({ child_id: childId, family_id: familyId, local_date: today }, { onConflict: "child_id,local_date", ignoreDuplicates: true });
    await db
      .from("day_sessions")
      .update({ day_type: "normal", disabled_template_ids: [], part1_done_at: null, part2_done_at: null, free_started_at: null })
      .eq("child_id", childId)
      .eq("local_date", today);

    const slot = await db.from("app_slots").insert({ family_id: familyId, child_id: childId, subject: "Tiếng Anh", kind: "external", label: "LH2 English OS", url: "https://lh2-os.example.com" }).select("id").single();
    expect(slot.error).toBeNull();
    slotId = slot.data?.id as string;
    const tpl = await db
      .from("task_templates")
      .insert({ family_id: familyId, child_id: childId, part: "extra", subject: "English", title: "LH2 Practice", app_slot_id: slotId, weekdays: [1, 2, 3, 4, 5, 6, 7], min_minutes: 20, sort: 99 })
      .select("id")
      .single();
    expect(tpl.error).toBeNull();
    templateId = tpl.data?.id as string;
    const tt = await db
      .from("timetables")
      .insert({
        family_id: familyId,
        child_id: childId,
        valid_from: addDays(today, -1),
        label: "LH2 E2E",
        periods: [1, 2, 3, 4, 5, 6].map((day) => ({ day, session: "am", n: 1, subject: "Toán" })),
        times: { am: { "1": "07:30-08:15" } },
        uniform: Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [String(d), "Áo LH2"])),
      })
      .select("id")
      .single();
    expect(tt.error).toBeNull();
    timetableId = tt.data?.id as string;
    expect(
      (
        await db.from("extra_classes").insert({
          family_id: familyId,
          child_id: childId,
          subject: "Tiếng Anh LH2",
          sessions: [{ day: isoWeekday(tomorrow), start: "14:00", end: "16:00" }],
          place: "center",
          bring: "Vở LH2",
          app_slot_id: slotId,
        })
      ).error,
    ).toBeNull();

    // The child: the app task is first, with its chip.
    const k = await ctx.newPage();
    const { data: u } = await db.auth.admin.getUserById(childId);
    const password = `Nm-${randomBytes(9).toString("base64url")}`;
    expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
    await login(k, u.user?.email ?? "", password);
    await k.goto("/today");
    const first = k.getByRole("list", { name: "Thứ tự hôm nay" }).getByRole("listitem").first();
    await expect(first).toContainText("LH2 Practice");
    await expect(first).toContainText("Mai học thêm Tiếng Anh LH2 14:00");

    // The day is complete → "Chuẩn bị cho ngày mai" shows, whatever the hour.
    const at = new Date(Date.now() - 60_000).toISOString();
    await db.from("day_sessions").update({ part1_done_at: at, part2_done_at: at }).eq("child_id", childId).eq("local_date", today);
    await k.reload();
    const card = k.getByRole("region", { name: "Chuẩn bị cho ngày mai" });
    await expect(card).toContainText("Sách vở 1 môn");
    await expect(card).toContainText("Áo LH2");
    await expect(card).toContainText("Làm xong English · LH2 Practice");
    const rows = card.getByRole("button", { pressed: false });
    const n = await rows.count();
    expect(n).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < n; i++) {
      await rows.first().click();
      await expect(card.getByRole("button", { pressed: true })).toHaveCount(i + 1);
    }
    await expect(card.getByRole("status")).toHaveText(/Xong chuẩn bị cặp/);

    // The parent sees it on the home page.
    await login(page, env.parentEmail, env.parentPassword);
    await page.goto("/parent");
    await expect(page.getByRole("region", { name: kid?.display_name as string })).toContainText(/Chuẩn bị cho .+: ✓ \d\d:\d\d/);
  } finally {
    await ctx.close();
    await db.from("prep_checks").delete().eq("child_id", childId);
    await db.from("extra_classes").delete().eq("child_id", childId).eq("subject", "Tiếng Anh LH2");
    if (timetableId) await db.from("timetables").delete().eq("id", timetableId);
    if (templateId) await db.from("task_templates").delete().eq("id", templateId);
    if (slotId) await db.from("app_slots").delete().eq("id", slotId);
    await db.from("day_plans").delete().eq("child_id", childId).eq("local_date", today);
    await db
      .from("day_sessions")
      .update({ part1_done_at: null, part2_done_at: null, free_started_at: null })
      .eq("child_id", childId)
      .eq("local_date", today);
  }
});
