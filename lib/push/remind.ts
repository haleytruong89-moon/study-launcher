/**
 * 25/11/2026 (parent: Nguyên asked to open a site, the phone showed nothing): a request that
 * is still waiting is not silent forever. When the child asks again for the same site, the
 * parents are told again, at most once every REMIND_AFTER_MINUTES. PURE.
 */
export const REMIND_AFTER_MINUTES = 10;

/** True when the last time the parents were told about this request is long enough ago. */
export function remindDue(lastToldAt: string | null, now: Date): boolean {
  if (!lastToldAt) return true;
  const t = Date.parse(lastToldAt);
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t >= REMIND_AFTER_MINUTES * 60_000;
}
