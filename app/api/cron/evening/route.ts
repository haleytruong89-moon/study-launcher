import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { countUnreviewed, type RunRowLite } from "@/lib/parent/extraRuns";
import { eveningMessage } from "@/lib/push/messages";
import { notifyParents, vapidConfig } from "@/lib/push/send";
import { inEveningWindow } from "@/lib/push/window";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Evening reminder (S5; only when something waits). Parent decision 07/11/2026: called once a
 * day by Vercel Cron (vercel.json, 14:00 UTC → fires within 21:00–21:59 Vietnam), which sends
 * `Authorization: Bearer $CRON_SECRET` by itself. GitHub's schedule ran ~6 hours late, so it is
 * no longer used (the workflow stays for manual runs). Outside 20:00–23:00 Vietnam time nothing
 * is sent, whoever calls.
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
    const families = await admin.from("families").select("id");
    if (families.error) throw new Error(families.error.message);
    let sent = 0;
    for (const f of families.data ?? []) {
      const familyId = f.id as string;
      const [unreviewed, unlock, confirm] = await Promise.all([
        // D2 A5: every finished run of today (verdict or not), so "Làm thêm" runs can be told apart.
        admin.from("task_runs").select("id, child_id, local_date, source, template_id, started_at, done_at, parent_verdict").eq("family_id", familyId).eq("local_date", date).not("done_at", "is", null),
        admin.from("unlock_requests").select("id", { count: "exact", head: true }).eq("family_id", familyId).eq("status", "pending"),
        admin.from("task_runs").select("id", { count: "exact", head: true }).eq("family_id", familyId).eq("local_date", date).not("confirm_requested_at", "is", null).is("done_at", null),
      ]);
      const runs = (unreviewed.error ? [] : (unreviewed.data ?? [])) as (RunRowLite & { parent_verdict: string | null })[];
      const message = eveningMessage(countUnreviewed(runs), (unlock.count ?? 0) + (confirm.error ? 0 : (confirm.count ?? 0)));
      if (!message) continue;
      sent += (await notifyParents(familyId, message)).sent;
    }
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error("cron evening failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
