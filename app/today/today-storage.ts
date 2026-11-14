"use client";

/** Browser storage of the child's Today screen (this laptop / this tab only; a convenience). */

export function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// R7a: the focus screen the child opened stays open after a reload (this tab only), and never
// opens by itself. Value = the task key.
const FOCUS_OPEN = "focus-open";
export const noStore = () => () => {};
export function readFocusOpen(): string | null {
  try {
    return window.sessionStorage.getItem(FOCUS_OPEN);
  } catch {
    return null;
  }
}
export function writeFocusOpen(key: string | null) {
  try {
    if (key) window.sessionStorage.setItem(FOCUS_OPEN, key);
    else window.sessionStorage.removeItem(FOCUS_OPEN);
  } catch {
    /* not remembered: fine */
  }
}

export function readPlanLater(): string | null {
  try {
    return window.localStorage.getItem("plan-later");
  } catch {
    return null; // storage blocked: the nudge just shows again
  }
}

// "Lịch của con": the view the child last chose (Tuần / Tháng) on this laptop. A convenience only.
const CALENDAR_MODE = "calendar-mode";
export type CalendarMode = "week" | "month";
export function readCalendarMode(): CalendarMode | null {
  try {
    const v = window.localStorage.getItem(CALENDAR_MODE);
    return v === "week" || v === "month" ? v : null;
  } catch {
    return null; // storage blocked: the week view
  }
}
export function writeCalendarMode(mode: CalendarMode) {
  try {
    window.localStorage.setItem(CALENDAR_MODE, mode);
  } catch {
    /* not remembered: fine */
  }
}
