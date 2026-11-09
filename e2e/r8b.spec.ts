import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { e2eEnv } from "./env";
import { addDays, localDate } from "../lib/time";

/**
 * R8b — "Ngân hàng giờ nghỉ": focus time earns break minutes; a break uses the whole bank and
 * opens the laptop; "Học tiếp" early keeps the rest in the bank. Self-contained (helpers copied
 * from r8a.spec.ts; flow.spec.ts runs first and creates the family and the child). Today's rows of
 * the child that this test touches are saved first and restored in `finally`.
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

/** A fresh password for the child through the admin API (flow.spec.ts keeps the old one to itself). */
async function childLogin(childId: string): Promise<{ email: string; password: string }> {
  const db = admin();
  const { data, error } = await db.auth.admin.getUserById(childId);
  expect(error).toBeNull();
  const password = `R8b-${randomBytes(9).toString("base64url")}`;
  expect((await db.auth.admin.updateUserById(childId, { password })).error).toBeNull();
  return { email: data.user?.email ?? "", password };
}

type State = { status: string; open: boolean; openUntil: string | null; break: { bankMinutes: number; canStart: boolean; takenToday: number } };

async function todayState(page: Page): Promise<State> {
  const res = await page.request.get("/api/today");
  expect(res.status()).toBe(200);
  return ((await res.json()) as { state: State }).state;
}

test.describe.configure({ mode: "serial" });

