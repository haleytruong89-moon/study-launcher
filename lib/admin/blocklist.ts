/**
 * "Luôn chặn" (V1, parent decisions 27/11/2026 D11 + D16, SQL 0031). PURE helpers.
 * Sites blocked in every state, also while the laptop is open (extension 0.4). The list is
 * family data in always_block_entries; a parent adds or removes rows in "Trang học".
 */
import { z } from "zod";

export const blockAddSchema = z.object({ domain: z.string().trim().min(1).max(300) });

/** Same rule as the extension (extension/src/core/domains.ts): the domain itself or a sub-domain. */
function hostMatchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Sign-in and the Launcher itself must keep working; blocking them would lock the child out. */
const NEVER_BLOCK = ["accounts.google.com", "google.com"] as const;

/** null = the parent may block this domain; otherwise the reason, in Vietnamese. */
export function blockDomainProblem(domain: string, launcherHost: string | null): string | null {
  if (launcherHost && hostMatchesDomain(launcherHost, domain)) {
    return `Không chặn “${domain}” được: đó là Study Launcher.`;
  }
  if (NEVER_BLOCK.some((d) => d === domain)) {
    return `Không chặn “${domain}” được: con cần nó để đăng nhập.`;
  }
  return null;
}

/** True when the host is one of the family's always-blocked domains or under one of them. */
export function isBlockedHost(host: string, domains: readonly string[]): boolean {
  return domains.some((d) => hostMatchesDomain(host, d));
}
