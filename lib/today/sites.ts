/**
 * "Trang con mở được" (parent decision 16/11/2026): what the child can open while the laptop is
 * on study pages only, so they need to ask less. READ ONLY and display only: the extension still
 * decides what opens (allowlist_entries, DESIGN §7); nothing here changes a rule.
 *
 * PURE: shapes the child's own rows (RLS: whole-family + this child) into friendly groups.
 * App slots come first with their own names; the "Thêm nhanh" bundles show by name (their
 * helper domains such as apis.google.com are hidden); what is left shows by domain.
 */
import { PRESETS } from "@/lib/admin/presets";

export interface SiteSlotRow {
  label: string;
  subject: string;
  kind: string;
  url: string | null;
  allow_domains: string[] | null;
  active: boolean;
}

export interface SiteEntryRow {
  domain: string;
  grp: string;
  expires_at: string | null;
}

export interface SiteLink {
  label: string;
  /** Under the label: the subject, the domain, or "đến 21:30". */
  sub: string | null;
  href: string;
}

export interface SiteGroup {
  title: string;
  links: SiteLink[];
}

/** Where each bundle opens, and the name the child sees (helper domains stay hidden). */
const PRESET_OPEN: Record<(typeof PRESETS)[number]["id"], { main: string; href: string }> = {
  meet: { main: "meet.google.com", href: "https://meet.google.com" },
  notebooklm: { main: "notebooklm.google.com", href: "https://notebooklm.google.com" },
  gdocs: { main: "docs.google.com", href: "https://drive.google.com" },
  zalo: { main: "zalo.me", href: "https://chat.zalo.me" },
  spotify: { main: "spotify.com", href: "https://open.spotify.com" },
};

const host = (d: string) => d.trim().toLowerCase().replace(/^\*\./, "");

function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** "21:30" in Vietnam time. */
function vnClock(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function childSites(slots: readonly SiteSlotRow[], entries: readonly SiteEntryRow[], nowMs: number, launcherHost: string | null): SiteGroup[] {
  const live = entries.filter((e) => e.grp !== "system" && (e.expires_at === null || Date.parse(e.expires_at) > nowMs));
  const covered = new Set<string>(launcherHost ? [launcherHost.toLowerCase()] : []);

  // 1. The child's app slots, by their names (they open the app itself).
  const apps: SiteLink[] = [];
  for (const s of slots) {
    if (!s.active || s.kind === "placeholder" || !s.url) continue;
    const h = hostOf(s.url);
    if (!h) continue;
    apps.push({ label: s.label, sub: s.subject || null, href: s.url });
    covered.add(h);
    for (const d of s.allow_domains ?? []) covered.add(host(d));
  }

  // 2. The "Thêm nhanh" bundles the parents turned on, by name.
  const permanent = new Set(live.filter((e) => e.expires_at === null).map((e) => host(e.domain)));
  const bundles: SiteLink[] = [];
  for (const p of PRESETS) {
    const open = PRESET_OPEN[p.id];
    if (!permanent.has(open.main)) continue;
    bundles.push({ label: p.label, sub: p.sub, href: open.href });
    for (const d of p.domains) covered.add(host(d));
  }

  // 3. Dictionaries, 4. other permanent sites, 5. opened for a while: by domain.
  const seen = new Set<string>();
  const byDomain = (rows: readonly SiteEntryRow[], sub: (e: SiteEntryRow) => string | null): SiteLink[] =>
    rows
      .map((e) => ({ e, h: host(e.domain) }))
      .filter(({ h }) => h !== "" && !covered.has(h) && !seen.has(h) && seen.add(h))
      .sort((a, b) => a.h.localeCompare(b.h))
      .map(({ e, h }) => ({ label: h, sub: sub(e), href: `https://${h}` }));
  const temporary = byDomain(
    live.filter((e) => e.expires_at !== null),
    (e) => `Bố mẹ cho mở đến ${vnClock(e.expires_at as string)}`,
  );
  const dictionaries = byDomain(
    live.filter((e) => e.expires_at === null && e.grp === "dictionary"),
    () => null,
  );
  const others = byDomain(
    live.filter((e) => e.expires_at === null && e.grp !== "dictionary"),
    () => null,
  );

  return [
    { title: "Mở tạm", links: temporary },
    { title: "App học của con", links: apps },
    { title: "Học online, tài liệu, nhắn thầy cô", links: bundles },
    { title: "Từ điển, dịch", links: dictionaries },
    { title: "Trang khác bố mẹ cho mở", links: others },
  ].filter((g) => g.links.length > 0);
}
