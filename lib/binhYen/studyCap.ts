/**
 * R5 — Góc bình yên during study time (docs/BINH_YEN.md R5, Q6). PURE: the SERVER passes its own
 * clock and computeDayState's result; the child's laptop clock never matters.
 *
 * - Study time = the day's work is not done, the laptop is locked and it is not free time
 *   (LOCK_P1, BREAK_OFFER, LOCK_P2, or a parent lock while work is still open).
 *   Break, free time, sick day, trust mode, a parent's "open" and a finished day: no limit.
 * - In study time each visit (one by_sessions row, from the moment the child opened the corner) lasts at most
 *   `by_study_minutes`. At the limit the session ends; the child may come back at once
 *   (a new visit; no limit on the number of visits, Q6).
 * - "Con muốn nói chuyện" and the safety screen are never limited (they do not need the
 *   corner's session at all).
 * This never changes the lock / open rules (DESIGN §5).
 */
import type { DayState } from "@/lib/dayState";

export const STUDY_CAP_TEXT = "Quay lại học nhé, lúc nào cần thì vào lại.";

/** True while the child is supposed to be studying (see above). */
export function isStudyTime(state: Pick<DayState, "status" | "open" | "free" | "part2">): boolean {
  if (state.open) return false;
  if (state.status === "LOCK_END") return false;
  if (state.free.startedAt) return false;
  if (state.part2.complete) return false;
  return true;
}

export interface StudyCap {
  /** Study time right now. */
  study: boolean;
  minutes: number;
  /** When this visit must end (study time only). */
  endsAt: string | null;
  /** The visit has reached the limit. */
  capped: boolean;
}

export function studyCap(study: boolean, sessionStartedAt: string, minutes: number, now: Date): StudyCap {
  if (!study) return { study: false, minutes, endsAt: null, capped: false };
  const end = Date.parse(sessionStartedAt) + minutes * 60_000;
  return { study: true, minutes, endsAt: new Date(end).toISOString(), capped: now.getTime() >= end };
}

/** "Giờ học: mỗi lần tối đa 10 phút · đến 19:10" — the small chip on the corner's home. */
export function studyChip(minutes: number, endsAtHhMm: string): string {
  return `Giờ học: mỗi lần tối đa ${minutes} phút · đến ${endsAtHhMm}`;
}
