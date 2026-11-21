import { timingSafeEqual } from "node:crypto";
import { parseTutorNotify } from "@/lib/internal/tutorNotify";
import { tutorCostMessage } from "@/lib/push/messages";
import { notifyParents } from "@/lib/push/send";

export const dynamic = "force-dynamic";

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * D23 (parent decision 18/11/2026): the maths tutor app (/gia-su) asks the Launcher to push one
 * of 3 fixed money messages to the family's parents. Server-to-server only: `Authorization:
 * Bearer $TUTOR_NOTIFY_SECRET` (same value on both Vercel projects). The tutor de-duplicates
 * (usage_monthly.*_alert_sent_at), so this route stays stateless.
 */
export async function POST(request: Request) {
  const secret = process.env.TUTOR_NOTIFY_SECRET?.trim();
  if (!secret) return Response.json({ error: "not_configured" }, { status: 503 });
  if (!sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const notify = parseTutorNotify(await request.json().catch(() => null));
  if (!notify) return Response.json({ error: "bad_request" }, { status: 400 });
  const result = await notifyParents(notify.familyId, tutorCostMessage(notify));
  return Response.json({ sent: result.sent });
}
