import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { escalateDue } from "@/lib/binhYen/talk";
import { vapidConfig } from "@/lib/push/send";

export const dynamic = "force-dynamic";

/**
 * Góc bình yên: re-push a signal that nobody marked "Đã thấy" after 10 minutes
 * (once per signal; needs_care only — want_talk is never re-pushed, 05/11/2026). Runs after
 * the children's own requests (/api/today, /api/by/*); this route stays for a manual run of
 * .github/workflows/by-escalate.yml with the CRON_SECRET (no schedule since 07/11/2026).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!vapidConfig()) return NextResponse.json({ ok: true, skipped: "push not configured" });
  const escalated = await escalateDue(new Date());
  return NextResponse.json({ ok: true, escalated }, { headers: { "Cache-Control": "no-store" } });
}
