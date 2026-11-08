/**
 * What the child plans for free time, per date (R6d) — remembered in THIS browser only (parent
 * decision 08/11/2026: no server, parents never see it). Broken or missing storage = no plan.
 * The comic (R5) reads the same key. Keys are only sorted as strings, never parsed as dates.
 */
export const PLAY_PLAN_KEY = "play-plans";
const KEEP = 31;
const MAX_LEN = 40;

function storage(): Storage | undefined {
  return (globalThis as { window?: { localStorage?: Storage } }).window?.localStorage;
}

/** The stored JSON as it is (a stable snapshot for useSyncExternalStore), or null. R5. */
export function readPlayPlansRaw(): string | null {
  try {
    return storage()?.getItem(PLAY_PLAN_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Date → plan from the stored JSON; anything broken = no plans. R5 (the comic reads every day of a week). */
export function parsePlayPlans(raw: string | null): Record<string, string> {
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : {};
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {
    return {};
  }
}

function readAll(): Record<string, string> {
  return parsePlayPlans(readPlayPlansRaw());
}

export function readPlayPlan(date: string): string | null {
  return readAll()[date] ?? null;
}

export function writePlayPlan(date: string, choice: string | null): void {
  try {
    const all = readAll();
    if (choice) all[date] = choice.slice(0, MAX_LEN);
    else delete all[date];
    const kept = Object.keys(all).sort().slice(-KEEP);
    storage()?.setItem(PLAY_PLAN_KEY, JSON.stringify(Object.fromEntries(kept.map((k) => [k, all[k]]))));
  } catch {
    /* not remembered: fine */
  }
}
