/** Parent overrides of today (rule 4) and their OPEN windows for the break bank (rule 19). */

import type { Interval } from "./breakBank";
import { toMs } from "./instants";
import type { OverrideInput } from "./types";

/**
 * The newest override of today (by created_at; on a tie the lock wins) SUPERSEDES all
 * older ones (parent decision 14/10/2026). It is in effect only while `until` > now;
 * once it expires the day returns to the normal flow, never to an older override.
 */
export function pickOverride(overrides: OverrideInput[], today: string, nowMs: number): OverrideInput | null {
  let newest: OverrideInput | null = null;
  let newestCreated = -Infinity;
  for (const o of overrides) {
    if (o.localDate !== today) continue;
    const created = toMs(o.createdAt, "overrides.created_at");
    toMs(o.until, "overrides.until"); // validate every row (malformed input throws)
    if (newest === null || created > newestCreated || (created === newestCreated && o.kind === "lock_until")) {
      newest = o;
      newestCreated = created;
    }
  }
  if (newest === null) return null;
  return toMs(newest.until, "overrides.until") > nowMs ? newest : null;
}

/**
 * Parent OPEN override windows of today: each override is in effect from its created_at until its
 * `until` or the next newer override (on a tie the lock wins, as pickOverride), clipped at 00:00.
 */
export function openOverrideIntervals(overrides: OverrideInput[], today: string, midnightMs: number): Interval[] {
  const rows = overrides
    .filter((o) => o.localDate === today)
    .map((o) => ({ kind: o.kind, created: toMs(o.createdAt, "overrides.created_at"), until: toMs(o.until, "overrides.until") }))
    .sort((a, b) => a.created - b.created || (a.kind === b.kind ? 0 : a.kind === "open_until" ? -1 : 1));
  const out: Interval[] = [];
  rows.forEach((o, i) => {
    if (o.kind !== "open_until") return;
    const next = rows[i + 1];
    out.push([o.created, Math.min(o.until, next ? next.created : Infinity, midnightMs)]);
  });
  return out;
}
