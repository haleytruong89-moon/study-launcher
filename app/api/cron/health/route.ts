import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { healthMessage, silentDevices, DEVICE_SILENT_HOURS, type DeviceProblem, type DeviceRow } from "@/lib/health/check";
import { notifyParents, vapidConfig } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * C2 daily self-check (parent decision 12/11/2026). Called once a day by Vercel Cron (vercel.json,
 * 11:43 UTC; Hobby fires within that hour → about 18:00–18:59 Vietnam time) with
 * `Authorization: Bearer $CRON_SECRET`. Sends ONE push per family only when something is wrong;
 * silent when all is well. Read-only (service role on the server only); also keeps Supabase awake.
 *
 * Checks: (1) the database answers and the latest migration's table exists (day_breaks, 0014);
 * (2) push (VAPID) is configured — if not, nothing can be sent, it is only in the JSON;
 * (3) paired laptops silent for > 48 h while their child worked (lib/health/check.ts).
 * Not checked (nothing records them in the database): the weekly photo cleanup (audit_log has a
 * row only when files were deleted) and the weekly backup (GitHub Actions).
 * Limitation: when the database itself does not answer, the parents' push subscriptions cannot
 * be read either — the route answers 500 and logs; Vercel shows the failed run.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = new Date();
  const push = vapidConfig() !== null;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
    const probe = await admin.from("day_breaks").select("id").limit(1);
    if (probe.error) throw new Error(probe.error.message);
  } catch (e) {
    console.error("cron health: database check failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, checks: { database: "failed", push: push ? "ok" : "missing" } }, { status: 500 });
  }

  try {
    const since = new Date(now.getTime() - DEVICE_SILENT_HOURS * 3600_000).toISOString();
    const [devices, runs, kids] = await Promise.all([
      admin.from("extension_devices").select("id, family_id, child_id, label, last_seen_at, created_at").is("revoked_at", null),
      admin.from("task_runs").select("child_id, started_at").gte("started_at", since),
      admin.from("profiles").select("id, display_name").eq("role", "child"),
    ]);
    for (const r of [devices, runs, kids]) if (r.error) throw new Error(r.error.message);
    const names = new Map((kids.data ?? []).map((k) => [k.id as string, (k.display_name as string | null) ?? "con"]));
    const problems = silentDevices((devices.data ?? []) as DeviceRow[], (runs.data ?? []) as { child_id: string; started_at: string | null }[], names, now);

    const byFamily = new Map<string, DeviceProblem[]>();
    for (const p of problems) byFamily.set(p.familyId, [...(byFamily.get(p.familyId) ?? []), p]);
    let sent = 0;
    if (push) {
      for (const [familyId, list] of byFamily) {
        const message = healthMessage(list);
        if (message) sent += (await notifyParents(familyId, message)).sent;
      }
    }
    // Counts only: never children's names or device labels in the response or the logs.
    const result = {
      ok: true,
      checks: { database: "ok", push: push ? "ok" : "missing", silentLaptops: problems.length, photoCleanup: "not_checked", backup: "not_checked" },
      familiesWithProblems: byFamily.size,
      sent,
    };
    console.log("cron health", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (e) {
    console.error("cron health failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, checks: { database: "ok", push: push ? "ok" : "missing" } }, { status: 500 });
  }
}
