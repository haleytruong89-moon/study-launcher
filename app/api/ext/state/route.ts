import { NextResponse } from "next/server";
import { allowDomainsFor, extStateBody } from "@/lib/ext/payload";
import { deviceFromRequest } from "@/lib/ext/device";
import { createAdminClient } from "@/lib/supabase/admin";
import { readToday, type ChildContext } from "@/lib/today/service";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function launcherUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  try {
    if (configured) return new URL(configured).origin;
  } catch {
    /* fall through */
  }
  return new URL(request.url).origin;
}

/**
 * Polled by the extension every 30 s with its device token (Authorization: Bearer).
 * Same computeDayState as the Launcher, on the SERVER clock, and the same lazily written
 * milestones (so free time starts once even if only the extension is polling).
 * Any error -> non-200, which the extension counts as a failed poll (2 in a row = locked).
 */
export async function GET(request: Request) {
  try {
    const admin = createAdminClient();
    const found = await deviceFromRequest(request);
    if (!found) return NextResponse.json({ error: "unknown device" }, { status: 401, headers: NO_STORE });
    const device = { id: found.id, child_id: found.childId, family_id: found.familyId };

    // The child's day, read with service_role but filtered to this child only (server-side).
    const ctx: ChildContext = { childId: device.child_id, familyId: device.family_id, displayName: "", grade: null, color: null, db: admin };
    const now = new Date();
    const { state } = await readToday(ctx, now);

    const [allow, slots, files] = await Promise.all([
      admin.from("allowlist_entries").select("domain, child_id, expires_at").eq("family_id", device.family_id),
      admin.from("app_slots").select("child_id, url, allow_domains, active, kind").eq("family_id", device.family_id),
      // 0007 setting; before that migration the read fails and files stay blocked.
      admin.from("family_settings").select("allow_local_files").eq("family_id", device.family_id).maybeSingle(),
    ]);
    if (allow.error) throw new Error(allow.error.message);
    if (slots.error) throw new Error(slots.error.message);
    const domains = allowDomainsFor(
      device.child_id,
      now,
      (allow.data ?? []).map((r) => ({ domain: r.domain, childId: r.child_id, expiresAt: r.expires_at })),
      (slots.data ?? []).map((s) => ({ childId: s.child_id, url: s.url, allowDomains: s.allow_domains ?? [], active: s.active, kind: s.kind })),
      [...state.part1.items, ...state.part2.items].map((i) => i.deepLink),
    );

    // The extension reports whether it may run in InPrivate / incognito windows.
    const incognito = request.headers.get("x-incognito-allowed");
    await admin
      .from("extension_devices")
      .update({ last_seen_at: now.toISOString(), ...(incognito === "1" || incognito === "0" ? { incognito_allowed: incognito === "1" } : {}) })
      .eq("id", device.id);
    const allowLocalFiles = !files.error && files.data?.allow_local_files === true;
    return NextResponse.json(extStateBody(state, domains, launcherUrl(request), allowLocalFiles), { headers: NO_STORE });
  } catch (e) {
    console.error("ext.state failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server" }, { status: 500, headers: NO_STORE });
  }
}
