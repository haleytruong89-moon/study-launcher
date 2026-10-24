/**
 * Blocked-frame report (parent decision 24/10/2026). PURE.
 * While the web is locked, a frame INSIDE an allowed study page may be blocked because it
 * comes from another host (e.g. a Google sign-in or widget frame inside Google Meet). The
 * extension reports such frames so the parent can add them with one tap ("Con nhờ").
 * To keep the list quiet (no ads / trackers), only frames of the SAME site as the page are
 * reported: x.google.com inside meet.google.com, not ads.example.net inside it.
 */
import { classifyUrl, hostMatchesAny, isAllowed } from "./domains";
import type { EffectiveState } from "./sync";

const COUNTRY_SECOND_LEVEL = new Set(["com", "edu", "gov", "net", "org", "co", "ac", "int", "info", "biz", "name", "pro", "health"]);

/** Registrable site of a host: meet.google.com -> google.com, thcs.hanoi.edu.vn -> hanoi.edu.vn. */
export function siteOf(host: string): string {
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const tld = labels[labels.length - 1] ?? "";
  const second = labels[labels.length - 2] ?? "";
  return labels.slice(tld.length === 2 && COUNTRY_SECOND_LEVEL.has(second) ? -3 : -2).join(".");
}

export interface FrameReport {
  /** Origin of the allowed page holding the frame. */
  page: string;
  /** The blocked frame's URL. */
  frame: string;
  frameHost: string;
}

/** What to report for a blocked sub-frame, or null (nothing worth asking the parent). */
export function frameReport(state: EffectiveState, initiator: string | undefined, frameUrl: string): FrameReport | null {
  if (!state.locked || !initiator) return null;
  const page = classifyUrl(initiator);
  const frame = classifyUrl(frameUrl);
  if (page.kind !== "web" || frame.kind !== "web") return null;
  if (!isAllowed(initiator, state.allow, state.blockAlways, state.launcherHost)) return null;
  if (isAllowed(frameUrl, state.allow, state.blockAlways, state.launcherHost)) return null;
  if (hostMatchesAny(frame.host, state.blockAlways)) return null;
  if (siteOf(frame.host) !== siteOf(page.host)) return null;
  return { page: initiator, frame: frameUrl, frameHost: frame.host };
}