test("R8b break bank: 50' of focus → “nghỉ được 10'” + “Nghỉ 10'”; the break opens the laptop; “Học tiếp” early keeps the rest; parents cannot write day_breaks", async ({ page }) => {
  // The seeded run starts 50 minutes ago: it must still be today in Vietnam.
  const vnHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  test.skip(vnHour < 1, "a 50-minute-old run would start yesterday in Vietnam");
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id").eq("role", "child").single();
  const childId = kid?.id as string;
  const familyId = kid?.family_id as string;
  const today = localDate(new Date());

  // Save what this test changes.
  const [sessionBefore, runsBefore, breaksBefore, overridesBefore, trustBefore, settingsBefore] = await Promise.all([
    db.from("day_sessions").select("*").eq("child_id", childId).eq("local_date", today).maybeSingle(),
    db.from("task_runs").select("*").eq("child_id", childId).eq("local_date", today),
    db.from("day_breaks").select("*").eq("child_id", childId).eq("local_date", today),
    db.from("overrides").select("*").eq("child_id", childId).eq("local_date", today),
    db.from("trust_state").select("*").eq("child_id", childId).maybeSingle(),
    db.from("family_settings").select("break_tiers, break_max_per_day").eq("family_id", familyId).single(),
  ]);
  expect(breaksBefore.error).toBeNull(); // migration 0014 is applied in CI
  const token = randomBytes(32).toString("base64url");
  let templateId = "";
  let homeworkId = "";
  let deviceId = "";
  try {
    // A clean, locked study day: no runs, breaks or overrides today, lock mode, default tiers.
    await db.from("task_runs").delete().eq("child_id", childId).eq("local_date", today);
    await db.from("day_breaks").delete().eq("child_id", childId).eq("local_date", today);
    await db.from("overrides").delete().eq("child_id", childId).eq("local_date", today);
    // Lock mode, not changed today (a change today would make the earlier focus not count).
    if (trustBefore.data) await db.from("trust_state").update({ mode: "lock", since: trustBefore.data.created_at }).eq("child_id", childId);
    await db.from("family_settings").update({ break_tiers: [[45, 10], [90, 30], [120, 45], [180, 60]], break_max_per_day: 6 }).eq("family_id", familyId);
    await db.from("day_sessions").upsert({ child_id: childId, family_id: familyId, local_date: today }, { onConflict: "child_id,local_date", ignoreDuplicates: true });
    await db
      .from("day_sessions")
      .update({ day_type: "normal", disabled_template_ids: [], part1_done_at: null, part2_done_at: null, free_started_at: null, pass_used_at: null, break_started_at: null, break_ended_at: null, break_skipped: false })
      .eq("child_id", childId)
      .eq("local_date", today);
    // Still some homework to do (the day stays locked) and a skill finished just now after 50'.
    const hw = await db.from("homework_items").insert({ family_id: familyId, child_id: childId, subject: "R8b Toán", due_date: addDays(today, 1) }).select("id").single();
    homeworkId = hw.data?.id as string;
    const tpl = await db
      .from("task_templates")
      .insert({ family_id: familyId, child_id: childId, part: "skill", title: "R8b Math OS", weekdays: [1, 2, 3, 4, 5, 6, 7], min_minutes: 20 })
      .select("id")
      .single();
    templateId = tpl.data?.id as string;
    const now = Date.now();
    expect(
      (
        await db.from("task_runs").insert({
          family_id: familyId,
          child_id: childId,
          local_date: today,
          source: "template",
          template_id: templateId,
          started_at: new Date(now - 50 * 60_000).toISOString(),
          done_at: new Date(now).toISOString(),
        })
      ).error,
    ).toBeNull();
    const device = await db
      .from("extension_devices")
      .insert({ family_id: familyId, child_id: childId, token_hash: createHash("sha256").update(token).digest("hex"), label: "e2e R8b" })
      .select("id")
      .single();
    deviceId = device.data?.id as string;
    const ext = async () => {
      const res = await page.request.get("/api/ext/state", { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status()).toBe(200);
      return (await res.json()) as { open: boolean; openUntil: string | null };
    };

    const { email, password } = await childLogin(childId);
    await login(page, email, password);
    await page.goto("/today");
    const status = page.getByRole("region", { name: "Trạng thái hôm nay" });
    await expect(status).toContainText(/Con đã tập trung 50' · nghỉ được 10'/);
    await expect(status).toContainText("Học thêm 40' nữa (không nghỉ) để được nghỉ 30'");
    const play = page.getByRole("list", { name: "Bốn mảng hôm nay" }).getByRole("listitem", { name: "4 · Vui chơi" });
    await expect(play).toContainText("nghỉ được 10'");
    expect((await ext()).open).toBe(false);

    // The break uses the whole bank and opens the laptop (Launcher and extension agree).
    await status.getByRole("button", { name: "Nghỉ 10'" }).click();
    await expect(status).toContainText(/Đang nghỉ · còn (9|10) phút/);
    await expect(status.getByRole("button", { name: "Học tiếp" })).toBeVisible();
    const onBreak = await todayState(page);
    expect(onBreak.status).toBe("BREAK");
    expect(onBreak.open).toBe(true);
    const extOpen = await ext();
    expect(extOpen.open).toBe(true);
    expect(Date.parse(extOpen.openUntil ?? "") - Date.now()).toBeLessThanOrEqual(10 * 60_000);
    const { data: rows } = await db.from("day_breaks").select("id, planned_minutes, ended_at").eq("child_id", childId).eq("local_date", today);
    expect(rows).toHaveLength(1);
    expect(rows?.[0]).toMatchObject({ planned_minutes: 10, ended_at: null });
    // A second "start" while it runs changes nothing (idempotent).
    expect((await page.request.post("/api/day/break", { data: { action: "start" } })).status()).toBe(200);
    expect((await db.from("day_breaks").select("id").eq("child_id", childId).eq("local_date", today)).data).toHaveLength(1);

    // Pretend 3 minutes of the break went by (server data), then "Học tiếp": 7' stay in the bank.
    await db.from("day_breaks").update({ started_at: new Date(Date.now() - 3 * 60_000).toISOString() }).eq("id", rows?.[0]?.id ?? "");
    await page.reload();
    await status.getByRole("button", { name: "Học tiếp" }).click();
    await expect(status).toContainText("Con còn 7' nghỉ để dành");
    await expect(status.getByRole("button", { name: "Nghỉ 7'" })).toBeVisible();
    const after = await todayState(page);
    expect(after.open).toBe(false);
    expect(after.break).toMatchObject({ bankMinutes: 7, canStart: true, takenToday: 1 });
    expect((await ext()).open).toBe(false);
    expect((await db.from("day_breaks").select("ended_at").eq("id", rows?.[0]?.id ?? "").single()).data?.ended_at).toBeTruthy();

    // Browsers only read day_breaks: neither a parent nor the child can write them.
    const asParent = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    expect((await asParent.auth.signInWithPassword({ email: env.parentEmail, password: env.parentPassword })).error).toBeNull();
    expect((await asParent.from("day_breaks").select("id").eq("child_id", childId).eq("local_date", today)).data).toHaveLength(1);
    const parentInsert = await asParent.from("day_breaks").insert({ family_id: familyId, child_id: childId, local_date: today, started_at: new Date().toISOString(), planned_minutes: 60 });
    expect(parentInsert.error).not.toBeNull();
    const parentUpdate = await asParent.from("day_breaks").update({ planned_minutes: 60 }).eq("child_id", childId).select("id");
    expect(parentUpdate.error).not.toBeNull();
    const asChild = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    expect((await asChild.auth.signInWithPassword({ email, password })).error).toBeNull();
    const childInsert = await asChild.from("day_breaks").insert({ family_id: familyId, child_id: childId, local_date: today, started_at: new Date().toISOString(), planned_minutes: 60 });
    expect(childInsert.error).not.toBeNull();
    expect((await db.from("day_breaks").select("planned_minutes").eq("child_id", childId).eq("local_date", today)).data).toEqual([{ planned_minutes: 10 }]);
  } finally {
    await db.from("day_breaks").delete().eq("child_id", childId).eq("local_date", today);
    if (templateId) {
      await db.from("task_runs").delete().eq("template_id", templateId);
      await db.from("task_templates").delete().eq("id", templateId);
    }
    if (homeworkId) await db.from("homework_items").delete().eq("id", homeworkId);
    if (deviceId) await db.from("extension_devices").delete().eq("id", deviceId);
    await db.from("task_runs").delete().eq("child_id", childId).eq("local_date", today);
    if (runsBefore.data?.length) await db.from("task_runs").insert(runsBefore.data);
    if (breaksBefore.data?.length) await db.from("day_breaks").insert(breaksBefore.data);
    if (overridesBefore.data?.length) await db.from("overrides").insert(overridesBefore.data);
    if (trustBefore.data) await db.from("trust_state").update({ mode: trustBefore.data.mode, since: trustBefore.data.since }).eq("child_id", childId);
    if (settingsBefore.data) await db.from("family_settings").update(settingsBefore.data).eq("family_id", familyId);
    if (sessionBefore.data) await db.from("day_sessions").upsert(sessionBefore.data, { onConflict: "child_id,local_date" });
    else await db.from("day_sessions").delete().eq("child_id", childId).eq("local_date", today);
  }
});
