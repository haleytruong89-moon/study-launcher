import { after, NextResponse } from "next/server";
import { EXT_MISSING } from "@/lib/ext/alerts";
import { desktopBrowser } from "@/lib/ext/browser";
import { extensionMissingMessage } from "@/lib/push/messages";
import { notifyParents } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild, serverError } from "@/lib/today/service";
import { localDate, startOfLocalDay } from "@/lib/time";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function onOfficialHost(request: Request): boolean {
  try {
    const official = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").host;
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    return official !== "" && host === official;
  } catch {
    return false;
  }
}

/**
 * The child's /today page found no extension in this browser (S6, 01/11/2026): it pinged the
 * content script for a few seconds and nobody answered. Child login only.
 *
 * Answers { status }:
 *  - "ignored": not a desktop Chrome / Edge (phones / iPad can never have the extension), or
 *    the child has no paired laptop yet (nothing is expected — no daily noise before setup);
 *  - "already": already reported today (at most one record + push per child per day);
 *  - "reported": recorded in audit_log and the parents were notified.
 * The browser is re-checked from the request's own User-Agent, not from the page.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const browser = desktopBrowser(request.headers.get("user-agent"));
  if (!browser) return NextResponse.json({ status: "ignored", reason: "not desktop chrome/edge" }, { headers: NO_STORE });
  // The extension only answers on the official address (fixed at build time): a Vercel preview
  // link would always look "missing" and wake the parents for nothing.
  if (!onOfficialHost(request)) return NextResponse.json({ status: "ignored", reason: "not the official address" }, { headers: NO_STORE });

  try {
    const admin = createAdminClient();
    const now = new Date();
    const [devices, today] = await Promise.all([
      admin.from("extension_devices").select("id", { count: "exact", head: true }).eq("child_id", ctx.childId).is("revoked_at", null),
      admin
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("family_id", ctx.familyId)
        .eq("actor_id", ctx.childId)
        .eq("action", EXT_MISSING)
        .gte("created_at", startOfLocalDay(localDate(now)).toISOString()),
    ]);
    if (devices.error) throw new Error(devices.error.message);
    if (today.error) throw new Error(today.error.message);
    if ((devices.count ?? 0) === 0) return NextResponse.json({ status: "ignored", reason: "no paired laptop" }, { headers: NO_STORE });
    if ((today.count ?? 0) > 0) return NextResponse.json({ status: "already" }, { headers: NO_STORE });

    const { error } = await admin.from("audit_log").insert({
      family_id: ctx.familyId,
      actor_id: ctx.childId,
      action: EXT_MISSING,
      payload: { browser, notified: true },
    });
    if (error) throw new Error(error.message);
    after(() => notifyParents(ctx.familyId, extensionMissingMessage(ctx.displayName, browser, ctx.childId)));
    return NextResponse.json({ status: "reported" }, { headers: NO_STORE });
  } catch (e) {
    return serverError("ext.missing", e);
  }
}
