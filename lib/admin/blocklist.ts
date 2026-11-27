/**
 * "Luôn chặn" (V1, parent decisions 27/11/2026 D11 + D16, SQL 0031). PURE helpers.
 * Sites blocked in every state, also while the laptop is open (extension 0.4). The list is
 * family data in always_block_entries; a parent adds or removes rows in "Trang học".
 */
import { z } from "zod";

export const blockAddSchema = z.object({ domain: z.string().trim().min(1).max(300) });

/**
 * A block entry covers the whole site: "www." is dropped, so a pasted https://www.character.ai/
 * also blocks character.ai and beta.character.ai (allow entries do the opposite and stay narrow).
 */
export function blockDomain(domain: string): string {
  return domain.startsWith("www.") && domain.split(".").length > 2 ? domain.slice(4) : domain;
}

/** Same rule as the extension (extension/src/core/domains.ts): the domain itself or a sub-domain. */
function hostMatchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Hosts the Launcher and sign-in need in every state (the rule blocks every resource type).
 * Blocking one of them, or a parent domain of one, would lock the child out of the Launcher.
 */
const SIGN_IN_HOSTS = ["accounts.google.com", "google.com", "www.gstatic.com", "apis.google.com", "www.googleapis.com"] as const;

/** null = the parent may block this domain; otherwise the reason, in Vietnamese. */
export function blockDomainProblem(domain: string, launcherHost: string | null, backendHost: string | null = null): string | null {
  const launcher = [launcherHost, backendHost].filter((h): h is string => !!h);
  if (launcher.some((h) => hostMatchesDomain(h, domain))) {
    return `Không chặn “${domain}” được: Study Launcher cần trang này để chạy.`;
  }
  if (SIGN_IN_HOSTS.some((h) => hostMatchesDomain(h, domain))) {
    return `Không chặn “${domain}” được: con cần nó để đăng nhập.`;
  }
  return null;
}

/** True when the host is one of the family's always-blocked domains or under one of them. */
export function isBlockedHost(host: string, domains: readonly string[]): boolean {
  return domains.some((d) => hostMatchesDomain(host, d));
}
