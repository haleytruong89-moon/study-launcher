import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eveningMessage } from "@/lib/push/messages";
import { notifyParents, vapidConfig } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";

/**
 * Evening reminder (S5; parent decision 01/11/2026: 21:45, only when something waits).
 * Called once a day by .github/workflows/evening-reminder.yml with the CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!vapidConfig()) return NextResponse.json({ ok: true, skipped: "push not configured" });

  try {
    const admin = createAdminClient();
    const date = localDate(new Date());
    const families = await admin.from("families").select("id");
    if (families.error) throw new Error(families.error.message);
    let sent = 0;
    for (const f of families.data ?? []) {
      const familyId = f.id as string;
      const [unreviewed, unlock, confirm] = await Promise.all([
        admin.from("task_runs").select("id", { count: "exact", head: true }).eq("family_id", familyId).eq("local_date", date).not("done_at", "is", null).is("parent_verdict", null),
        admin.from("unlock_requests").select("id", { count: "exact", head: true }).eq("family_id", familyId).eq("status", "pending"),
        admin.from("task_runs").select("id", { count: "exact", head: true }).eq("family_id", familyId).eq("local_date", date).not("confirm_requested_at", "is", null).is("done_at", null),
      ]);
      const message = eveningMessage(unreviewed.count ?? 0, (unlock.count ?? 0) + (confirm.error ? 0 : (confirm.count ?? 0)));
      if (!message) continue;
      sent += (await notifyParents(familyId, message)).sent;
    }
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error("cron evening failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
