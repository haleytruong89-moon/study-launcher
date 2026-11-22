import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { addDays, isoWeekday, localDate, weekStart } from "../lib/time";

/**
 * "Lịch của con" step 1 (14/11/2026): the read-only calendar under the work panel of Góc học
 * tập. Self-contained (helpers copied from r8a.spec.ts; flow.spec.ts runs first and creates the
 * family and the child). Every row changed here is restored in `finally`.
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
  const password = `Lich-${randomBytes(9).toString("base64url")}`;
  expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
  return { email: data.user?.email ?? "", password };
}

const WEEKDAY_LONG = ["", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
/** The start of a day button's accessible name, e.g. "Thứ Tư 12/11:" (app: dayAria). */
const dayName = (date: string) => `${WEEKDAY_LONG[isoWeekday(date)]} ${date.slice(8, 10)}/${date.slice(5, 7)}:`;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dayButton = (scope: ReturnType<Page["getByRole"]>, date: string) => scope.getByRole("button", { name: new RegExp(`^(Hôm nay, )?${escape(dayName(date))}`) });

test.describe.configure({ mode: "serial" });

test("Lịch của con: Tuần / Tháng, tap a day to see the homework due and “Kiểm tra”; no ✓ marks; the choice is remembered", async ({ page }) => {
  const vnHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  test.skip(vnHour < 1, "dates are computed around midnight in Vietnam");
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const today = localDate(new Date());
  const hwDate = addDays(today, 2);
  const examDate = addDays(today, 3);
  const title = "Lịch E2E Hóa học";
  const { data: beforeExam } = await db.from("day_sessions").select("*").eq("child_id", childId).eq("local_date", examDate).maybeSingle();
  let homeworkId: string | null = null;
  try {
    const hw = await db
      .from("homework_items")
      .insert({ family_id: familyId, child_id: childId, subject: title, due_date: hwDate, note: "Bài 5 trang 61" })
      .select("id")
      .single();
    expect(hw.error).toBeNull();
    homeworkId = hw.data?.id as string;
    const exam = await db.from("day_sessions").upsert({ child_id: childId, family_id: familyId, local_date: examDate, day_type: "exam" }, { onConflict: "child_id,local_date" });
    expect(exam.error).toBeNull();

    const { email, password } = await childLogin(childId);
    await login(page, email, password);
    // 22/11/2026: the full calendar (Tuần table + Tháng) is on Hôm nay.
    await page.goto("/today?tab=hom-nay");

    const card = page.getByRole("region", { name: "Lịch của con" });
    await expect(card).toBeVisible();
    // The legend is three separate chips (no spaces between them in textContent).
    for (const label of ["Hạn nộp bài", "Kiểm tra", "Học thêm"]) await expect(card).toContainText(label);
    await expect(card.getByRole("button", { name: "Tuần", exact: true })).toHaveAttribute("aria-pressed", "true");
    // 22/11/2026: on Sunday the table opens on next week; one step back is this week.
    if (isoWeekday(today) === 7) {
      await expect(card.getByRole("group", { name: "Tuần tới" })).toBeVisible();
      await card.getByRole("button", { name: "Tuần trước" }).click();
    }
    const week = card.getByRole("group", { name: "Tuần này" });
    await expect(week.getByRole("button")).toHaveCount(7);
    await expect(week).not.toContainText("✓");
    await expect(week.getByRole("button", { name: /^Hôm nay, / })).toHaveCount(1);

    // Tuần: only when the seeded dates fall in this week (Mon–Sun).
    const sunday = addDays(weekStart(today), 6);
    if (hwDate <= sunday) {
      const b = dayButton(week, hwDate);
      await expect(b).toHaveAccessibleName(/\d+ việc/);
      await b.click();
      await expect(card.getByRole("region", { name: `Việc ${dayName(hwDate).slice(0, -1)}` })).toContainText(`Hạn nộp: ${title}`);
    }
    if (examDate <= sunday) {
      await dayButton(week, examDate).click();
      await expect(card.getByRole("region", { name: `Việc ${dayName(examDate).slice(0, -1)}` })).toContainText("Kiểm tra");
    }

    // Tháng: go to the month of each date (this month or the next), tap it, read the list.
    await card.getByRole("button", { name: "Tháng", exact: true }).click();
    await expect(card.getByRole("button", { name: "Tháng", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByRole("button", { name: "Tháng trước" })).toBeDisabled();
    for (const [date, text] of [
      [hwDate, `Hạn nộp: ${title}`],
      [examDate, "Kiểm tra"],
    ] as const) {
      const monthLabel = `Tháng ${Number(date.slice(5, 7))}/${date.slice(0, 4)}`;
      if (date.slice(0, 7) !== today.slice(0, 7)) await card.getByRole("button", { name: "Tháng sau" }).click();
      const grid = card.getByRole("group", { name: monthLabel });
      await expect(grid).toBeVisible();
      await dayButton(grid, date).click();
      await expect(card.getByRole("region", { name: `Việc ${dayName(date).slice(0, -1)}` })).toContainText(text);
      if (date.slice(0, 7) !== today.slice(0, 7)) await card.getByRole("button", { name: "Tháng trước" }).click();
    }

    // The choice is remembered on this laptop.
    await page.reload();
    await expect(page.getByRole("region", { name: "Lịch của con" }).getByRole("button", { name: "Tháng", exact: true })).toHaveAttribute("aria-pressed", "true");
  } finally {
    if (homeworkId) await db.from("homework_items").delete().eq("id", homeworkId);
    if (beforeExam) await db.from("day_sessions").upsert(beforeExam, { onConflict: "child_id,local_date" });
    else await db.from("day_sessions").delete().eq("child_id", childId).eq("local_date", examDate);
  }
});

test("22/11/2026: the wide week table shows the school lessons, the uniform and the extra classes", async ({ page }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const today = localDate(new Date());
  let timetableId = "";
  try {
    const tt = await db
      .from("timetables")
      .insert({
        family_id: familyId,
        child_id: childId,
        valid_from: addDays(today, -7),
        label: "LH4 E2E",
        periods: [1, 2, 3, 4, 5, 6].flatMap((day) => [
          { day, session: "am", n: 1, subject: "LH4 Toán" },
          { day, session: "am", n: 2, subject: "LH4 Toán" },
          { day, session: "pm", n: 1, subject: "LH4 Anh" },
        ]),
        times: {},
        uniform: Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [String(d), "Áo LH4"])),
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
          subject: "LH4 Cờ vua",
          sessions: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, start: "19:00", end: "20:00" })),
          place: "online",
        })
      ).error,
    ).toBeNull();

    const { email, password } = await childLogin(childId);
    await login(page, email, password);
    // Góc học tập has the short card; "Xem cả tuần ›" opens the wide table on Hôm nay.
    await page.goto("/today?tab=hoc-tap");
    const small = page.getByRole("region", { name: "Lịch của con" });
    await expect(small.getByRole("link", { name: "Sửa lịch học" })).toBeVisible();
    await small.getByRole("button", { name: "Xem cả tuần ›" }).click();
    await expect(page).toHaveURL(/tab=hom-nay/);
    const card = page.getByRole("region", { name: "Lịch của con" });
    await card.getByRole("button", { name: "Tuần", exact: true }).click();
    const week = card.getByRole("group", { name: isoWeekday(today) === 7 ? "Tuần tới" : "Tuần này" });
    await expect(week).toContainText("LH4 Toán ×2");
    await expect(week).toContainText("LH4 Anh");
    await expect(week).toContainText("Áo LH4");
    await expect(week).toContainText("LH4 Cờ vua");
    // A tapped day lists everything, with the place.
    await week.getByRole("button").first().click();
    await expect(card.getByRole("region", { name: /^Việc / })).toContainText("Sáng: LH4 Toán ×2");
    await expect(card.getByRole("region", { name: /^Việc / })).toContainText("19:00–20:00 · Online");
  } finally {
    await db.from("extra_classes").delete().eq("child_id", childId).eq("subject", "LH4 Cờ vua");
    if (timetableId) await db.from("timetables").delete().eq("id", timetableId);
  }
});
