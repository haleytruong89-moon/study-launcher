import { after, NextResponse } from "next/server";
import { EXT_UNINSTALLED, parseProof, quietOver, UNINSTALL_QUIET_MS } from "@/lib/ext/alerts";
import { extensionRemovedMessage } from "@/lib/push/messages";
import { notifyParents } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Opened by the BROWSER (not the extension) right after the extension is removed: the
 * extension set this address with chrome.runtime.setUninstallURL (S6, 01/11/2026).
 * ?k = SHA-256 of the device token (= extension_devices.token_hash) — never the token itself,
 * because the child sees this address. A hash cannot read anything (the API only accepts the
 * token), so the worst misuse is a false "đã gỡ" alert, at most once an hour per laptop.
 *
 * Always answers the same way (a redirect to a short neutral page), whether or not the proof
 * is known, so the address tells nothing. Opening it again within an hour does nothing.
 * Audit only (no column on extension_devices): the laptop is NOT revoked here.
 */
export async function GET(request: Request) {
  const done = NextResponse.redirect(new URL("/da-go-extension", request.url), { status: 303, headers: { "Cache-Control": "no-store" } });
  const proof = parseProof(new URL(request.url).searchParams.get("k"));
  if (!proof) return done;
  try {
    const admin = createAdminClient();
    const { data: device, error } = await admin
      .from("extension_devices")
      .select("id, child_id, family_id, label, revoked_at")
      .eq("token_hash", proof)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!device) return done;

    const now = new Date();
    const since = new Date(now.getTime() - UNINSTALL_QUIET_MS).toISOString();
    const { data: recent, error: recentErr } = await admin
      .from("audit_log")
      .select("created_at")
      .eq("family_id", device.family_id)
      .eq("action", EXT_UNINSTALLED)
      .eq("payload->>device_id", device.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    if (recentErr) throw new Error(recentErr.message);
    if (!quietOver(recent?.[0]?.created_at, now, UNINSTALL_QUIET_MS)) return done;

    // A laptop the parent already removed ("Gỡ") is expected to lose its extension: record, no push.
    const notify = !device.revoked_at;
    const label = (device.label as string | null) ?? "Laptop";
    const { error: insErr } = await admin.from("audit_log").insert({
      family_id: device.family_id,
      actor_id: device.child_id,
      action: EXT_UNINSTALLED,
      payload: { device_id: device.id, label, notified: notify },
    });
    if (insErr) throw new Error(insErr.message);

    if (notify) {
      const { data: kid } = await admin.from("profiles").select("display_name").eq("id", device.child_id).maybeSingle();
      const name = (kid?.display_name as string | undefined) ?? "con";
      after(() => notifyParents(device.family_id as string, extensionRemovedMessage(name, label, device.id as string)));
    }
    return done;
  } catch (e) {
    console.error("ext.uninstalled failed", e instanceof Error ? e.message : e);
    return done;
  }
}
