/**
 * D2 A2 (parent decision 12/11/2026): a calm heads-up ~5 minutes before an open window
 * (break, free time, a parent's "mở đến …") ends, shown on the toolbar badge and in the popup.
 *
 * Pure: no chrome.* calls and NO CLOCK, like sync.ts. The time left is measured on the SERVER
 * clock (openUntil - serverNow of the latest successful poll); the local alarm only delays.
 * Display only: nothing here changes what is locked or when (the warning never moves openUntil,
 * and `effectiveState` / `planAlarms` are untouched).
 */
import type { EffectiveState, SyncState } from "./sync";

export const WARN_BEFORE_MINUTES = 5;
/** A warning alarm closer than this is not created: the next poll (every 30-60 s) warns instead. */
export const MIN_WARN_ALARM_MINUTES = 1;
export const BADGE_OPEN = { text: "MỞ", color: "#B85A1C" } as const;
export const BADGE_WARN_COLOR = "#2B5D4F";

/** Stored in chrome.storage.local ("warn"): the window it belongs to and the minutes left then. */
export interface Warning {
  openUntil: string;
  minutesLeft: number;
}

export interface WarnPlan {
  /** One-shot alarm at openUntil - 5 min (server clock). null -> clear it. */
  alarm: { openUntil: string; delayInMinutes: number } | null;
  /** Already inside the last 5 minutes at this poll: warn now. */
  now: Warning | null;
}

/**
 * Call right after reducing a `pollSucceeded` event (same rule as planAlarms: the delay is
 * anchored to that response's serverNow). Nothing unless the window is open and trusted.
 */
export function planWarning(state: SyncState): WarnPlan {
  const g = state.lastGood;
  if (g === null || !g.open || g.openUntil === null || state.failures !== 0 || !state.confirmed) return { alarm: null, now: null };
  const leftMs = Date.parse(g.openUntil) - Date.parse(g.serverNow);
  if (!(leftMs > 0)) return { alarm: null, now: null }; // ended: the openUntil alarm locks
  const warnMs = WARN_BEFORE_MINUTES * 60_000;
  if (leftMs <= warnMs) return { alarm: null, now: { openUntil: g.openUntil, minutesLeft: Math.ceil(leftMs / 60_000) } };
  const delayInMinutes = (leftMs - warnMs) / 60_000;
  return { alarm: delayInMinutes > MIN_WARN_ALARM_MINUTES ? { openUntil: g.openUntil, delayInMinutes } : null, now: null };
}

/** The stored warning, only while it still belongs to the window being enforced (else null). */
export function currentWarning(stored: unknown, eff: Pick<EffectiveState, "locked" | "openUntil">): Warning | null {
  if (typeof stored !== "object" || stored === null) return null;
  const w = stored as Record<string, unknown>;
  if (typeof w.openUntil !== "string" || typeof w.minutesLeft !== "number" || !Number.isFinite(w.minutesLeft)) return null;
  if (eff.locked || eff.openUntil === null || eff.openUntil !== w.openUntil) return null;
  return { openUntil: w.openUntil, minutesLeft: Math.min(WARN_BEFORE_MINUTES, Math.max(1, Math.ceil(w.minutesLeft))) };
}

/**
 * What to store after a successful poll: the poll's own warning, else keep an earlier one for
 * the same window (no flicker when an alarm fired a moment before the server agreed), else none.
 */
export function warningAfterPoll(prev: unknown, plan: WarnPlan, eff: Pick<EffectiveState, "locked" | "openUntil">): Warning | null {
  if (plan.now) return currentWarning(plan.now, eff);
  return currentWarning(prev, eff);
}

/** The warning alarm fired: warn only if that window is still the one being enforced. */
export function warningAtAlarm(openUntil: string, eff: Pick<EffectiveState, "locked" | "openUntil">): Warning | null {
  return currentWarning({ openUntil, minutesLeft: WARN_BEFORE_MINUTES }, eff);
}

/** Toolbar badge: nothing while locked, "5'" (calm green) in the last minutes, else "MỞ". */
export function badgeFor(eff: Pick<EffectiveState, "locked">, warning: Warning | null): { text: string; color: string } {
  if (eff.locked) return { text: "", color: BADGE_OPEN.color };
  if (warning) return { text: `${warning.minutesLeft}'`, color: BADGE_WARN_COLOR };
  return { ...BADGE_OPEN };
}

/** Popup line while warned. */
export function warningText(warning: Warning): string {
  return `Còn ${warning.minutesLeft} phút nữa máy khóa lại — lưu bài nhé.`;
}
