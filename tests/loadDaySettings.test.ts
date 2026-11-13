import { describe, expect, it, vi } from "vitest";
import { fakeClient, Tracker, type Answer } from "./fakeSupabase";

// 12/11/2026: family_settings is read ONCE (all columns). Before a migration adds a column
// (a preview before merge) loadDay falls back to the old separate reads. The day it builds
// must be the same either way, and any other error must still throw (fail-closed).

vi.mock("server-only", () => ({}));
const { loadDay } = await import("@/lib/today/load");

const ROW = {
  break_minutes: 10,
  free_minutes: 45,
  extra_min_minutes: 20,
  skill_min_minutes: 20,
  passes_per_week: 1,
  trust_up_pct: 90,
  trust_up_weeks: 3,
  trust_down_pct: 70,
  homework_lookahead_days: 7,
  homework_min_upcoming: 2,
  break_tiers: [{ focus: 45, rest: 10 }],
  break_max_per_day: 6,
  break_run_cap_minutes: 180,
};

const day: Answer = (q) => {
  if (q.table === "family_settings") return { data: ROW };
  if (q.table === "profiles") return { data: { bedtime: "21:30" } };
  if (q.table === "trust_state") return { data: { mode: "trust", since: "2026-11-10T01:00:00Z", created_at: "2026-10-01T01:00:00Z" } };
  if (q.table === "day_breaks") return { data: [{ id: "b1", local_date: "2026-11-12", started_at: "2026-11-12T03:00:00Z", planned_minutes: 10, ended_at: null }] };
  return undefined;
};
const merged = (q: { table: string; columns: string }) => q.table === "family_settings" && q.columns.includes("homework_lookahead_days") && q.columns.includes("break_tiers");
const missing = (col: string) => ({ error: { code: "42703", message: `column family_settings.${col} does not exist` } });

async function load(answer: Answer) {
  const tracker = new Tracker();
  const out = await loadDay(fakeClient(tracker, answer) as never, "child-1", "fam-1", "2026-11-12");
  return { out, tracker };
}

describe("loadDay family_settings", () => {
  it("reads every setting in one query once migrated", async () => {
    const { out, tracker } = await load(day);
    expect(tracker.log.filter((l) => l.what.includes("family_settings"))).toHaveLength(1);
    expect(out.input.settings).toEqual({
      breakMinutes: 10,
      freeMinutes: 45,
      extraMinMinutes: 20,
      skillMinMinutes: 20,
      passesPerWeek: 1,
      trustUpPct: 90,
      trustUpWeeks: 3,
      trustDownPct: 70,
      homeworkLookaheadDays: 7,
      homeworkMinUpcoming: 2,
      breakTiers: [{ focus: 45, rest: 10 }],
      breakMaxPerDay: 6,
      breakRunCapMinutes: 180,
    });
    expect(out.input.breaks).toHaveLength(1);
    // The history window still follows trust_up_weeks (Monday 09/11 - 3 weeks).
    expect(tracker.log.find((l) => l.what.includes("day_sessions"))?.depth).toBe(2);
    expect(tracker.depth).toBe(2);
  });

  it("builds the same day through the fallback reads", async () => {
    const { out: one } = await load(day);
    const { out: three, tracker } = await load((q) => (merged(q) ? missing("x") : day(q)));
    expect(tracker.log.filter((l) => l.what.includes("family_settings"))).toHaveLength(4);
    expect(three).toEqual(one);
  });

  it("before 0014: no break bank (old single break)", async () => {
    const { out } = await load((q) => (q.table === "day_breaks" || (q.table === "family_settings" && q.columns.includes("break_tiers")) ? missing("break_tiers") : day(q)));
    expect(out.input.settings).not.toHaveProperty("breakTiers");
    expect(out.input.settings.homeworkMinUpcoming).toBe(2);
    expect(out.input.breaks).toBeNull();
  });

  it("before 0002: the default homework_min_upcoming", async () => {
    const { out } = await load((q) =>
      q.table === "family_settings" && (q.columns.includes("homework_min_upcoming") || q.columns.includes("break_tiers")) ? missing("homework_min_upcoming") : q.table === "day_breaks" ? missing("x") : day(q),
    );
    expect(out.input.settings.homeworkMinUpcoming).toBe(1);
    expect(out.input.breaks).toBeNull();
  });

  it("any other settings error throws (fail-closed)", async () => {
    await expect(load((q) => (q.table === "family_settings" ? { error: { code: "57014", message: "timeout" } } : day(q)))).rejects.toThrow("loadDay: family_settings: timeout");
  });

  it("a missing settings row throws as before", async () => {
    await expect(load((q) => (q.table === "family_settings" ? { data: null } : day(q)))).rejects.toThrow("loadDay: family_settings");
  });

  it("an error of another table still throws", async () => {
    await expect(load((q) => (q.table === "trust_state" ? { error: { message: "boom" } } : day(q)))).rejects.toThrow("loadDay: trust_state: boom");
  });
});
