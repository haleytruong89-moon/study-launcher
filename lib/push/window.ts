/**
 * Evening reminder window (parent decision 07/11/2026). Vercel Cron fires once a day somewhere
 * in 14:00–14:59 UTC = 21:00–21:59 Vietnam. Whatever calls /api/cron/evening (Vercel, a late
 * GitHub run, a manual run), nothing is sent outside 20:00–23:00 Vietnam time, so a parent is
 * never pinged at 3–4 a.m. again. PURE: the server passes its own clock.
 */
export const EVENING_FROM_MINUTES = 20 * 60;
export const EVENING_TO_MINUTES = 23 * 60;

/** Minutes since 00:00 in Asia/Ho_Chi_Minh (UTC+7, no DST). */
export function vnMinuteOfDay(now: Date): number {
  return Math.floor((now.getTime() + 7 * 3600_000) / 60_000) % (24 * 60);
}

/** True from 20:00 up to and including 23:00 Vietnam time. */
export function inEveningWindow(now: Date): boolean {
  const m = vnMinuteOfDay(now);
  return m >= EVENING_FROM_MINUTES && m <= EVENING_TO_MINUTES;
}
