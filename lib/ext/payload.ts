/**
 * Body of GET /api/ext/state (DESIGN section 6/7). PURE: built from the child's day state
 * (computeDayState, server clock) and the family's allowlist rows. The extension only
 * needs open/openUntil + the domains to allow while locked.
 */
import type { DayState } from "@/lib/dayState";
import { hostnameOf, normalizeDomain } from "@/lib/admin/schemas";

export const EXT_POLL_SECONDS = 30;

export interface AllowRow {
  domain: string;
  childId: string | null;
  expiresAt: string | null;
}

export interface SlotRow {
  childId: string | null;
  url: string | null;
  allowDomains: string[];
  active: boolean;
  kind: string;
}

/**
 * Domains reachable while locked, for ONE child: family-wide + this child's allowlist rows
 * that have not expired, plus the hosts of this child's active app slots (their URL and
 * extra domains) and of today's task deep links. The launcher itself is always allowed by
 * the extension. Sorted, unique, normalised.
 */
export function allowDomainsFor(
  childId: string,
  now: Date,
  rows: AllowRow[],
  slots: SlotRow[],
  deepLinks: (string | null)[],
): string[] {
  const out = new Set<string>();
  const add = (d: string | null | undefined) => {
    const n = d ? normalizeDomain(d) : null;
    if (n) out.add(n);
  };
  for (const r of rows) {
    if (r.childId !== null && r.childId !== childId) continue;
    if (r.expiresAt !== null && new Date(r.expiresAt).getTime() <= now.getTime()) continue;
    add(r.domain);
  }
  for (const s of slots) {
    if (!s.active || s.kind === "placeholder") continue;
    if (s.childId !== null && s.childId !== childId) continue;
    if (s.url) add(hostnameOf(s.url));
    s.allowDomains.forEach(add);
  }
  for (const link of deepLinks) if (link) add(hostnameOf(link));
  return [...out].sort();
}

export interface ExtStateBody {
  open: boolean;
  openUntil: string | null;
  allow: string[];
  blockAlways: string[];
  launcherUrl: string;
  pollSeconds: number;
  serverNow: string;
  /** Family setting (0007): saved .html/.htm/.pdf files may open while locked. */
  allowLocalFiles: boolean;
  /** Extra (ignored by the core parser): for the popup. */
  status: DayState["status"];
}

/** Built in: Google's page-translation proxy (it would open any site through translate.goog). */
export const BUILTIN_BLOCK_ALWAYS = ["translate.goog"] as const;

/**
 * Domains the extension blocks in every state. V1 (27/11/2026, SQL 0031): the family's
 * "Luôn chặn" rows are added to the built-in list; extension 0.4 also blocks them while open.
 */
export function blockAlwaysFor(familyBlock: readonly string[]): string[] {
  const out = new Set<string>(BUILTIN_BLOCK_ALWAYS);
  for (const d of familyBlock) {
    const n = normalizeDomain(d);
    if (n) out.add(n);
  }
  return [...out].sort();
}

export function extStateBody(
  state: DayState,
  allow: string[],
  launcherUrl: string,
  allowLocalFiles = false,
  familyBlock: readonly string[] = [],
): ExtStateBody {
  return {
    open: state.open,
    openUntil: state.openUntil,
    allow,
    blockAlways: blockAlwaysFor(familyBlock),
    launcherUrl,
    pollSeconds: EXT_POLL_SECONDS,
    serverNow: state.serverNow,
    allowLocalFiles,
    status: state.status,
  };
}
