/**
 * Fail-closed sync state machine for the extension (docs/DESIGN.md section 7,
 * docs/SPEC.md 2.6 "Khóa web").
 *
 * Pure: no chrome.* calls and NO CLOCK. Time never enters these functions; the
 * only durations used are server timestamps from the payload (openUntil -
 * serverNow). Changing the laptop clock therefore cannot change any decision.
 *
 *   reduceSync(state, event)        -> next stored state (chrome.storage.local)
 *   effectiveState(state, fallback) -> what to enforce now (rules + tab sweep)
 *   planAlarms(state)               -> chrome.alarms to (re)create after a poll
 *
 * Rules:
 *  - Count CONSECUTIVE failed polls. >= 2 -> locked with the last stored allowlist.
 *    1 failure -> keep the last server decision (a single network blip does not lock).
 *  - `openUntil` is trusted only while the latest poll succeeded (failures === 0).
 *  - Never synced (or storage unreadable) -> locked, only the launcher is allowed.
 *
 * Decisions where DESIGN was silent (stricter option chosen — confirm with parent):
 *  - Browser start ("startup" event): the stored state is from an earlier session
 *    and may be hours old, so it is UNCONFIRMED -> locked with the stored allowlist
 *    until the first successful poll (normally a few seconds).
 *  - When the `openUntil` alarm fires the window is treated as ended -> locked
 *    until a successful poll says otherwise (the local timer is only ever used to
 *    lock EARLIER, never to stay open longer).
 *  - A "successful" response whose body is malformed counts as a FAILURE.
 *  - `pollSeconds` from the server is clamped to [30, 60] so the SPEC "≤ 60 s"
 *    criteria hold even if the server sends a larger value.
 *  - `translate.goog` is always added to blockAlways, even if the server omits it.
 *  - blockAlways entries that would cover the launcher host itself are ignored, so
 *    the lock page / Launcher can never be blocked.
 */

import { launcherOrigin } from "./blockedUrl";
import {
  BUILTIN_BLOCK_ALWAYS,
  hostMatchesDomain,
  normalizeDomainList,
  normalizeHost,
} from "./domains";

/** Body of `GET /api/ext/state` (DESIGN section 6). */
export interface ExtStatePayload {
  open: boolean;
  openUntil: string | null;
  allow: string[];
  blockAlways: string[];
  launcherUrl: string;
  pollSeconds: number;
  serverNow: string;
  /** Family setting (0007): saved .html/.htm/.pdf files may open while locked. Missing -> false. */
  allowLocalFiles: boolean;
}

export const FAIL_CLOSED_AFTER_FAILURES = 2;
export const MIN_POLL_SECONDS = 30;
export const MAX_POLL_SECONDS = 60;
const DEFAULT_POLL_SECONDS = 60;
const MAX_COUNTED_FAILURES = 1000;

/** Persisted in chrome.storage.local. */
export interface SyncState {
  v: 1;
  /** Last successfully parsed server payload. */
  lastGood: ExtStatePayload | null;
  /** Consecutive failed polls since the last success. */
  failures: number;
  /** A poll succeeded in this browser session and its window has not ended. */
  confirmed: boolean;
}

export type SyncEvent =
  | { type: "pollSucceeded"; payload: ExtStatePayload }
  | { type: "pollFailed" }
  | { type: "startup" }
  | { type: "openUntilReached"; openUntil: string };

export type LockReason =
  | "no-host-access"
  | "server-open"
  | "server-locked"
  | "never-synced"
  | "unconfirmed"
  | "offline";

export interface EffectiveState {
  locked: boolean;
  reason: LockReason;
  /** Normalised allowlist (launcher not included). */
  allow: string[];
  /** Normalised always-blocked domains (built-ins included). */
  blockAlways: string[];
  /** Launcher origin, e.g. `https://launcher.example`. */
  launcherUrl: string;
  launcherHost: string;
  /** Only set when open AND the latest poll succeeded. */
  openUntil: string | null;
  failures: number;
  /** Saved .html/.htm/.pdf files stay open while locked (family setting). */
  allowLocalFiles: boolean;
  /** false = the extension lost access to sites (see `withHostAccess`). */
  hostAccess?: boolean;
}

export function initialSyncState(): SyncState {
  return { v: 1, lastGood: null, failures: 0, confirmed: false };
}

function isIsoInstant(v: unknown): v is string {
  return typeof v === "string" && Number.isFinite(Date.parse(v));
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/** Validates the server body. Anything unexpected -> null (treat as a failed poll). */
export function parseExtStatePayload(raw: unknown): ExtStatePayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.open !== "boolean") return null;
  if (r.openUntil !== null && !isIsoInstant(r.openUntil)) return null;
  if (!isStringArray(r.allow) || !isStringArray(r.blockAlways)) return null;
  if (typeof r.launcherUrl !== "string" || launcherOrigin(r.launcherUrl) === null) return null;
  if (typeof r.pollSeconds !== "number" || !Number.isFinite(r.pollSeconds) || r.pollSeconds <= 0) {
    return null;
  }
  if (!isIsoInstant(r.serverNow)) return null;
  return {
    open: r.open,
    openUntil: r.openUntil,
    allow: [...r.allow],
    blockAlways: [...r.blockAlways],
    launcherUrl: r.launcherUrl,
    pollSeconds: r.pollSeconds,
    serverNow: r.serverNow,
    allowLocalFiles: r.allowLocalFiles === true,
  };
}

