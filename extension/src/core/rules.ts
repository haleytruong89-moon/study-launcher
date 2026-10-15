/**
 * chrome.declarativeNetRequest dynamic rules (docs/DESIGN.md section 7).
 * Pure: builds plain JSON objects matching the DNR schema; the background worker
 * (S4b) passes them to `chrome.declarativeNetRequest.updateDynamicRules`.
 *
 * Locked:
 *   1. priority 1 — every http(s) `main_frame` navigation -> redirect to
 *      `<launcher>/blocked?u=<original URL>` (regexSubstitution, URL NOT encoded).
 *   2. priority 2 — allow `main_frame` for `requestDomains` = allowlist + launcher.
 *   3. priority 3 — block `requestDomains` = blockAlways (incl. translate.goog),
 *      wins over the allow rule.
 * Open: no rules at all.
 *
 * Only `main_frame` is redirected, so images / scripts / CDN files used by allowed
 * pages are never blocked (SPEC 2.6). DNR: the highest priority matching rule
 * wins, so (3) > (2) > (1).
 *
 * Decision (stricter, DESIGN silent): rule 3 lists every resource type, so
 * translate.goog is also blocked inside frames / as a sub-resource while locked.
 * A DNR rule without `resourceTypes` would skip main_frame, so the list is explicit.
 */

import { BLOCKED_PATH, launcherOrigin } from "./blockedUrl";

export type DnrResourceType =
  | "main_frame"
  | "sub_frame"
  | "stylesheet"
  | "script"
  | "image"
  | "font"
  | "object"
  | "xmlhttprequest"
  | "ping"
  | "csp_report"
  | "media"
  | "websocket"
  | "webtransport"
  | "webbundle"
  | "other";

export const ALL_RESOURCE_TYPES: readonly DnrResourceType[] = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other",
];

export interface DnrRule {
  id: number;
  priority: number;
  action:
    | { type: "block" }
    | { type: "allow" }
    | { type: "redirect"; redirect: { regexSubstitution: string } };
  condition: {
    regexFilter?: string;
    requestDomains?: string[];
    resourceTypes: DnrResourceType[];
  };
}

/** Stable ids: S4b removes/replaces exactly these. */
export const RULE_IDS = {
  redirectAll: 1,
  allowList: 2,
  blockAlways: 3,
} as const;

export const MANAGED_RULE_IDS: readonly number[] = Object.values(RULE_IDS);

/** Matches every http(s) URL and captures it whole for the substitution. */
export const REDIRECT_REGEX = "^(https?://.*)$";

export interface RuleInput {
  locked: boolean;
  /** Normalised allowlist (see `normalizeDomainList`). */
  allow: readonly string[];
  /** Normalised always-blocked domains, built-ins already merged in. */
  blockAlways: readonly string[];
  launcherUrl: string;
  /** Normalised launcher host. */
  launcherHost: string;
}

/** The dynamic rule set for a state. Open -> []. */
export function buildRules(input: RuleInput): DnrRule[] {
  if (!input.locked) return [];
  const origin = launcherOrigin(input.launcherUrl);
  if (origin === null) throw new Error(`invalid launcher URL: ${input.launcherUrl}`);

  const allowDomains = [...new Set([input.launcherHost, ...input.allow])].sort();
  const rules: DnrRule[] = [
    {
      id: RULE_IDS.redirectAll,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { regexSubstitution: `${origin}${BLOCKED_PATH}?u=\\1` },
      },
      condition: { regexFilter: REDIRECT_REGEX, resourceTypes: ["main_frame"] },
    },
    {
      id: RULE_IDS.allowList,
      priority: 2,
      action: { type: "allow" },
      condition: { requestDomains: allowDomains, resourceTypes: ["main_frame"] },
    },
  ];
  if (input.blockAlways.length > 0) {
    rules.push({
      id: RULE_IDS.blockAlways,
      priority: 3,
      action: { type: "block" },
      condition: {
        requestDomains: [...input.blockAlways],
        resourceTypes: [...ALL_RESOURCE_TYPES],
      },
    });
  }
  return rules;
}

/**
 * Arguments for `updateDynamicRules`: remove every currently installed dynamic
 * rule plus our managed ids (idempotent), then add the desired set.
 */
export function planRuleUpdate(
  existingRuleIds: readonly number[],
  desired: readonly DnrRule[],
): { removeRuleIds: number[]; addRules: DnrRule[] } {
  const remove = new Set<number>([...existingRuleIds, ...MANAGED_RULE_IDS]);
  return { removeRuleIds: [...remove].sort((a, b) => a - b), addRules: [...desired] };
}
