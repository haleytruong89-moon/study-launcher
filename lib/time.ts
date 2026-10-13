/**
 * Business time helpers. The family "day" is defined in Asia/Ho_Chi_Minh (UTC+7, no DST),
 * and the week starts on Monday. Never read the client clock to compute durations
 * (see docs/DESIGN.md section 3).
 */

export const FAMILY_TIME_ZONE = "Asia/Ho_Chi_Minh";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Returns the local date (YYYY-MM-DD) in Asia/Ho_Chi_Minh for an instant. */
export function localDate(now: Date): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Instant of 00:00 (Asia/Ho_Chi_Minh) at the start of the given local date. */
export function startOfLocalDay(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid local date: ${date}`);
  return new Date(Date.UTC(y, m - 1, d) - VN_OFFSET_MS);
}

/** Instant of the next 00:00 after `now` (all open intervals stop here). */
export function nextMidnight(now: Date): Date {
  return new Date(startOfLocalDay(localDate(now)).getTime() + DAY_MS);
}

/** ISO weekday for a local date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid local date: ${date}`);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

/** Local date (YYYY-MM-DD) shifted by `days` calendar days (negative = earlier). */
export function addDays(date: string, days: number): string {
  return localDate(new Date(startOfLocalDay(date).getTime() + days * DAY_MS));
}

/**
 * Instant of a wall-clock time ("HH:MM" or "HH:MM:SS", e.g. a Postgres `time` such as
 * profiles.bedtime) on the given local date in Asia/Ho_Chi_Minh.
 */
export function atLocalTime(date: string, time: string): Date {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match) throw new Error(`Invalid local time: ${time}`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = Number(match[3] ?? "0");
  if (h > 23 || m > 59 || s > 59) throw new Error(`Invalid local time: ${time}`);
  return new Date(startOfLocalDay(date).getTime() + ((h * 60 + m) * 60 + s) * 1000);
}

/** Local date (YYYY-MM-DD) of the Monday that starts the week containing `date`. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid local date: ${date}`);
  const monday = new Date(Date.UTC(y, m - 1, d) - (isoWeekday(date) - 1) * DAY_MS);
  return monday.toISOString().slice(0, 10);
}
