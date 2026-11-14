import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskTemplateInput } from "@/lib/dayState";
import {
  buildCalendar,
  clampRange,
  dayAria,
  firstRange,
  isLocalDate,
  monthGrid,
  monthRange,
  monthTitle,
  monthViewRange,
  shiftMonth,
  weekDates,
  type CalendarHomeworkRow,
  type CalendarRows,
} from "@/lib/today/calendar";
import { fakeClient, Tracker, type Answer } from "./fakeSupabase";

// "Lịch của con" step 1 (parent decision 14/11/2026): read only. 2026-11-14 is a Saturday,
// 2026-11-09 the Monday of its week, 2026-11-15 the Sunday.

const TODAY = "2026-11-14";

const T = (id: string, part: "extra" | "skill", weekdays: number[], extra: Partial<TaskTemplateInput> = {}): TaskTemplateInput => ({
  id,
  part,
  title: id,
  subject: null,
  appSlotId: null,
  weekdays,
  minMinutes: null,
  deepLink: null,
  sort: 0,
  active: true,
  ...extra,
});

const H = (id: string, due: string, extra: Partial<CalendarHomeworkRow> = {}): CalendarHomeworkRow => ({
  id,
  subject: `Môn ${id}`,
  due_date: due,
  note: null,
  done_at: null,
  archived_at: null,
  created_at: "2026-11-01T01:00:00Z",
  ...extra,
});

const rows = (r: Partial<CalendarRows>): CalendarRows => ({ homework: [], sessions: [], templates: [], slots: [], ...r });

