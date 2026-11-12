import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, Tracker, type Answer, type FakeQuery } from "./fakeSupabase";

// Performance (12/11/2026): every trip to Supabase costs a full network round trip, so the
// routes the child's screen and the extension poll must not wait for one query before
// starting the next when the two do not depend on each other. These tests count the
// sequential trips ("depth") with a fake client; a regression shows up as a bigger number.

vi.mock("server-only", () => ({}));

const env = vi.hoisted(() => ({ tracker: null as unknown as Tracker, answer: null as unknown as Answer, after: [] as (() => unknown)[] }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient(env.tracker, (q) => env.answer(q)) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeClient(env.tracker, (q) => env.answer(q)) }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => unknown) => void env.after.push(fn),
}));

const SETTINGS = {
  break_minutes: 10,
  free_minutes: 45,
  extra_min_minutes: 20,
  skill_min_minutes: 20,
  passes_per_week: 1,
  trust_up_pct: 90,
  trust_up_weeks: 2,
  trust_down_pct: 70,
  homework_lookahead_days: 7,
  homework_min_upcoming: 1,
  break_tiers: [{ focus: 45, rest: 10 }],
  break_max_per_day: 6,
  break_run_cap_minutes: 180,
  allow_local_files: true,
};

/** Fully migrated database, an empty day (no milestone is written on read). */
const migrated: Answer = (q: FakeQuery) => {
  if (q.table === "profiles") return { data: { id: "child-1", family_id: "fam-1", role: "child", display_name: "Con A", grade: 6, color: null, bedtime: "21:30", icon: null } };
  if (q.table === "family_settings") return { data: SETTINGS };
  if (q.table === "extension_devices" && q.op === "select") return { data: { id: "dev-1", child_id: "child-1", family_id: "fam-1", revoked_at: null } };
  return undefined;
};

/** Before migration 0014: the break-bank columns and table do not exist yet. */
const before0014: Answer = (q) => {
  if (q.table === "day_breaks" || (q.table === "family_settings" && q.columns.includes("break_tiers")))
    return { error: { code: "42703", message: "column family_settings.break_tiers does not exist" } };
  return migrated(q);
};

beforeEach(() => {
  env.tracker = new Tracker();
  env.answer = migrated;
  env.after = [];
});

const { GET: today } = await import("@/app/api/today/route");
const { GET: extState } = await import("@/app/api/ext/state/route");

// Wednesday 12/11/2026 10:00 VN: no weekly review card.
const WEDNESDAY = new Date("2026-11-12T03:00:00Z");
// Sunday 15/11/2026 18:00 VN: the weekly review card is open (Sunday 17:00 -> end of Monday).
const SUNDAY_EVENING = new Date("2026-11-15T11:00:00Z");

describe("round trips per request", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: WEDNESDAY }));

  it("GET /api/today: 4 sequential trips (was 8)", async () => {
    const res = await today();
    expect(res.status).toBe(200);
    // auth.getUser -> profiles -> family_settings (with the rest of the day in parallel) -> day_sessions history.
    expect(env.tracker.depth).toBe(4);
    expect(env.tracker.log.filter((l) => l.what.includes("family_settings"))).toHaveLength(1);
    expect(res.headers.get("Server-Timing")).toMatch(/^auth;dur=[\d.]+, db;dur=[\d.]+, total;dur=[\d.]+$/);
  });

  it("GET /api/today with the weekly review open: 5 trips", async () => {
    vi.setSystemTime(SUNDAY_EVENING);
    const res = await today();
    expect(res.status).toBe(200);
    expect((await res.json()).weekly).not.toBeNull();
    expect(env.tracker.depth).toBe(5);
  });

  it("GET /api/today before migration 0014: falls back to the three settings reads", async () => {
    env.answer = before0014;
    const res = await today();
    expect(res.status).toBe(200);
    expect(env.tracker.log.filter((l) => l.what.includes("family_settings"))).toHaveLength(4);
  });

  it("GET /api/ext/state: 3 sequential trips (was 7), last_seen written after the answer", async () => {
    const res = await extState(new Request("http://x/api/ext/state", { headers: { authorization: "Bearer abcdefghijklmnopqrstuvwxyz012345" } }));
    expect(res.status).toBe(200);
    // extension_devices -> family_settings (+ allowlist, slots, the rest of the day) -> day_sessions history.
    expect(env.tracker.depth).toBe(3);
    expect(res.headers.get("Server-Timing")).toMatch(/^auth;dur=[\d.]+, db;dur=[\d.]+, total;dur=[\d.]+$/);
    expect(env.tracker.log.some((l) => l.what.startsWith("update extension_devices"))).toBe(false);
    expect(env.after).toHaveLength(1);
    await env.after[0]!();
    expect(env.tracker.log.some((l) => l.what.startsWith("update extension_devices"))).toBe(true);
  });

  it("GET /api/ext/state: a failed read is still a 500 and does not mark the device seen", async () => {
    env.answer = (q) => (q.table === "allowlist_entries" ? { error: { message: "boom" } } : migrated(q));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await extState(new Request("http://x/api/ext/state", { headers: { authorization: "Bearer abcdefghijklmnopqrstuvwxyz012345" } }));
    expect(res.status).toBe(500);
    expect(env.after).toHaveLength(0);
  });
});

describe("round trips of the parent's home page", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: WEDNESDAY }));

  const parentFamily: Answer = (q) => {
    if (q.table === "profiles" && q.columns.includes("role")) return { data: { id: "parent-1", family_id: "fam-1", role: "parent", display_name: "Bố", grade: null, color: null } };
    if (q.table === "profiles" && q.filters.includes("eq(role,child)"))
      return {
        data: [
          { id: "child-1", display_name: "Con A", grade: 9, color: null, bedtime: "22:00" },
          { id: "child-2", display_name: "Con B", grade: 6, color: null, bedtime: "21:30" },
        ],
      };
    return migrated(q);
  };

  it("/parent: 5 sequential trips (was 8), the same for two children", async () => {
    env.answer = parentFamily;
    const { default: ParentHome } = await import("@/app/parent/page");
    await ParentHome();
    // auth.getUser -> profiles -> children list (+ family reads) -> family_settings of each child (+ verdicts) -> day_sessions.
    expect(env.tracker.depth).toBe(5);
    expect(env.tracker.log.filter((l) => l.what.includes("day_sessions [local_date, day_type, disabled_template_ids, break"))).toHaveLength(2);
  });
});

describe("round trips of the child's page (server render)", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: WEDNESDAY }));

  it("/today: 4 sequential trips (was 10): the user is read once", async () => {
    const { default: TodayPage } = await import("@/app/today/page");
    await TodayPage({ searchParams: Promise.resolve({}) });
    expect(env.tracker.depth).toBe(4);
    expect(env.tracker.log.filter((l) => l.what === "auth.getUser")).toHaveLength(1);
  });
});