/** Reads a stored value; anything unreadable -> initial (never-synced) state. */
export function parseSyncState(raw: unknown): SyncState {
  if (typeof raw !== "object" || raw === null) return initialSyncState();
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return initialSyncState();
  const lastGood = r.lastGood === null ? null : parseExtStatePayload(r.lastGood);
  if (r.lastGood !== null && lastGood === null) return initialSyncState();
  const failures =
    typeof r.failures === "number" && Number.isInteger(r.failures) && r.failures >= 0
      ? Math.min(r.failures, MAX_COUNTED_FAILURES)
      : FAIL_CLOSED_AFTER_FAILURES; // unknown count -> assume offline
  const confirmed = r.confirmed === true;
  return { v: 1, lastGood, failures, confirmed };
}

export function reduceSync(state: SyncState, event: SyncEvent): SyncState {
  switch (event.type) {
    case "pollSucceeded":
      return { v: 1, lastGood: event.payload, failures: 0, confirmed: true };
    case "pollFailed":
      return { ...state, failures: Math.min(state.failures + 1, MAX_COUNTED_FAILURES) };
    case "startup":
      return { ...state, confirmed: false };
    case "openUntilReached": {
      const g = state.lastGood;
      // A stale alarm (window already replaced by a newer server answer) is ignored.
      if (g === null || !g.open || g.openUntil !== event.openUntil) return state;
      return { ...state, confirmed: false };
    }
  }
}

function resolveLauncher(state: SyncState, fallbackLauncherUrl: string): {
  launcherUrl: string;
  launcherHost: string;
} {
  for (const candidate of [state.lastGood?.launcherUrl, fallbackLauncherUrl]) {
    if (candidate === undefined) continue;
    const origin = launcherOrigin(candidate);
    if (origin === null) continue;
    const host = normalizeHost(new URL(origin).hostname);
    if (host !== null) return { launcherUrl: origin, launcherHost: host };
  }
  throw new Error("no valid launcher URL (fallbackLauncherUrl must be http(s))");
}

/**
 * What the extension must enforce right now.
 * `fallbackLauncherUrl` = launcher from pairing / build config, used until the
 * server has told us its launcherUrl.
 */
export function effectiveState(state: SyncState, fallbackLauncherUrl: string): EffectiveState {
  const { launcherUrl, launcherHost } = resolveLauncher(state, fallbackLauncherUrl);
  const g = state.lastGood;
  const blockAlways = normalizeDomainList([...BUILTIN_BLOCK_ALWAYS, ...(g?.blockAlways ?? [])])
    .filter((d) => !hostMatchesDomain(launcherHost, d));
  const base = { blockAlways, launcherUrl, launcherHost, failures: state.failures, allowLocalFiles: g?.allowLocalFiles === true };

  if (g === null) {
    return { ...base, locked: true, reason: "never-synced", allow: [], openUntil: null };
  }
  const allow = normalizeDomainList(g.allow);
  if (state.failures >= FAIL_CLOSED_AFTER_FAILURES) {
    return { ...base, locked: true, reason: "offline", allow, openUntil: null };
  }
  if (!state.confirmed) {
    return { ...base, locked: true, reason: "unconfirmed", allow, openUntil: null };
  }
  if (!g.open) {
    return { ...base, locked: true, reason: "server-locked", allow, openUntil: null };
  }
  return {
    ...base,
    locked: false,
    reason: "server-open",
    allow,
    openUntil: state.failures === 0 ? g.openUntil : null,
  };
}

export function clampPollSeconds(pollSeconds: number | undefined): number {
  if (pollSeconds === undefined || !Number.isFinite(pollSeconds)) return DEFAULT_POLL_SECONDS;
  return Math.min(MAX_POLL_SECONDS, Math.max(MIN_POLL_SECONDS, pollSeconds));
}

export interface AlarmPlan {
  /** Periodic poll alarm (`periodInMinutes`). */
  pollPeriodMinutes: number;
  /**
   * Alarm at openUntil, as a delay measured on the SERVER clock
   * (openUntil - serverNow), never against the laptop clock. null -> clear it.
   */
  openUntil: { openUntil: string; delayInMinutes: number } | null;
}

/**
 * Alarms to (re)create. Call it right after reducing a `pollSucceeded` event —
 * the delay is anchored to that response's serverNow, so recreating the openUntil
 * alarm later from the same stored state would push it back. After a failure,
 * keep the existing openUntil alarm (or clear it; this returns null then).
 */
export function planAlarms(state: SyncState): AlarmPlan {
  const g = state.lastGood;
  const pollPeriodMinutes = clampPollSeconds(g?.pollSeconds) / 60;
  if (g === null || !g.open || g.openUntil === null || state.failures !== 0 || !state.confirmed) {
    return { pollPeriodMinutes, openUntil: null };
  }
  const delayMs = Math.max(0, Date.parse(g.openUntil) - Date.parse(g.serverNow));
  return { pollPeriodMinutes, openUntil: { openUntil: g.openUntil, delayInMinutes: delayMs / 60000 } };
}

/**
 * Audit 24/10: with "Site access: On click" (or "On specific sites") the extension can no
 * longer redirect pages, and cannot be sure of anything. Fail closed: locked with the
 * last allowlist, catch-all as a plain block, until access to all sites is back.
 */
export function withHostAccess(eff: EffectiveState, hostAccess: boolean): EffectiveState {
  if (hostAccess) return { ...eff, hostAccess: true };
  return { ...eff, locked: true, reason: "no-host-access", openUntil: null, hostAccess: false };
}
