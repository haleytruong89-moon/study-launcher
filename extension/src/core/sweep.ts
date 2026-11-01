/**
 * Tab sweep (docs/DESIGN.md section 7, SPEC 2.6): when the web becomes locked,
 * every open tab outside the allowlist goes to the lock page — not only new
 * navigations. Pure: the background worker (S4b) feeds it `chrome.tabs.query({})`
 * and calls `chrome.tabs.update(id, { url })` for each result.
 *
 * Browser-internal pages (chrome://, edge://, about:, extension pages) are left
 * alone; `file:`, `data:`, `view-source:` and other non-web tabs ARE redirected
 * (see domains.ts). The sweep is idempotent: running it on every locked poll is
 * safe and also catches tabs the DNR rules cannot see (e.g. `file:`).
 */

import { buildBlockedUrl } from "./blockedUrl";
import { isAllowed } from "./domains";
import type { EffectiveState } from "./sync";

export interface TabLike {
  id?: number;
  url?: string;
  pendingUrl?: string;
}

export interface TabRedirect {
  tabId: number;
  url: string;
}

/** Tabs that must be sent to the lock page for this state. Open -> []. */
export function planTabSweep(tabs: readonly TabLike[], state: EffectiveState): TabRedirect[] {
  if (!state.locked) return [];
  const out: TabRedirect[] = [];
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    // A tab is swept if its committed URL or the URL it is navigating to is not
    // allowed; the lock page shows the (first) disallowed one.
    const disallowed = [tab.pendingUrl, tab.url].find(
      (u) =>
        u !== undefined &&
        u !== "" &&
        !isAllowed(u, state.allow, state.blockAlways, state.launcherHost, { localFiles: state.allowLocalFiles }),
    );
    if (disallowed !== undefined) {
      out.push({ tabId: tab.id, url: buildBlockedUrl(state.launcherUrl, disallowed) });
    }
  }
  return out;
}

/**
 * Whether the background should sweep after moving from `prev` to `next`:
 * on any switch into locked, and while locked whenever the allow/block lists
 * changed (e.g. a 15-minute unlock of a domain expired).
 */
export function shouldSweep(prev: EffectiveState | null, next: EffectiveState): boolean {
  if (!next.locked) return false;
  if (prev === null || !prev.locked) return true;
  return (
    prev.launcherHost !== next.launcherHost ||
    prev.allow.join(",") !== next.allow.join(",") ||
    prev.blockAlways.join(",") !== next.blockAlways.join(",") ||
    prev.allowLocalFiles !== next.allowLocalFiles
  );
}
