import { NextResponse } from "next/server";
import { z } from "zod";
import { baseDomain } from "@/lib/admin/allowlist";
import { hostnameOf } from "@/lib/admin/schemas";
import { AUTO_REASON_PREFIX, deviceFromRequest } from "@/lib/ext/device";
import { allowDomainsFor } from "@/lib/ext/payload";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate, startOfLocalDay } from "@/lib/time";

const bodySchema = z.object({ page: z.string().max(2000), frame: z.string().max(2000) });

const MAX_PER_DAY = 20;
const QUIET_DAYS = 7;

/**
 * The extension saw a frame of the same site blocked inside an allowed study page (e.g. a
 * Google widget inside Meet). It becomes a "Xin mở trang" the parent answers as usual
 * (15 min / today / always / no). Quiet by design: same site only, one open request per
 * host, nothing again for 7 days after the parent answered, at most 20 a day.
 */
export async function POST(request: Request) {
  try {
    const device = await deviceFromRequest(request);
    if (!device) return NextResponse.json({ error: "unknown device" }, { status: 401 });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
    const pageHost = hostnameOf(parsed.data.page);
    const frameHost = hostnameOf(parsed.data.frame);
    if (!pageHost || !frameHost || baseDomain(pageHost) !== baseDomain(frameHost)) return NextResponse.json({ ignored: "not same site" });

    const admin = createAdminClient();
    const now = new Date();
    const [allow, slots] = await Promise.all([
      admin.from("allowlist_entries").select("domain, child_id, expires_at").eq("family_id", device.familyId),
      admin.from("app_slots").select("child_id, url, allow_domains, active, kind").eq("family_id", device.familyId),
    ]);
    if (allow.error) throw new Error(allow.error.message);
    if (slots.error) throw new Error(slots.error.message);
    const allowed = allowDomainsFor(
      device.childId,
      now,
      (allow.data ?? []).map((r) => ({ domain: r.domain, childId: r.child_id, expiresAt: r.expires_at })),
      (slots.data ?? []).map((s) => ({ childId: s.child_id, url: s.url, allowDomains: s.allow_domains ?? [], active: s.active, kind: s.kind })),
      [],
    );
    const covered = (host: string) => allowed.some((d) => host === d || host.endsWith(`.${d}`));
    // Only frames inside a page the child may really open, and only ones still blocked.
    if (!covered(pageHost)) return NextResponse.json({ ignored: "page not allowed" });
    if (covered(frameHost)) return NextResponse.json({ ignored: "already allowed" });

    const since = new Date(now.getTime() - QUIET_DAYS * 86_400_000).toISOString();
    const { data: recent, error: recentErr } = await admin
      .from("unlock_requests")
      .select("id, status, created_at")
      .eq("child_id", device.childId)
      .eq("domain", frameHost)
      .or(`status.eq.pending,decided_at.gte.${since}`)
      .limit(1);
    if (recentErr) throw new Error(recentErr.message);
    if ((recent ?? []).length > 0) return NextResponse.json({ ignored: "already asked" });

    const { count, error: countErr } = await admin
      .from("unlock_requests")
      .select("id", { count: "exact", head: true })
      .eq("child_id", device.childId)
      .gte("created_at", startOfLocalDay(localDate(now)).toISOString())
      .like("reason", `${AUTO_REASON_PREFIX}%`);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) >= MAX_PER_DAY) return NextResponse.json({ ignored: "daily cap" });

    const { error } = await admin.from("unlock_requests").insert({
      family_id: device.familyId,
      child_id: device.childId,
      url: parsed.data.frame,
      domain: frameHost,
      reason: `${AUTO_REASON_PREFIX} một phần bên trong trang ${pageHost} bị chặn`,
    });
    // A parallel report of the same host hits the unique "one pending per site" index: fine.
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("ext.frame_block failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
