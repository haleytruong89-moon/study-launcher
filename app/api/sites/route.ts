import { NextResponse } from "next/server";
import { childSites, type SiteEntryRow, type SiteSlotRow } from "@/lib/today/sites";
import { requireChild, serverError } from "@/lib/today/service";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function launcherHost(): string | null {
  try {
    return process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null;
  } catch {
    return null;
  }
}

/**
 * GET: "Trang con mở được" (16/11/2026). Child session only (401 / 403 otherwise). Reads with the
 * child's OWN session, so RLS returns only whole-family rows and this child's rows. Read only and
 * display only: the extension still decides what opens.
 */
export async function GET() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { db } = guard.ctx;
  try {
    const [slots, entries] = await Promise.all([
      db.from("app_slots").select("label, subject, kind, url, allow_domains, active"),
      db.from("allowlist_entries").select("domain, grp, expires_at"),
    ]);
    if (slots.error) throw new Error(slots.error.message);
    if (entries.error) throw new Error(entries.error.message);
    const groups = childSites((slots.data ?? []) as SiteSlotRow[], (entries.data ?? []) as SiteEntryRow[], Date.now(), launcherHost());
    return NextResponse.json({ groups }, { headers: NO_STORE });
  } catch (e) {
    return serverError("sites", e);
  }
}
