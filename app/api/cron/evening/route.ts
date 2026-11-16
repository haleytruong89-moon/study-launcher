import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { countUnreviewed, type RunRowLite } from "@/lib/parent/extraRuns";
import { eveningMessage } from "@/lib/push/messages";
import { notifyParents, vapidConfig } from "@/lib/push/send";
import { inEveningWindow } from "@/lib/push/window";
import { createAdminClient } from "@/lib/supabase/admin";
import { weekPushMessage } from "@/lib/parent/weekDigest";
import { isoWeekday, localDate, weekStart } from "@/lib/time";
import { loadWeekStats } from "@/lib/today/week-load";

export const dynamic = "force-dynamic";

/**
 * Evening reminder (S5; only when something waits). Parent decision 07/11/2026, moved to 20:00 on
 * 15/11/2026 (L-3): called once a day by Vercel Cron (vercel.json, 13:00 UTC → fires within
 * 20:00–20:59 Vietnam), which sends
 * `Authorization: Bearer $CRON_SECRET` by itself. GitHub's schedule ran ~6 hours late, so it is
 * no longer used (the workflow stays for manual runs). Outside 20:00–23:00 Vietnam time nothing
 * is sent, whoever calls.
 *
 * L-5 (parent decision 16/11/2026): on FRIDAY the push is the weekly one instead ("Tổng kết tuần
 * …", each child's days, plus what still waits today), ONE push, sent even when nothing waits.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = new Date();
  if (!inEveningWindow(now)) return NextResponse.json({ ok: true, skipped: "outside_window" });
  if (!vapidConfig()) return NextResponse.json({ ok: true, skipped: "push not configured" });

  try {
    const admin = createAdminClient();
    const date = localDate(now);
    const friday = isoWeekday(date) === 5;
    const week = weekStart(date);
    const families = await admin.from("families").select("id");
    if (families.error) throw new Error(families.error.message);
    let sent = 0;
    for (const f of families.data ?? []) {
      const familyId = f.id as string;
      const [unreviewed, unlock, confirm, attention, rules] = await Promise.all([
        // D2 A5: every finished run of today (verdict or not), so "Làm thêm" runs can be told apart.
        admin.from("task_runs").select("id, child_id, local_date, source, template_id, started_at, done_at, parent_verdict").eq("family_id", familyId).eq("local_date", date).not("done_at", "is", null),
        admin.from("unlock_requests").select("id", { count: "exact", head: true }).eq("family_id", familyId).eq("status", "pending"),
        admin.from("task_runs").select("id", { count: "exact", head: true }).eq("family_id", familyId).eq("local_date", date).not("confirm_requested_at", "is", null).is("done_at", null),
        // L-3 (SQL 0021): what the tutor app asks the parents to look at.
        admin.from("learning_attention").select("id", { count: "exact", head: true }).eq("family_id", familyId).eq("local_date", date),
        admin.from("learning_pending_rules").select("pending").eq("family_id", familyId),
      ]);
      const tutorLook = (attention.error ? 0 : (attention.count ?? 0)) + (rules.error ? 0 : (rules.data ?? []).reduce((n, r) => n + ((r.pending as number) ?? 0), 0));
      const runs = (unreviewed.error ? [] : (unreviewed.data ?? [])) as (RunRowLite & { parent_verdict: string | null })[];
      const requests = (unlock.count ?? 0) + (confirm.error ? 0 : (confirm.count ?? 0));
      const message = friday
        ? weekPushMessage(week, await weekChildren(admin, familyId, week), { unreviewed: countUnreviewed(runs), requests, tutorLook })
        : eveningMessage(countUnreviewed(runs), requests, tutorLook);
      if (!message) continue;
      sent += (await notifyParents(familyId, message)).sent;
    }
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error("cron evening failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

/** L-5: each child's name and days "đạt" in the week (Saturday before → today, Friday). */
async function weekChildren(admin: ReturnType<typeof createAdminClient>, familyId: string, week: string): Promise<{ name: string; okDays: number }[]> {
  const kids = await admin.from("profiles").select("id, display_name, bedtime").eq("family_id", familyId).eq("role", "child").order("created_at");
  if (kids.error) return [];
  const out: { name: string; okDays: number }[] = [];
  for (const k of kids.data ?? []) {
    try {
      const stats = await loadWeekStats(admin, k.id as string, week, (k.bedtime as string | null) ?? "21:30");
      out.push({ name: k.display_name as string, okDays: stats.okDays });
    } catch (e) {
      console.error("cron week stats failed", e instanceof Error ? e.message : e);
    }
  }
  return out;
}