describe("calendar dates", () => {
  it("weeks run Monday … Sunday (VN), whatever day is asked", () => {
    const week = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
    expect(weekDates(TODAY)).toEqual(week);
    expect(weekDates("2026-11-09")).toEqual(week);
    expect(weekDates("2026-11-15")).toEqual(week); // Sunday belongs to the week before Monday 16
    expect(weekDates("2026-12-31")[0]).toBe("2026-12-28");
    expect(weekDates("2026-12-31")[6]).toBe("2027-01-03");
  });

  it("month grid is Monday-first with blanks for other months", () => {
    const nov = monthGrid("2026-11"); // 1/11 is a Sunday, 30/11 a Monday
    expect(nov).toHaveLength(6);
    expect(nov[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(nov[5]).toEqual(["2026-11-30", null, null, null, null, null, null]);
    expect(nov.flat().filter(Boolean)).toHaveLength(30);
    const feb = monthGrid("2027-02"); // 1/2/2027 is a Monday: exactly 4 weeks
    expect(feb).toHaveLength(4);
    expect(feb[0]?.[0]).toBe("2027-02-01");
    expect(feb[3]?.[6]).toBe("2027-02-28");
  });

  it("months shift across years; titles; ranges", () => {
    expect(shiftMonth("2026-11", 2)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthTitle("2026-11")).toBe("Tháng 11/2026");
    expect(monthViewRange(TODAY, 2)).toEqual({ month: "2027-01", from: "2027-01-01", to: "2027-01-31" });
    expect(monthViewRange(TODAY, 5).month).toBe("2027-01"); // never beyond +2
    expect(monthViewRange(TODAY, -1).month).toBe("2026-11"); // never before this month
  });

  it("the first request covers this week and this month", () => {
    expect(firstRange(TODAY)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    // Tuesday 1/12: the week starts on Monday 30/11.
    expect(firstRange("2026-12-01")).toEqual({ from: "2026-11-30", to: "2026-12-31" });
    // Thursday 30/4/2026: the week ends on Sunday 3/5.
    expect(firstRange("2026-04-30")).toEqual({ from: "2026-04-01", to: "2026-05-03" });
  });

  it("validates dates", () => {
    expect(isLocalDate("2026-11-14")).toBe(true);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("2026-1-14")).toBe(false);
    expect(isLocalDate("x")).toBe(false);
  });
});

describe("clampRange (server clock)", () => {
  it("defaults to this week", () => {
    expect(clampRange(null, null, TODAY)).toEqual({ from: "2026-11-09", to: "2026-11-15" });
  });

  it("keeps a valid range", () => {
    expect(clampRange("2026-11-01", "2026-11-30", TODAY)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("clamps to today − 31 … today + 93 and at most 62 dates", () => {
    expect(clampRange("2026-01-01", "2026-11-20", TODAY)).toEqual({ from: "2026-10-14", to: "2026-11-20" });
    expect(clampRange("2027-01-01", "2027-12-31", TODAY)).toEqual({ from: "2027-01-01", to: "2027-02-15" });
    const wide = clampRange("2026-10-14", "2027-02-15", TODAY);
    expect(wide).toEqual({ from: "2026-10-14", to: "2026-12-14" }); // 62 dates
  });

  it("refuses malformed dates and empty ranges", () => {
    expect(clampRange("2026-13-01", "2026-12-01", TODAY)).toBeNull();
    expect(clampRange("2026-11-20", "2026-11-10", TODAY)).toBeNull();
    expect(clampRange("2025-01-01", "2025-02-01", TODAY)).toBeNull(); // entirely before the window
    expect(clampRange("2026-11-20", null, TODAY)).toEqual({ from: "2026-11-20", to: "2026-11-20" });
  });
});

describe("buildCalendar", () => {
  const range = { from: "2026-11-09", to: "2026-11-15" };

  it("empty data: every date, normal, nothing listed", () => {
    const v = buildCalendar(range, TODAY, rows({}));
    expect(v.days.map((d) => d.date)).toEqual(weekDates(TODAY));
    expect(v.days.every((d) => d.dayType === "normal" && d.homework.length === 0 && d.skills.length === 0)).toBe(true);
    expect(v).toMatchObject({ today: TODAY, from: range.from, to: range.to });
  });

  it("maps exam / holiday / sick from day_sessions", () => {
    const v = buildCalendar(
      range,
      TODAY,
      rows({
        sessions: [
          { local_date: "2026-11-11", day_type: "exam", disabled_template_ids: [] },
          { local_date: "2026-11-12", day_type: "holiday", disabled_template_ids: null },
          { local_date: "2026-11-13", day_type: "sick", disabled_template_ids: [] },
        ],
      }),
    );
    expect(v.days.map((d) => d.dayType)).toEqual(["normal", "normal", "exam", "holiday", "sick", "normal", "normal"]);
    expect(dayAria(v.days[2]!, TODAY)).toBe("Thứ Tư 11/11: không có việc, Kiểm tra");
  });

  it("templates by ISO weekday (Sunday = 7), Part 1 first, minus that date's turned-off ones and placeholders", () => {
    const v = buildCalendar(
      range,
      TODAY,
      rows({
        templates: [
          T("skill-mon", "skill", [1], { sort: 2 }),
          T("extra-mon", "extra", [1]),
          T("skill-sun", "skill", [7]),
          T("off", "skill", [1, 7], { active: false }),
          T("building", "skill", [1], { appSlotId: "slot-p" }),
          T("app", "skill", [1], { appSlotId: "slot-x", sort: 1 }),
          T("exam-off", "extra", [3]),
        ],
        slots: [
          { id: "slot-p", kind: "placeholder" },
          { id: "slot-x", kind: "external" },
        ],
        sessions: [{ local_date: "2026-11-11", day_type: "exam", disabled_template_ids: ["exam-off"] }],
      }),
    );
    expect(v.days[0]!.skills).toEqual([
      { id: "extra-mon", title: "extra-mon", part: "extra" },
      { id: "app", title: "app", part: "skill" },
      { id: "skill-mon", title: "skill-mon", part: "skill" },
    ]);
    expect(v.days[2]!.skills).toEqual([]); // Wednesday: turned off for the exam
    expect(v.days[6]!.skills.map((s) => s.id)).toEqual(["skill-sun"]);
    expect(dayAria(v.days[0]!, TODAY)).toBe("Thứ Hai 09/11: 3 việc");
  });

  it("homework: on the due date, like the Today list (not archived, not done before today)", () => {
    const v = buildCalendar(
      range,
      TODAY,
      rows({
        homework: [
          H("b", "2026-11-16"), // next week: outside the range
          H("late", "2026-11-14", { created_at: "2026-11-02T01:00:00Z" }),
          H("first", "2026-11-14", { note: "Bài 3 trang 40" }),
          H("archived", "2026-11-14", { archived_at: "2026-11-10T01:00:00Z" }),
          H("doneBefore", "2026-11-13", { done_at: "2026-11-13T10:00:00Z" }),
          H("doneToday", "2026-11-13", { done_at: "2026-11-13T18:00:00Z" }), // 01:00 on the 14th in Vietnam
          H("overdue", "2026-11-10"),
        ],
      }),
    );
    expect(v.days[5]!.homework).toEqual([
      { id: "first", title: "Môn first", subject: "Môn first", note: "Bài 3 trang 40" },
      { id: "late", title: "Môn late", subject: "Môn late", note: null },
    ]);
    expect(v.days[4]!.homework.map((h) => h.id)).toEqual(["doneToday"]);
    expect(v.days[1]!.homework.map((h) => h.id)).toEqual(["overdue"]);
    expect(v.days.flatMap((d) => d.homework).map((h) => h.id)).not.toContain("b");
    expect(dayAria(v.days[5]!, TODAY)).toBe("Hôm nay, Thứ Bảy 14/11: 2 việc");
  });
});

// --- GET /api/calendar: child only, range clamped on the server clock, the child's own session ---

vi.mock("server-only", () => ({}));
const env = vi.hoisted(() => ({
  me: null as unknown,
  tracker: null as unknown as Tracker,
  answer: (() => undefined) as Answer,
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => env.me }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient(env.tracker, (q) => env.answer(q)) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the calendar must never use service_role");
  },
}));

const { GET } = await import("@/app/api/calendar/route");
const child = { userId: "child-1", email: "c@x", profile: { id: "child-1", family_id: "fam-1", role: "child", display_name: "An", grade: 6, color: null } };
const call = (qs = "") => GET(new Request(`http://x/api/calendar${qs}`));

describe("GET /api/calendar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T03:00:00Z")); // 10:00 Saturday in Vietnam
    env.tracker = new Tracker();
    env.me = child;
    env.answer = () => undefined;
  });
  afterEach(() => vi.useRealTimers());

  it("401 when not signed in, 403 for a parent", async () => {
    env.me = null;
    expect((await call()).status).toBe(401);
    env.me = { ...child, profile: { ...child.profile, role: "parent" } };
    expect((await call()).status).toBe(403);
    expect(env.tracker.log).toHaveLength(0);
  });

  it("400 for a malformed date", async () => {
    expect((await call("?from=2026-11-31&to=2026-12-01")).status).toBe(400);
  });

  it("clamps the range and reads only this child's rows, in one round trip", async () => {
    const seen: { table: string; filters: string[] }[] = [];
    env.answer = (q) => void seen.push({ table: q.table, filters: q.filters });
    const res = await call("?from=2026-01-01&to=2027-12-31");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Server-Timing")).toMatch(/^auth;dur=[\d.]+, db;dur=[\d.]+, total;dur=[\d.]+$/);
    const body = (await res.json()) as { from: string; to: string; today: string; days: unknown[] };
    expect([body.today, body.from, body.to, body.days.length]).toEqual([TODAY, "2026-10-14", "2026-12-14", 62]);
    expect(env.tracker.depth).toBe(1);
    const q = env.tracker.log.map((l) => l.what);
    expect(q).toHaveLength(4);
    expect(seen.map((x) => x.table).sort()).toEqual(["app_slots", "day_sessions", "homework_items", "task_templates"]);
    for (const x of seen) expect(x.filters).toContain(x.table === "app_slots" ? "eq(family_id,fam-1)" : "eq(child_id,child-1)");
    expect(seen.find((x) => x.table === "homework_items")?.filters).toEqual(
      expect.arrayContaining(["is(archived_at,null)", "gte(due_date,2026-10-14)", "lte(due_date,2026-12-14)", "or(done_at.is.null,done_at.gte.2026-11-13T17:00:00.000Z)"]),
    );
  });

  it("answers 500 (no details) when a read fails", async () => {
    env.answer = (q) => (q.table === "day_sessions" ? { error: { message: "boom" } } : undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});
