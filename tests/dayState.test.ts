import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appLabelOf,
  breakBank,
  computeDayState,
  DEFAULT_BREAK_TIERS,
  earnBreak,
  focusIntervals,
  validBreakTiers,
  type AppSlotInput,
  type BreakRowInput,
  type DayInput,
  type DaySessionInput,
  type FamilySettingsInput,
  type HomeworkItemInput,
  type OverrideInput,
  type TaskRunInput,
  type TaskTemplateInput,
} from "@/lib/dayState";

// ---------------------------------------------------------------------------
// Fixtures & builders. Reference day: Wednesday 2026-10-14 (week starts Mon 10-12).
// ---------------------------------------------------------------------------

const TODAY = "2026-10-14";
const TOMORROW = "2026-10-15";
const YESTERDAY = "2026-10-13";

/** Instant of a VN wall-clock time, e.g. vn("2026-10-14 19:00"). */
function vn(dateTime: string): Date {
  const [d, t = "00:00"] = dateTime.split(" ");
  const [h = "0", m = "0", s = "0"] = t.split(":");
  const pad = (x: string) => x.padStart(2, "0");
  const out = new Date(`${d}T${pad(h)}:${pad(m)}:${pad(s)}+07:00`);
  if (Number.isNaN(out.getTime())) throw new Error(`bad fixture time: ${dateTime}`);
  return out;
}
const iso = (dateTime: string) => vn(dateTime).toISOString();

const SETTINGS: FamilySettingsInput = {
  breakMinutes: 10,
  freeMinutes: 45,
  extraMinMinutes: 20,
  skillMinMinutes: 20,
  passesPerWeek: 1,
  trustUpPct: 90,
  trustUpWeeks: 3,
  trustDownPct: 70,
  homeworkLookaheadDays: 1,
    homeworkMinUpcoming: 1,
};

function session(localDate: string, patch: Partial<DaySessionInput> = {}): DaySessionInput {
  return {
    localDate,
    dayType: "normal",
    disabledTemplateIds: [],
    breakStartedAt: null,
    breakEndedAt: null,
    breakSkipped: false,
    part1DoneAt: null,
    part2DoneAt: null,
    freeStartedAt: null,
    passUsedAt: null,
    ...patch,
  };
}

function hw(id: string, patch: Partial<HomeworkItemInput> = {}): HomeworkItemInput {
  return {
    id,
    subject: "Toán",
    dueDate: TOMORROW,
    note: null,
    doneAt: null,
    archivedAt: null,
    createdAt: iso(`${YESTERDAY} 20:00`),
    ...patch,
  };
}

function tpl(id: string, part: "extra" | "skill", patch: Partial<TaskTemplateInput> = {}): TaskTemplateInput {
  return {
    id,
    part,
    title: id,
    subject: null,
    appSlotId: null,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    minMinutes: null,
    deepLink: null,
    sort: 0,
    active: true,
    ...patch,
  };
}

let runSeq = 0;
function run(patch: Partial<TaskRunInput>): TaskRunInput {
  runSeq += 1;
  return {
    id: `run-${runSeq}`,
    localDate: TODAY,
    source: "template",
    homeworkItemId: null,
    templateId: null,
    startedAt: null,
    doneAt: null,
    proofPaths: [],
    ...patch,
  };
}

let ovSeq = 0;
function ov(kind: OverrideInput["kind"], until: string, createdAt: string, localDate = TODAY): OverrideInput {
  ovSeq += 1;
  return { id: `ov-${ovSeq}`, localDate, kind, until: iso(until), createdAt: iso(createdAt) };
}

function input(patch: Partial<DayInput> = {}): DayInput {
  return {
    settings: SETTINGS,
    bedtime: "21:30:00",
    trustMode: "lock",
    sessions: [],
    homework: [],
    templates: [],
    appSlots: [],
    runs: [],
    overrides: [],
    breaks: [],
    ...patch,
  };
}

/**
 * R8b: the same day before migration 0014 (`breaks: null`): the old single-break rule (once a day,
 * after a part is done, break_minutes long) still applies there, e.g. on a preview.
 */
function legacy(i: DayInput): DayInput {
  return { ...i, breaks: null };
}

/** A normal day: 1 homework, 1 extra, 1 skill — nothing done yet. */
function normalDay(patch: Partial<DayInput> = {}): DayInput {
  return input({
    homework: [hw("h1")],
    templates: [tpl("e1", "extra"), tpl("s1", "skill")],
    ...patch,
  });
}

/** Part 1 done at 16:00 today (milestone stored). */
const P1_DONE = { part1DoneAt: iso(`${TODAY} 16:00`) };

const MIDNIGHT = iso(`${TOMORROW} 00:00`);

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Priority table (DESIGN section 5), one block per row
// ---------------------------------------------------------------------------

describe("priority table", () => {
  it("rows 1-2: an active lock override → LOCK_OVERRIDE (beats FREE)", () => {
    const s = computeDayState(
      normalDay({
        sessions: [session(TODAY, { ...P1_DONE, freeStartedAt: iso(`${TODAY} 19:00`) })],
        overrides: [ov("lock_until", `${TODAY} 21:00`, `${TODAY} 19:05`)],
      }),
      vn(`${TODAY} 19:10`),
    );
    expect(s.status).toBe("LOCK_OVERRIDE");
    expect(s.open).toBe(false);
    expect(s.openUntil).toBeNull();
  });

  it("rows 1-2: an active open override → OPEN_OVERRIDE until `until` (beats LOCK_P1)", () => {
    const s = computeDayState(
      normalDay({ overrides: [ov("open_until", `${TODAY} 20:00`, `${TODAY} 19:00`)] }),
      vn(`${TODAY} 19:10`),
    );
    expect(s.status).toBe("OPEN_OVERRIDE");
    expect(s.open).toBe(true);
    expect(s.openUntil).toBe(iso(`${TODAY} 20:00`));
  });

  it("row 3: trust mode → OPEN_TRUST until 00:00", () => {
    const s = computeDayState(normalDay({ trustMode: "trust" }), vn(`${TODAY} 15:00`));
    expect(s.status).toBe("OPEN_TRUST");
    expect(s.open).toBe(true);
    expect(s.openUntil).toBe(MIDNIGHT);
  });

  it("row 3 loses to an override", () => {
    const s = computeDayState(
      normalDay({ trustMode: "trust", overrides: [ov("lock_until", `${TODAY} 18:00`, `${TODAY} 15:00`)] }),
      vn(`${TODAY} 15:30`),
    );
    expect(s.status).toBe("LOCK_OVERRIDE");
  });

  it("row 4: sick day → OPEN_SICK until 00:00", () => {
    const s = computeDayState(normalDay({ sessions: [session(TODAY, { dayType: "sick" })] }), vn(`${TODAY} 9:00`));
    expect(s.status).toBe("OPEN_SICK");
    expect(s.open).toBe(true);
    expect(s.openUntil).toBe(MIDNIGHT);
  });

  it("row 3 beats row 4 (trust + sick → OPEN_TRUST)", () => {
    const s = computeDayState(
      normalDay({ trustMode: "trust", sessions: [session(TODAY, { dayType: "sick" })] }),
      vn(`${TODAY} 9:00`),
    );
    expect(s.status).toBe("OPEN_TRUST");
  });

  it("row 4 beats row 5 (sick day with free time used up → OPEN_SICK)", () => {
    const s = computeDayState(
      normalDay({ sessions: [session(TODAY, { dayType: "sick", freeStartedAt: iso(`${TODAY} 10:00`) })] }),
      vn(`${TODAY} 12:00`),
    );
    expect(s.status).toBe("OPEN_SICK");
  });

  it("row 5: free time over → LOCK_END", () => {
    const s = computeDayState(
      normalDay({ sessions: [session(TODAY, { ...P1_DONE, freeStartedAt: iso(`${TODAY} 19:00`) })] }),
      vn(`${TODAY} 20:30`),
    );
    expect(s.status).toBe("LOCK_END");
    expect(s.open).toBe(false);
    expect(s.openUntil).toBeNull();
  });

  it("row 6: free time running → FREE until start + 45'", () => {
    const s = computeDayState(
      normalDay({ sessions: [session(TODAY, { ...P1_DONE, freeStartedAt: iso(`${TODAY} 19:00`) })] }),
      vn(`${TODAY} 19:20`),
    );
    expect(s.status).toBe("FREE");
    expect(s.open).toBe(true);
    expect(s.openUntil).toBe(iso(`${TODAY} 19:45`));
    expect(s.free).toEqual({ canStart: false, startedAt: iso(`${TODAY} 19:00`), endsAt: iso(`${TODAY} 19:45`), bonusMinutes: 0 });
  });

  it("row 6: free time from a pass even though Part 1 is not done → FREE", () => {
    const s = computeDayState(
      normalDay({
        sessions: [session(TODAY, { passUsedAt: iso(`${TODAY} 18:00`), freeStartedAt: iso(`${TODAY} 18:00`) })],
      }),
      vn(`${TODAY} 18:10`),
    );
    expect(s.status).toBe("FREE");
    expect(s.part1.complete).toBe(false);
  });

  it("row 8: Part 1 not done → LOCK_P1 (no part done: no break yet)", () => {
    const s = computeDayState(normalDay(), vn(`${TODAY} 15:00`));
    expect(s.status).toBe("LOCK_P1");
    expect(s.open).toBe(false);
    expect(s.openUntil).toBeNull();
    expect(s.break.state).toBe("not_yet");
    expect(s.break.canStart).toBe(false);
  });

  it("row 9: Part 1 done, Part 2 not done → LOCK_P2; the break may start (no break step in between) [legacy before 0014]", () => {
    expect(computeDayState(normalDay({ sessions: [session(TODAY, P1_DONE)] }), vn(`${TODAY} 16:05`)).break.canStart).toBe(false); // R8b: no focus, no bank
    const s = computeDayState(legacy(normalDay({ sessions: [session(TODAY, P1_DONE)] })), vn(`${TODAY} 16:05`));
    expect(s.status).toBe("LOCK_P2");
    expect(s.open).toBe(false);
    expect(s.break.state).toBe("offer");
    expect(s.break.canStart).toBe(true);
  });

  it("row 7: break running → BREAK until start + 10' [legacy before 0014]", () => {
    const s = computeDayState(
      legacy(normalDay({ sessions: [session(TODAY, { ...P1_DONE, breakStartedAt: iso(`${TODAY} 16:05`) })] })),
      vn(`${TODAY} 16:10`),
    );
    expect(s.status).toBe("BREAK");
    expect(s.open).toBe(true);
    expect(s.openUntil).toBe(iso(`${TODAY} 16:15`));
    expect(s.break).toEqual({
      state: "running",
      canStart: false,
      startedAt: iso(`${TODAY} 16:05`),
      endsAt: iso(`${TODAY} 16:15`),
      legacy: true,
      bankMinutes: 0,
      blockFocusMinutes: 0,
      nextTier: null,
      takenToday: 1,
      maxPerDay: 1,
      plannedMinutes: 10,
    });
  });

  it("row 7 beats row 8: a break while Part 1 is not done (Part 2 done first) → BREAK", () => {
    const s = computeDayState(
      normalDay({
        sessions: [session(TODAY, { part2DoneAt: iso(`${TODAY} 17:40`), breakStartedAt: iso(`${TODAY} 17:40`) })],
        runs: [run({ templateId: "s1", startedAt: iso(`${TODAY} 17:20`), doneAt: iso(`${TODAY} 17:40`) })],
      }),
      vn(`${TODAY} 17:45`),
    );
    expect(s.status).toBe("BREAK");
    expect(s.openUntil).toBe(iso(`${TODAY} 17:50`));
    expect(s.part1.complete).toBe(false);
  });

  it("a legacy break_skipped = true uses the break of the day → LOCK_P2, no break offer [legacy before 0014]", () => {
    const s = computeDayState(
      legacy(normalDay({ sessions: [session(TODAY, { ...P1_DONE, breakSkipped: true })] })),
      vn(`${TODAY} 16:05`),
    );
    expect(s.status).toBe("LOCK_P2");
    expect(s.break.state).toBe("skipped");
    expect(s.break.canStart).toBe(false);
  });

  it("break ended early with 'Học tiếp' → back to the locked status, break used [legacy before 0014]", () => {
    const s = computeDayState(
      legacy(
        normalDay({
          sessions: [session(TODAY, { ...P1_DONE, breakStartedAt: iso(`${TODAY} 16:05`), breakEndedAt: iso(`${TODAY} 16:08`) })],
        }),
      ),
      vn(`${TODAY} 16:09`),
    );
    expect(s.status).toBe("LOCK_P2");
    expect(s.break.state).toBe("done");
    expect(s.break.canStart).toBe(false);
  });

  it("row 10: both parts empty → FREE_READY (locked) until the child presses 'Bắt đầu giờ tự do'", () => {
    const s = computeDayState(input(), vn(`${TODAY} 00:00:30`));
    expect(s.status).toBe("FREE_READY");
    expect(s.open).toBe(false);
    expect(s.free.canStart).toBe(true);
    expect(s.milestones).toEqual({});
    expect(s.break.canStart).toBe(false); // R8b: no focus yet, so no bank
    expect(computeDayState(legacy(input()), vn(`${TODAY} 00:00:30`)).break.canStart).toBe(true); // before 0014
  });
});

// ---------------------------------------------------------------------------
// Exact-second boundaries
// ---------------------------------------------------------------------------

describe("boundaries at the exact second", () => {
  const onBreak = legacy(normalDay({ sessions: [session(TODAY, { ...P1_DONE, breakStartedAt: iso(`${TODAY} 16:00`) })] }));

  it("break: 1 second before +10:00 is BREAK, exactly +10:00 is LOCK_P2 [legacy before 0014]", () => {
    expect(computeDayState(onBreak, vn(`${TODAY} 16:09:59`)).status).toBe("BREAK");
    const end = computeDayState(onBreak, vn(`${TODAY} 16:10:00`));
    expect(end.status).toBe("LOCK_P2");
    expect(end.break.state).toBe("done");
  });

  const onFree = normalDay({ sessions: [session(TODAY, { ...P1_DONE, freeStartedAt: iso(`${TODAY} 19:00`) })] });

  it("free: 1 second before +45:00 is FREE, exactly +45:00 is LOCK_END", () => {
    expect(computeDayState(onFree, vn(`${TODAY} 19:44:59`)).status).toBe("FREE");
    expect(computeDayState(onFree, vn(`${TODAY} 19:45:00`)).status).toBe("LOCK_END");
  });

  it("override: `until` exactly now is no longer in effect", () => {
    const i = normalDay({ overrides: [ov("open_until", `${TODAY} 20:00`, `${TODAY} 19:00`)] });
    expect(computeDayState(i, vn(`${TODAY} 19:59:59`)).status).toBe("OPEN_OVERRIDE");
    expect(computeDayState(i, vn(`${TODAY} 20:00:00`)).status).toBe("LOCK_P1");
  });
});

// ---------------------------------------------------------------------------
// Overrides
// ---------------------------------------------------------------------------

describe("overrides", () => {
  it("newest wins: older open + newer lock → LOCK_OVERRIDE", () => {
    const s = computeDayState(
      normalDay({
        overrides: [
          ov("open_until", `${TODAY} 22:00`, `${TODAY} 18:00`),
          ov("lock_until", `${TODAY} 21:00`, `${TODAY} 18:30`),
        ],
      }),
      vn(`${TODAY} 19:00`),
    );
    expect(s.status).toBe("LOCK_OVERRIDE");
  });

  it("newest wins: older lock + newer open → OPEN_OVERRIDE", () => {
    const s = computeDayState(
      normalDay({
        overrides: [
          ov("open_until", `${TODAY} 19:30`, `${TODAY} 18:30`),
          ov("lock_until", `${TODAY} 23:00`, `${TODAY} 18:00`),
        ],
      }),
      vn(`${TODAY} 19:00`),
    );
    expect(s.status).toBe("OPEN_OVERRIDE");
    expect(s.openUntil).toBe(iso(`${TODAY} 19:30`));
  });

  it("the newest override supersedes older ones: once it expires, the normal flow applies (decision 14/10)", () => {
    // 18:00 open until 22:00, 18:10 lock until 18:30 → at 19:00 the old open does NOT come back.
    const s = computeDayState(
      normalDay({
        overrides: [
          ov("open_until", `${TODAY} 22:00`, `${TODAY} 18:00`),
          ov("lock_until", `${TODAY} 18:30`, `${TODAY} 18:10`),
        ],
      }),
      vn(`${TODAY} 19:00`),
    );
    expect(s.status).toBe("LOCK_P1");
    expect(s.open).toBe(false);
    expect(s.openUntil).toBeNull();
  });

  it("while the newest (lock) is in effect, an older open is ignored", () => {
    const s = computeDayState(
      normalDay({
        overrides: [
          ov("open_until", `${TODAY} 22:00`, `${TODAY} 18:00`),
          ov("lock_until", `${TODAY} 18:30`, `${TODAY} 18:10`),
        ],
      }),
      vn(`${TODAY} 18:29:59`),
    );
    expect(s.status).toBe("LOCK_OVERRIDE");
  });

  it("same created_at: lock wins", () => {
    const s = computeDayState(
      normalDay({
        overrides: [
          ov("open_until", `${TODAY} 22:00`, `${TODAY} 18:00`),
          ov("lock_until", `${TODAY} 22:00`, `${TODAY} 18:00`),
        ],
      }),
      vn(`${TODAY} 19:00`),
    );
    expect(s.status).toBe("LOCK_OVERRIDE");
  });

  it("an override for another local date is ignored", () => {
    const s = computeDayState(
      normalDay({ overrides: [ov("open_until", `${TODAY} 22:00`, `${YESTERDAY} 23:00`, YESTERDAY)] }),
      vn(`${TODAY} 19:00`),
    );
    expect(s.status).toBe("LOCK_P1");
  });

  it("openUntil is clipped at 00:00", () => {
    const s = computeDayState(
      normalDay({ overrides: [ov("open_until", `${TOMORROW} 02:00`, `${TODAY} 23:00`)] }),
      vn(`${TODAY} 23:30`),
    );
    expect(s.status).toBe("OPEN_OVERRIDE");
    expect(s.openUntil).toBe(MIDNIGHT);
  });
});

// ---------------------------------------------------------------------------
// Crossing 00:00
// ---------------------------------------------------------------------------

describe("crossing 00:00", () => {
  const lateFree = session(TODAY, {
    ...P1_DONE,
    breakSkipped: true,
    part2DoneAt: iso(`${TODAY} 23:40`),
    freeStartedAt: iso(`${TODAY} 23:40`),
  });

  it("free time started 23:40 → openUntil clipped to 00:00", () => {
    const s = computeDayState(normalDay({ sessions: [lateFree] }), vn(`${TODAY} 23:50`));
    expect(s.status).toBe("FREE");
    expect(s.openUntil).toBe(MIDNIGHT);
    expect(s.free.endsAt).toBe(MIDNIGHT);
  });

  it("break started 23:55 → openUntil clipped to 00:00", () => {
    const s = computeDayState(
      normalDay({ sessions: [session(TODAY, { ...P1_DONE, breakStartedAt: iso(`${TODAY} 23:55`) })] }),
      vn(`${TODAY} 23:58`),
    );
    expect(s.status).toBe("BREAK");
    expect(s.openUntil).toBe(MIDNIGHT);
  });

  it("at 00:00 the next day starts in LOCK_P1 (nothing carries over)", () => {
    const s = computeDayState(normalDay({ sessions: [lateFree] }), vn(`${TOMORROW} 00:00`));
    expect(s.localDate).toBe(TOMORROW);
    expect(s.status).toBe("LOCK_P1");
    expect(s.open).toBe(false);
    expect(s.free).toEqual({ canStart: false, startedAt: null, endsAt: null, bonusMinutes: 0 });
    expect(s.week.at(-2)).toEqual({ date: TODAY, result: "miss" }); // done 23:40 > bedtime 21:30
  });
});

// ---------------------------------------------------------------------------
// Passes
// ---------------------------------------------------------------------------

describe("passes (Monday-week)", () => {
  const usedSaturday = session("2026-10-17", {
    passUsedAt: iso("2026-10-17 18:00"),
    freeStartedAt: iso("2026-10-17 18:00"),
  });

  it("a pass used on Saturday is gone on Sunday", () => {
    const s = computeDayState(normalDay({ sessions: [usedSaturday] }), vn("2026-10-18 15:00"));
    expect(s.passAvailable).toBe(false);
    expect(s.passesLeft).toBe(0);
  });

  it("a new week (Monday) resets passes", () => {
    const s = computeDayState(normalDay({ sessions: [usedSaturday] }), vn("2026-10-19 00:00"));
    expect(s.passAvailable).toBe(true);
    expect(s.passesLeft).toBe(1);
  });

  it("no pass when today already has free_started_at", () => {
    const s = computeDayState(
      normalDay({ sessions: [session(TODAY, { ...P1_DONE, freeStartedAt: iso(`${TODAY} 19:00`) })] }),
      vn(`${TODAY} 20:00`),
    );
    expect(s.passesLeft).toBe(1);
    expect(s.passAvailable).toBe(false);
  });

  it("passes_per_week comes from family_settings", () => {
    const s = computeDayState(
      normalDay({ settings: { ...SETTINGS, passesPerWeek: 2 }, sessions: [session("2026-10-12", { passUsedAt: iso("2026-10-12 18:00") })] }),
      vn(`${TODAY} 15:00`),
    );
    expect(s.passesLeft).toBe(1);
    expect(s.passAvailable).toBe(true);
  });

  it("a pass used today makes the day 'pass' in the week strip", () => {
    const s = computeDayState(
      normalDay({ sessions: [session(TODAY, { passUsedAt: iso(`${TODAY} 18:00`), freeStartedAt: iso(`${TODAY} 18:00`) })] }),
      vn(`${TODAY} 18:10`),
    );
    expect(s.week.at(-1)).toEqual({ date: TODAY, result: "pass" });
  });
});

// ---------------------------------------------------------------------------
// Part 1 composition
// ---------------------------------------------------------------------------

describe("Part 1 composition", () => {
  const NOW = vn(`${TODAY} 15:00`);
  const keys = (i: DayInput) => computeDayState(i, NOW).part1.items.map((x) => x.key);

  it("homework: every unfinished item listed (due first, then upcoming); archived and done earlier excluded", () => {
    const i = input({
      homework: [
        hw("due-today", { dueDate: TODAY }),
        hw("due-tomorrow", { dueDate: TOMORROW }),
        hw("overdue", { dueDate: "2026-10-10" }),
        hw("day-after", { dueDate: "2026-10-16" }),
        hw("archived", { dueDate: TODAY, archivedAt: iso(`${TODAY} 08:00`) }),
        hw("done-yesterday", { dueDate: TODAY, doneAt: iso(`${YESTERDAY} 20:00`) }),
        hw("done-today", { dueDate: TOMORROW, doneAt: iso(`${TODAY} 14:00`), createdAt: iso(`${YESTERDAY} 21:00`) }),
      ],
    });
    const s = computeDayState(i, NOW);
    expect(s.part1.items.map((x) => x.id)).toEqual(["overdue", "due-today", "due-tomorrow", "done-today", "day-after"]);
    expect(s.part1.items.find((x) => x.id === "overdue")?.overdue).toBe(true);
    expect(s.part1.items.find((x) => x.id === "due-today")?.overdue).toBe(false);
    expect(s.part1.items.find((x) => x.id === "day-after")?.group).toBe("upcoming");
    expect(s.part1.items.find((x) => x.id === "due-today")?.group).toBe("due");
    // the upcoming item is listed but not required (there is due homework today)
    expect(s.part1.pick).toEqual({ needed: 0, done: 0 });
    expect(s.part1.total).toBe(4);
    expect(s.part1.done).toBe(1);
    expect(s.part1.items.find((x) => x.id === "done-today")?.state).toBe("done");
  });

  it("homework_lookahead_days = 0 makes tomorrow 'upcoming' (listed, not required)", () => {
    const i = input({
      settings: { ...SETTINGS, homeworkLookaheadDays: 0 },
      homework: [hw("t", { dueDate: TODAY }), hw("tm", { dueDate: TOMORROW })],
    });
    expect(keys(i)).toEqual(["homework:t", "homework:tm"]);
    const s = computeDayState(i, NOW);
    expect(s.part1.items.map((x) => x.group)).toEqual(["due", "upcoming"]);
    expect(s.part1.total).toBe(1);
  });

  it("extra templates: weekday filter, inactive and disabled_template_ids excluded, sorted", () => {
    const i = input({
      sessions: [session(TODAY, { disabledTemplateIds: ["disabled"] })],
      templates: [
        tpl("wed-b", "extra", { weekdays: [3], sort: 2 }),
        tpl("wed-a", "extra", { weekdays: [1, 3, 5], sort: 1 }),
        tpl("mon-only", "extra", { weekdays: [1] }),
        tpl("inactive", "extra", { active: false }),
        tpl("disabled", "extra"),
        tpl("skill", "skill"),
      ],
    });
    expect(keys(i)).toEqual(["template:wed-a", "template:wed-b"]);
  });

  it("homework comes before extra templates", () => {
    const i = input({ homework: [hw("h")], templates: [tpl("e", "extra")] });
    expect(keys(i)).toEqual(["homework:h", "template:e"]);
  });

  it("placeholder slot: shown with placeholder=true but not counted", () => {
    const slots: AppSlotInput[] = [
      { id: "van", kind: "placeholder", label: "App Văn", url: null, active: true },
      { id: "math", kind: "internal", label: "App Toán", url: "https://math.example/app", active: true },
    ];
    const s = computeDayState(
      input({
        appSlots: slots,
        templates: [tpl("e-van", "extra", { appSlotId: "van" }), tpl("e-math", "extra", { appSlotId: "math", sort: 1 })],
      }),
      NOW,
    );
    const van = s.part1.items.find((x) => x.id === "e-van");
    expect(van?.placeholder).toBe(true);
    expect(van?.state).toBe("placeholder");
    expect(van?.deepLink).toBeNull();
    expect(s.part1.items.find((x) => x.id === "e-math")?.deepLink).toBe("https://math.example/app");
    expect(s.part1.total).toBe(1);
    expect(s.status).toBe("LOCK_P1");
  });

  it("template deep_link takes precedence over the slot url", () => {
    const s = computeDayState(
      input({
        appSlots: [{ id: "math", kind: "internal", label: "App Toán", url: "https://math.example", active: true }],
        templates: [tpl("e", "extra", { appSlotId: "math", deepLink: "https://math.example/lesson/7" })],
      }),
      NOW,
    );
    expect(s.part1.items[0]?.deepLink).toBe("https://math.example/lesson/7");
    // R6a: the child sees which app it opens.
    expect(s.part1.items[0]?.appLabel).toBe("App Toán");
  });

  it("R6a: the app name falls back to the link's site; none without a link", () => {
    const s = computeDayState(input({ templates: [tpl("e", "extra", { deepLink: "https://www.khanacademy.org/math/x" }), tpl("s", "skill")] }), NOW);
    expect(s.part1.items[0]?.appLabel).toBe("khanacademy.org");
    expect(s.part2.items[0]?.appLabel).toBeNull();
    expect(appLabelOf("  ", "not a url")).toBeNull();
    expect(appLabelOf(null, null)).toBeNull();
  });

  it("a Part 1 with only placeholders is empty → done", () => {
    const s = computeDayState(
      input({
        appSlots: [{ id: "van", kind: "placeholder", label: "App Văn", url: null, active: true }],
        templates: [tpl("e-van", "extra", { appSlotId: "van" })],
      }),
      NOW,
    );
    expect(s.part1.total).toBe(0);
    expect(s.part1.items).toHaveLength(1);
    expect(s.part1.complete).toBe(true);
    expect(s.milestones).toEqual({}); // both parts empty: nothing frozen until the child presses
    expect(s.status).toBe("FREE_READY");
  });

  it("homework added after part1_done_at is shown but does not re-lock", () => {
    const s = computeDayState(
      normalDay({
        homework: [
          hw("old", { doneAt: iso(`${TODAY} 15:00`) }),
          hw("new", { createdAt: iso(`${TODAY} 18:00`) }),
        ],
        templates: [tpl("e1", "extra"), tpl("s1", "skill")],
        runs: [run({ templateId: "e1", startedAt: iso(`${TODAY} 15:10`), doneAt: iso(`${TODAY} 15:40`) })],
        sessions: [session(TODAY, P1_DONE)],
      }),
      vn(`${TODAY} 18:30`),
    );
    expect(s.status).toBe("LOCK_P2");
    expect(s.part1.complete).toBe(true);
    expect(s.part1.total).toBe(3);
    expect(s.part1.done).toBe(2);
    expect(s.part1.items.find((x) => x.id === "new")?.addedAfterPart1Done).toBe(true);
    expect(s.part1.items.find((x) => x.id === "old")?.addedAfterPart1Done).toBe(false);
    expect(s.milestones).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Empty parts and lazily written milestones
// ---------------------------------------------------------------------------

describe("empty parts and milestones", () => {
  it("empty Part 1 counts as done (break may start) but is NOT frozen while Part 2 is open", () => {
    const s = computeDayState(input({ templates: [tpl("s1", "skill")] }), vn(`${TODAY} 07:00`));
    expect(s.milestones).toEqual({});
    expect(s.part1.complete).toBe(true);
    expect(s.part1.doneAt).toBeNull();
    expect(s.status).toBe("LOCK_P2");
    expect(s.break.canStart).toBe(false); // R8b: no focus, no bank
    expect(computeDayState(legacy(input({ templates: [tpl("s1", "skill")] })), vn(`${TODAY} 07:00`)).break.canStart).toBe(true); // E5d before 0014
  });

  it("E16: empty Part 1 at 06:00, homework assigned at 06:30 before Part 2 is done → LOCK_P1", () => {
    const later = computeDayState(
      input({ templates: [tpl("s1", "skill")], homework: [hw("late", { createdAt: iso(`${TODAY} 06:30`) })] }),
      vn(`${TODAY} 06:35`),
    );
    expect(later.status).toBe("LOCK_P1");
    expect(later.milestones).toEqual({});
  });

  it("E15: empty Part 1 is frozen when Part 2 is done; free time starts; later homework does not re-lock", () => {
    const now = vn(`${TODAY} 07:00`);
    const doneSkill = run({ templateId: "s1", startedAt: iso(`${TODAY} 06:35`), doneAt: iso(`${TODAY} 06:58`) });
    const s = computeDayState(input({ templates: [tpl("s1", "skill")], runs: [doneSkill] }), now);
    expect(s.milestones).toEqual({ part1DoneAt: now.toISOString(), part2DoneAt: now.toISOString(), freeStartedAt: now.toISOString() });
    expect(s.status).toBe("FREE");

    const later = computeDayState(
      input({
        templates: [tpl("s1", "skill")],
        runs: [doneSkill],
        homework: [hw("late", { createdAt: iso(`${TODAY} 17:00`) })],
        sessions: [session(TODAY, { part1DoneAt: now.toISOString(), part2DoneAt: now.toISOString(), freeStartedAt: now.toISOString() })],
      }),
      vn(`${TODAY} 17:05`),
    );
    expect(later.status).toBe("LOCK_END");
    expect(later.part1.items.find((x) => x.id === "late")?.addedAfterPart1Done).toBe(true);
  });

  it("an entirely empty day stays FREE_READY (nothing frozen, even at 00:00 or after a break)", () => {
    expect(computeDayState(input(), vn(`${TODAY} 00:00:30`)).status).toBe("FREE_READY");
    const s = computeDayState(
      input({ sessions: [session(TODAY, { breakStartedAt: iso(`${TODAY} 07:00`) })] }),
      vn(`${TODAY} 07:20`),
    );
    expect(s.status).toBe("FREE_READY");
    expect(s.milestones).toEqual({});
    expect(s.free.canStart).toBe(true);
  });

  it("empty day: homework assigned before the child presses → LOCK_P1, no free-time button", () => {
    const s = computeDayState(input({ homework: [hw("h", { createdAt: iso(`${TODAY} 08:00`) })] }), vn(`${TODAY} 08:05`));
    expect(s.status).toBe("LOCK_P1");
    expect(s.free.canStart).toBe(false);
  });

  it("empty day after the press (route wrote the 3 milestones) → FREE", () => {
    const at = iso(`${TODAY} 15:00`);
    const s = computeDayState(input({ sessions: [session(TODAY, { part1DoneAt: at, part2DoneAt: at, freeStartedAt: at })] }), vn(`${TODAY} 15:10`));
    expect(s.status).toBe("FREE");
    expect(s.free.canStart).toBe(false);
    expect(s.milestones).toEqual({});
  });

  it("empty day: no free-time button during a parent lock", () => {
    const s = computeDayState(input({ overrides: [ov("lock_until", `${TODAY} 18:00`, `${TODAY} 15:00`)] }), vn(`${TODAY} 15:10`));
    expect(s.status).toBe("LOCK_OVERRIDE");
    expect(s.free.canStart).toBe(false);
  });

  it("Part 1 finished by tasks → part1DoneAt milestone, LOCK_P2 (no break step)", () => {
    const now = vn(`${TODAY} 16:00`);
    const s = computeDayState(
      normalDay({
        homework: [hw("h1", { doneAt: iso(`${TODAY} 15:00`) })],
        runs: [run({ templateId: "e1", startedAt: iso(`${TODAY} 15:10`), doneAt: iso(`${TODAY} 15:35`) })],
      }),
      now,
    );
    expect(s.milestones).toEqual({ part1DoneAt: now.toISOString() });
    expect(s.status).toBe("LOCK_P2");
  });

  it("E14: empty Part 2 is frozen when Part 1 is done → FREE at once", () => {
    const now = vn(`${TODAY} 18:00`);
    const s = computeDayState(
      input({
        homework: [hw("h1", { doneAt: iso(`${TODAY} 17:50`) })],
      }),
      now,
    );
    expect(s.milestones).toEqual({ part1DoneAt: now.toISOString(), part2DoneAt: now.toISOString(), freeStartedAt: now.toISOString() });
    expect(s.status).toBe("FREE");
    expect(s.openUntil).toBe(iso(`${TODAY} 18:45`));
  });

  it("E2: Part 2 done first, Part 1 not done → part2DoneAt, LOCK_P1, no free time", () => {
    const now = vn(`${TODAY} 17:40`);
    const s = computeDayState(normalDay({ runs: [run({ templateId: "s1", startedAt: iso(`${TODAY} 17:15`), doneAt: iso(`${TODAY} 17:38`) })] }), now);
    expect(s.milestones).toEqual({ part2DoneAt: now.toISOString() });
    expect(s.status).toBe("LOCK_P1");
    expect(s.part2.complete).toBe(true);
    expect(s.free.startedAt).toBeNull();
    expect(s.break).toMatchObject({ canStart: false, bankMinutes: 0, blockFocusMinutes: 23 }); // R8b: 23' of focus < 45'
    const before = computeDayState(legacy(normalDay({ runs: [run({ templateId: "s1", startedAt: iso(`${TODAY} 17:15`), doneAt: iso(`${TODAY} 17:38`) })] })), now);
    expect(before.break.canStart).toBe(true); // E5b before 0014
  });

  it("E4: Part 1 finished last → part1DoneAt + freeStartedAt in one read", () => {
    const now = vn(`${TODAY} 19:00`);
    const s = computeDayState(
      normalDay({
        homework: [hw("h1", { doneAt: iso(`${TODAY} 18:58`) })],
        sessions: [session(TODAY, { part2DoneAt: iso(`${TODAY} 17:40`) })],
        runs: [
          run({ templateId: "s1", startedAt: iso(`${TODAY} 17:15`), doneAt: iso(`${TODAY} 17:38`) }),
          run({ templateId: "e1", startedAt: iso(`${TODAY} 18:00`), doneAt: iso(`${TODAY} 18:25`) }),
        ],
      }),
      now,
    );
    expect(s.milestones).toEqual({ part1DoneAt: now.toISOString(), freeStartedAt: now.toISOString() });
    expect(s.status).toBe("FREE");
    // R8b: 23' + 25' = 48' of focus earned 10' of break, never taken: added to the 45'.
    expect(s.openUntil).toBe(iso(`${TODAY} 19:55`));
    expect(s.free.bonusMinutes).toBe(10);
  });

  it("Part 2 finished last → part2DoneAt + freeStartedAt", () => {
    const now = vn(`${TODAY} 17:00`);
    const s = computeDayState(
      normalDay({
        sessions: [session(TODAY, P1_DONE)],
        runs: [run({ templateId: "s1", startedAt: iso(`${TODAY} 16:30`), doneAt: iso(`${TODAY} 16:55`) })],
      }),
      now,
    );
    expect(s.milestones).toEqual({ part2DoneAt: now.toISOString(), freeStartedAt: now.toISOString() });
    expect(s.part2).toMatchObject({ total: 1, done: 1, complete: true });
    expect(s.status).toBe("FREE");
  });

  it("E21: a pass never freezes a part; finishing after a pass writes only the milestones", () => {
    const passed = { passUsedAt: iso(`${TODAY} 18:00`), freeStartedAt: iso(`${TODAY} 18:00`) };
    const s0 = computeDayState(input({ templates: [tpl("s1", "skill")], sessions: [session(TODAY, passed)] }), vn(`${TODAY} 18:05`));
    expect(s0.milestones).toEqual({}); // empty Part 1 not frozen by the pass
    const now = vn(`${TODAY} 19:00`);
    const s = computeDayState(
      normalDay({
        sessions: [session(TODAY, { ...P1_DONE, ...passed })],
        runs: [run({ templateId: "s1", startedAt: iso(`${TODAY} 18:30`), doneAt: iso(`${TODAY} 18:55`) })],
      }),
      now,
    );
    expect(s.milestones).toEqual({ part2DoneAt: now.toISOString() });
    expect(s.free.startedAt).toBe(iso(`${TODAY} 18:00`));
    expect(s.status).toBe("LOCK_END");
  });

  it("stored milestones are not returned again", () => {
    const s = computeDayState(
      input({
        sessions: [session(TODAY, { ...P1_DONE, part2DoneAt: iso(`${TODAY} 17:00`), freeStartedAt: iso(`${TODAY} 17:00`) })],
      }),
      vn(`${TODAY} 17:10`),
    );
    expect(s.milestones).toEqual({});
    expect(s.status).toBe("FREE");
  });

  it("both milestones without free_started_at (no lock in effect) → free time starts now", () => {
    const now = vn(`${TODAY} 17:10`);
    const s = computeDayState(input({ sessions: [session(TODAY, { ...P1_DONE, part2DoneAt: iso(`${TODAY} 17:00`) })] }), now);
    expect(s.milestones).toEqual({ freeStartedAt: now.toISOString() });
    expect(s.status).toBe("FREE");
    expect(s.openUntil).toBe(iso(`${TODAY} 17:55`));
  });

  it("E17: homework added after Part 1 is done does not block free time", () => {
    const now = vn(`${TODAY} 19:00`);
    const s = computeDayState(
      normalDay({
        homework: [hw("h1", { doneAt: iso(`${TODAY} 15:00`) }), hw("new", { createdAt: iso(`${TODAY} 17:00`) })],
        sessions: [session(TODAY, P1_DONE)],
        runs: [
          run({ templateId: "e1", startedAt: iso(`${TODAY} 15:10`), doneAt: iso(`${TODAY} 15:40`) }),
          run({ templateId: "s1", startedAt: iso(`${TODAY} 18:30`), doneAt: iso(`${TODAY} 18:55`) }),
        ],
      }),
      now,
    );
    expect(s.status).toBe("FREE");
    expect(s.milestones).toEqual({ part2DoneAt: now.toISOString(), freeStartedAt: now.toISOString() });
  });

  it("a skill enabled after part2_done_at is listed but Part 2 stays done (interpretation 13)", () => {
    const s = computeDayState(
      normalDay({
        templates: [tpl("e1", "extra"), tpl("s1", "skill"), tpl("s2", "skill")],
        sessions: [session(TODAY, { part2DoneAt: iso(`${TODAY} 17:00`) })],
        runs: [run({ templateId: "s1", startedAt: iso(`${TODAY} 16:30`), doneAt: iso(`${TODAY} 16:55`) })],
      }),
      vn(`${TODAY} 18:00`),
    );
    expect(s.part2.complete).toBe(true);
    expect(s.part2.total).toBe(2);
    expect(s.status).toBe("LOCK_P1");
  });
});

// ---------------------------------------------------------------------------
// Parent decision 14/10/2026: free time is deferred while a parent lock is in effect
// ---------------------------------------------------------------------------

describe("free time during a parent lock override", () => {
  const finishedSkill = run({ templateId: "s1", startedAt: iso(`${TODAY} 17:30`), doneAt: iso(`${TODAY} 17:55`) });
  const day = (sessionPatch: Partial<DaySessionInput>) =>
    normalDay({
      sessions: [session(TODAY, { ...P1_DONE, breakSkipped: true, ...sessionPatch })],
      runs: [finishedSkill],
      overrides: [ov("lock_until", `${TODAY} 18:30`, `${TODAY} 17:50`)],
    });

  it("Part 2 done during the lock → part2DoneAt only, free time NOT started", () => {
    const now = vn(`${TODAY} 18:00`);
    const s = computeDayState(day({}), now);
    expect(s.milestones).toEqual({ part2DoneAt: now.toISOString() });
    expect(s.status).toBe("LOCK_OVERRIDE");
    expect(s.free.startedAt).toBeNull();
    expect(s.passAvailable).toBe(true); // nothing was used yet
  });

  it("still locked one second before the lock ends, no free time yet", () => {
    const s = computeDayState(day({ part2DoneAt: iso(`${TODAY} 18:00`) }), vn(`${TODAY} 18:29:59`));
    expect(s.status).toBe("LOCK_OVERRIDE");
    expect(s.milestones).toEqual({});
  });

  it("first read after the lock ends → free time starts then, full 45 minutes", () => {
    const now = vn(`${TODAY} 18:30`);
    const s = computeDayState(day({ part2DoneAt: iso(`${TODAY} 18:00`) }), now);
    expect(s.milestones).toEqual({ freeStartedAt: now.toISOString() });
    expect(s.status).toBe("FREE");
    expect(s.openUntil).toBe(iso(`${TODAY} 19:15`));
  });

  it("deferred free time is still clipped at 00:00", () => {
    const lateDay = normalDay({
      sessions: [session(TODAY, { ...P1_DONE, breakSkipped: true, part2DoneAt: iso(`${TODAY} 23:00`) })],
      runs: [finishedSkill],
      overrides: [ov("lock_until", `${TODAY} 23:40`, `${TODAY} 22:50`)],
    });
    const s = computeDayState(lateDay, vn(`${TODAY} 23:40`));
    expect(s.status).toBe("FREE");
    expect(s.openUntil).toBe(MIDNIGHT);
  });

  it("E23: no skills, Part 1 done at 20:00 under a lock until 22:00 → both milestones at 20:00 (day OK), free at 22:00", () => {
    const at20 = vn(`${TODAY} 20:00`);
    const lockDay = (patch: Partial<DaySessionInput>) =>
      input({
        homework: [hw("h1", { doneAt: iso(`${TODAY} 19:58`) })],
        overrides: [ov("lock_until", `${TODAY} 22:00`, `${TODAY} 19:00`)],
        sessions: [session(TODAY, patch)],
      });
    const s = computeDayState(lockDay({}), at20);
    expect(s.milestones).toEqual({ part1DoneAt: at20.toISOString(), part2DoneAt: at20.toISOString() });
    expect(s.status).toBe("LOCK_OVERRIDE");
    const at22 = vn(`${TODAY} 22:00`);
    const after = computeDayState(lockDay({ part1DoneAt: at20.toISOString(), part2DoneAt: at20.toISOString() }), at22);
    expect(after.milestones).toEqual({ freeStartedAt: at22.toISOString() });
    expect(after.status).toBe("FREE");
    expect(after.week.at(-1)?.result).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// R1 (parent decisions 07/11/2026): parallel parts and the break (docs/MAN_CHINH_MOI.md §1.4)
// ---------------------------------------------------------------------------

describe("parallel parts and the break (R1)", () => {
  const now = vn(`${TODAY} 17:05`);
  const skillsDone = [run({ templateId: "s1", startedAt: iso(`${TODAY} 17:15`), doneAt: iso(`${TODAY} 17:38`) })];

  it("E1: skills are listed with nothing done; the web stays locked", () => {
    const s = computeDayState(normalDay(), now);
    expect(s.status).toBe("LOCK_P1");
    expect(s.part2.items.map((i) => i.state)).toEqual(["todo"]);
  });

  it("E5: no part done → no break", () => {
    expect(computeDayState(normalDay(), now).break).toMatchObject({ state: "not_yet", canStart: false });
  });

  it("E5b: Part 2 done, Part 1 not → break may start; when running it opens until +10', then LOCK_P1 [legacy before 0014]", () => {
    const at = vn(`${TODAY} 17:40`);
    const offer = computeDayState(legacy(normalDay({ runs: skillsDone, sessions: [session(TODAY, { part2DoneAt: iso(`${TODAY} 17:40`) })] })), at);
    expect(offer.break.canStart).toBe(true);
    const running = normalDay({ runs: skillsDone, sessions: [session(TODAY, { part2DoneAt: iso(`${TODAY} 17:40`), breakStartedAt: iso(`${TODAY} 17:40`) })] });
    expect(computeDayState(running, vn(`${TODAY} 17:49:59`)).status).toBe("BREAK");
    expect(computeDayState(running, vn(`${TODAY} 17:50:00`)).status).toBe("LOCK_P1");
  });

  it("E5c: Part 1 done → break may start, then LOCK_P2", () => {
    const s = computeDayState(normalDay({ sessions: [session(TODAY, { ...P1_DONE, breakStartedAt: iso(`${TODAY} 18:30`) })] }), vn(`${TODAY} 18:40`));
    expect(s.status).toBe("LOCK_P2");
  });

  it("E6: once used, no second break [legacy before 0014]", () => {
    const s = computeDayState(
      legacy(normalDay({ sessions: [session(TODAY, { ...P1_DONE, breakStartedAt: iso(`${TODAY} 16:05`) })] })),
      vn(`${TODAY} 17:00`),
    );
    expect(s.break).toMatchObject({ state: "done", canStart: false });
  });

  it("E7: no break while a timed task is running", () => {
    const s = computeDayState(
      normalDay({ sessions: [session(TODAY, P1_DONE)], runs: [run({ templateId: "s1", startedAt: iso(`${TODAY} 17:00`) })] }),
      now,
    );
    expect(s.status).toBe("LOCK_P2");
    expect(s.break.canStart).toBe(false);
  });

  it("a running homework (no timer) does not block the break", () => {
    const s = computeDayState(
      legacy(
        normalDay({
          sessions: [session(TODAY, { part2DoneAt: iso(`${TODAY} 17:00`) })],
          runs: [...skillsDone, run({ source: "homework", homeworkItemId: "h1", startedAt: iso(`${TODAY} 17:01`) })],
        }),
      ),
      now,
    );
    expect(s.break.canStart).toBe(true);
    // R8b: the running homework is focus (16:00 -> 17:05 = 65') and does not block the break either.
    const bank = computeDayState(normalDay({ runs: [run({ source: "homework", homeworkItemId: "h1", startedAt: iso(`${TODAY} 16:00`) })] }), now);
    expect(bank.break).toMatchObject({ canStart: true, bankMinutes: 10, blockFocusMinutes: 65 });
  });

  it("E9 + E10: never taking the break is fine; no break once free time started", () => {
    const s = computeDayState(input({ sessions: [session(TODAY, { ...P1_DONE, part2DoneAt: iso(`${TODAY} 19:00`), freeStartedAt: iso(`${TODAY} 19:00`) })] }), vn(`${TODAY} 19:10`));
    expect(s.status).toBe("FREE");
    expect(s.break.canStart).toBe(false);
  });

  it("E11: break at 23:55 is clipped at 00:00", () => {
    const s = computeDayState(normalDay({ sessions: [session(TODAY, { ...P1_DONE, breakStartedAt: iso(`${TODAY} 23:55`) })] }), vn(`${TODAY} 23:58`));
    expect(s.openUntil).toBe(MIDNIGHT);
  });

  it("E12 + E13: no break during a parent lock, trust, sick day or a parent open", () => {
    const base = { sessions: [session(TODAY, P1_DONE)] };
    const lock = computeDayState(normalDay({ ...base, overrides: [ov("lock_until", `${TODAY} 18:00`, `${TODAY} 16:30`)] }), now);
    const trust = computeDayState(normalDay({ ...base, trustMode: "trust" }), now);
    const sick = computeDayState(normalDay({ sessions: [session(TODAY, { ...P1_DONE, dayType: "sick" })] }), now);
    const open = computeDayState(normalDay({ ...base, overrides: [ov("open_until", `${TODAY} 18:00`, `${TODAY} 16:30`)] }), now);
    for (const s of [lock, trust, sick, open]) expect(s.break.canStart).toBe(false);
  });

  it("a day without skills: the break still comes after the homework (empty Part 2 alone does not open it)", () => {
    const noSkills = input({ homework: [hw("h1")], templates: [tpl("e1", "extra")] });
    expect(computeDayState(noSkills, vn(`${TODAY} 06:00`)).break.canStart).toBe(false);
  });

  it("empty day: the free-time button only where it means something (locked, or trust)", () => {
    const open = computeDayState(input({ overrides: [ov("open_until", `${TODAY} 18:00`, `${TODAY} 15:00`)] }), vn(`${TODAY} 15:10`));
    expect(open.free.canStart).toBe(false);
    const sick = computeDayState(input({ sessions: [session(TODAY, { dayType: "sick" })] }), vn(`${TODAY} 15:10`));
    expect(sick.free.canStart).toBe(false);
    const trust = computeDayState(input({ trustMode: "trust" }), vn(`${TODAY} 15:10`));
    expect(trust.free.canStart).toBe(true);
  });

  it("break_minutes = 0 → no break button", () => {
    const s = computeDayState(normalDay({ settings: { ...SETTINGS, breakMinutes: 0 }, sessions: [session(TODAY, P1_DONE)] }), now);
    expect(s.break.canStart).toBe(false);
  });

  it("E22: free time starts during a break → FREE (the rest of the break is dropped) [legacy before 0014]", () => {
    const at = vn(`${TODAY} 18:05`);
    const s = computeDayState(
      legacy(normalDay({
        homework: [hw("h1", { doneAt: iso(`${TODAY} 18:04`) })],
        sessions: [session(TODAY, { part2DoneAt: iso(`${TODAY} 17:40`), breakStartedAt: iso(`${TODAY} 18:00`) })],
        runs: [...skillsDone, run({ templateId: "e1", startedAt: iso(`${TODAY} 17:00`), doneAt: iso(`${TODAY} 17:25`) })],
      })),
      at,
    );
    expect(s.status).toBe("FREE");
    expect(s.openUntil).toBe(iso(`${TODAY} 18:50`));
    expect(s.break.state).toBe("done");
  });

  it("milestones are still computed in OPEN_TRUST / OPEN_SICK / OPEN_OVERRIDE", () => {
    const at = vn(`${TODAY} 17:40`);
    const trust = computeDayState(normalDay({ trustMode: "trust", runs: skillsDone }), at);
    expect(trust.status).toBe("OPEN_TRUST");
    expect(trust.milestones).toEqual({ part2DoneAt: at.toISOString() });
  });
});

// ---------------------------------------------------------------------------
// Task views: minimum minutes, runs, proof
// ---------------------------------------------------------------------------

describe("task views", () => {
  const now = vn(`${TODAY} 15:30`);
  const custom = { ...SETTINGS, extraMinMinutes: 25, skillMinMinutes: 15 };

  it("min minutes: template value wins, otherwise family_settings per part (0 is respected)", () => {
    const s = computeDayState(
      input({
        settings: custom,
        sessions: [session(TODAY, { ...P1_DONE, breakSkipped: true })],
        templates: [
          tpl("e-own", "extra", { minMinutes: 30 }),
          tpl("e-def", "extra", { sort: 1 }),
          tpl("e-zero", "extra", { minMinutes: 0, sort: 2 }),
          tpl("s-def", "skill"),
        ],
      }),
      now,
    );
    const min = Object.fromEntries([...s.part1.items, ...s.part2.items].map((x) => [x.id, x.minMinutes]));
    expect(min).toEqual({ "e-own": 30, "e-def": 25, "e-zero": 0, "s-def": 15 });
  });

  it("canFinishAt = startedAt + min for a running template task", () => {
    const s = computeDayState(
      normalDay({ runs: [run({ id: "r-e1", templateId: "e1", startedAt: iso(`${TODAY} 15:00`) })] }),
      now,
    );
    const e1 = s.part1.items.find((x) => x.id === "e1");
    expect(e1).toMatchObject({
      runId: "r-e1",
      state: "running",
      startedAt: iso(`${TODAY} 15:00`),
      canFinishAt: iso(`${TODAY} 15:20`),
      doneAt: null,
      requiresProof: false,
    });
  });

  it("homework has no minimum but requires proof", () => {
    const s = computeDayState(
      normalDay({
        runs: [
          run({
            id: "r-h1",
            source: "homework",
            homeworkItemId: "h1",
            startedAt: iso(`${TODAY} 15:00`),
            proofPaths: ["a.jpg"],
          }),
        ],
      }),
      now,
    );
    expect(s.part1.items.find((x) => x.id === "h1")).toMatchObject({
      source: "homework",
      part: 1,
      minMinutes: 0,
      canFinishAt: iso(`${TODAY} 15:00`),
      requiresProof: true,
      proofCount: 1,
      state: "running",
      dueDate: TOMORROW,
    });
  });

  it("not started → canFinishAt null; runs from another day are ignored", () => {
    const s = computeDayState(
      normalDay({ runs: [run({ templateId: "e1", localDate: YESTERDAY, startedAt: iso(`${YESTERDAY} 20:00`) })] }),
      now,
    );
    expect(s.part1.items.find((x) => x.id === "e1")).toMatchObject({
      runId: null,
      startedAt: null,
      canFinishAt: null,
      state: "todo",
    });
  });

  it("a finished run is preferred over a later unfinished one", () => {
    const s = computeDayState(
      normalDay({
        runs: [
          run({ id: "done", templateId: "e1", startedAt: iso(`${TODAY} 14:00`), doneAt: iso(`${TODAY} 14:25`) }),
          run({ id: "open", templateId: "e1", startedAt: iso(`${TODAY} 15:00`) }),
        ],
      }),
      now,
    );
    expect(s.part1.items.find((x) => x.id === "e1")).toMatchObject({ runId: "done", state: "done" });
  });

  it("Part 2 items are skill templates of today", () => {
    const s = computeDayState(
      input({ templates: [tpl("s-wed", "skill", { weekdays: [3] }), tpl("s-thu", "skill", { weekdays: [4] })] }),
      now,
    );
    expect(s.part2.items.map((x) => [x.key, x.part])).toEqual([["template:s-wed", 2]]);
  });
});

// ---------------------------------------------------------------------------
// R8a "Làm thêm": extra runs of a done template (interpretation 10)
// ---------------------------------------------------------------------------

describe("R8a Làm thêm (extra runs)", () => {
  const required = () => run({ id: "req", templateId: "e1", startedAt: iso(`${TODAY} 14:00`), doneAt: iso(`${TODAY} 14:25`) });
  const extraOpen = () => run({ id: "x1", templateId: "e1", startedAt: iso(`${TODAY} 15:00`) });
  /** Both parts done (only e1 + s1), free time started at 14:50 (open until 15:35). */
  const doneDay = (runs: TaskRunInput[]) =>
    input({
      templates: [tpl("e1", "extra"), tpl("s1", "skill")],
      sessions: [session(TODAY, { part1DoneAt: iso(`${TODAY} 14:30`), part2DoneAt: iso(`${TODAY} 14:30`), freeStartedAt: iso(`${TODAY} 14:50`) })],
      runs: [required(), run({ id: "s-run", templateId: "s1", startedAt: iso(`${TODAY} 13:00`), doneAt: iso(`${TODAY} 13:20`) }), ...runs],
    });
  const strip = (st: ReturnType<typeof computeDayState>) => ({
    status: st.status,
    open: st.open,
    openUntil: st.openUntil,
    p1: [st.part1.total, st.part1.done, st.part1.complete, st.part1.doneAt],
    p2: [st.part2.total, st.part2.done, st.part2.complete, st.part2.doneAt],
    free: st.free,
    breakView: st.break,
    milestones: st.milestones,
  });

  it("done + extra running: still done, parts / free time / lock unchanged, todayMinutes sums", () => {
    const now = vn(`${TODAY} 15:30:40`);
    const without = computeDayState(doneDay([]), now);
    const withExtra = computeDayState(doneDay([extraOpen()]), now);
    expect(strip(withExtra)).toEqual(strip(without));
    expect(withExtra.status).toBe("FREE");
    expect(withExtra.part1.items.find((x) => x.id === "e1")).toMatchObject({
      state: "done",
      runId: "req",
      startedAt: iso(`${TODAY} 14:00`),
      doneAt: iso(`${TODAY} 14:25`),
      extra: { runId: "x1", startedAt: iso(`${TODAY} 15:00`) },
      todayMinutes: 55, // 25 + 30 (the running run up to now, floored)
      sessions: 2,
    });
    expect(without.part1.items.find((x) => x.id === "e1")).toMatchObject({ extra: null, todayMinutes: 25, sessions: 1 });
  });

  it("an extra run never re-locks or finishes a part: Part 2 still open stays LOCK_P2", () => {
    const now = vn(`${TODAY} 15:30`);
    const d = input({ templates: [tpl("e1", "extra"), tpl("s1", "skill")], runs: [required(), extraOpen()] });
    const s = computeDayState(d, now);
    expect(s.status).toBe("LOCK_P2");
    expect(s.part1.complete).toBe(true);
    expect(s.part2).toMatchObject({ total: 1, done: 0, complete: false });
    expect(s.milestones).toEqual({ part1DoneAt: now.toISOString() });
    // A timed (extra) run is running: no break (interpretation 2).
    expect(s.break.canStart).toBe(false);
    expect(computeDayState(legacy(input({ templates: [tpl("e1", "extra"), tpl("s1", "skill")], runs: [required()] })), now).break.canStart).toBe(true);
  });

  it("the earliest done run is the required one, whatever the order; later runs are extra", () => {
    const later = run({ id: "later", templateId: "e1", startedAt: iso(`${TODAY} 14:30`), doneAt: iso(`${TODAY} 14:35`) });
    const s = computeDayState(normalDay({ runs: [later, required()] }), vn(`${TODAY} 15:00`));
    expect(s.part1.items.find((x) => x.id === "e1")).toMatchObject({
      runId: "req",
      startedAt: iso(`${TODAY} 14:00`),
      doneAt: iso(`${TODAY} 14:25`),
      canFinishAt: iso(`${TODAY} 14:20`),
      extra: null,
      todayMinutes: 30,
      sessions: 2,
    });
  });

  it("an unfinished extra run from yesterday is ignored (rule 11)", () => {
    const stale = run({ id: "old", templateId: "e1", localDate: YESTERDAY, startedAt: iso(`${YESTERDAY} 20:00`) });
    const s = computeDayState(normalDay({ runs: [required(), stale] }), vn(`${TODAY} 15:00`));
    expect(s.part1.items.find((x) => x.id === "e1")).toMatchObject({ state: "done", runId: "req", extra: null, todayMinutes: 25, sessions: 1 });
  });

  it("an unfinished run started before the required run was done (a double start) is ignored", () => {
    const orphan = run({ id: "orphan", templateId: "e1", startedAt: iso(`${TODAY} 14:00:01`) });
    const s = computeDayState(normalDay({ runs: [required(), orphan] }), vn(`${TODAY} 18:00`));
    expect(s.part1.items.find((x) => x.id === "e1")).toMatchObject({ state: "done", extra: null, todayMinutes: 25, sessions: 1 });
  });

  it("todayMinutes floors the SUM of the runs; a running required run counts up to now", () => {
    const a = run({ id: "a", templateId: "e1", startedAt: iso(`${TODAY} 14:00:00`), doneAt: iso(`${TODAY} 14:20:30`) });
    const b = run({ id: "b", templateId: "e1", startedAt: iso(`${TODAY} 14:30:00`), doneAt: iso(`${TODAY} 14:30:40`) });
    const s = computeDayState(normalDay({ runs: [a, b] }), vn(`${TODAY} 15:00`));
    expect(s.part1.items.find((x) => x.id === "e1")).toMatchObject({ todayMinutes: 21, sessions: 2 });

    const r = computeDayState(normalDay({ runs: [run({ id: "r", templateId: "e1", startedAt: iso(`${TODAY} 14:50`) })] }), vn(`${TODAY} 15:02:59`));
    expect(r.part1.items.find((x) => x.id === "e1")).toMatchObject({ state: "running", extra: null, todayMinutes: 12, sessions: 1 });
    const todo = computeDayState(normalDay(), vn(`${TODAY} 15:00`));
    expect(todo.part1.items.map((x) => [x.id, x.todayMinutes, x.sessions, x.extra])).toEqual([
      ["h1", 0, 0, null],
      ["e1", 0, 0, null],
    ]);
  });

  it("homework never has an extra run, even with a later run of its own", () => {
    const s = computeDayState(
      normalDay({
        homework: [hw("h1", { doneAt: iso(`${TODAY} 14:10`) })],
        runs: [
          run({ id: "h-run", source: "homework", homeworkItemId: "h1", startedAt: iso(`${TODAY} 14:00`), doneAt: iso(`${TODAY} 14:10`) }),
          run({ id: "h-again", source: "homework", homeworkItemId: "h1", startedAt: iso(`${TODAY} 14:30`) }),
        ],
      }),
      vn(`${TODAY} 15:00`),
    );
    expect(s.part1.items.find((x) => x.id === "h1")).toMatchObject({ state: "done", extra: null, sessions: 1 });
  });

  it("a malformed instant in an extra run throws (fail-closed)", () => {
    const bad = run({ id: "bad", templateId: "e1", startedAt: "not-a-date" });
    expect(() => computeDayState(normalDay({ runs: [required(), bad] }), vn(`${TODAY} 15:00`))).toThrow(/invalid instant/);
  });
});

// ---------------------------------------------------------------------------
// "Ngày đạt" and the 7-day strip
// ---------------------------------------------------------------------------

describe("ngày đạt / week strip", () => {
  const done = (date: string, time: string, patch: Partial<DaySessionInput> = {}) =>
    session(date, { part1DoneAt: iso(`${date} ${time}`), part2DoneAt: iso(`${date} ${time}`), ...patch });

  it("E18: both milestones are needed before bedtime (parts finish in any order)", () => {
    const s = computeDayState(
      input({
        sessions: [
          // skills 18:00, homework 22:00 → not OK
          session("2026-10-11", { part2DoneAt: iso("2026-10-11 18:00"), part1DoneAt: iso("2026-10-11 22:00") }),
          // homework 18:00, skills 21:00 → OK
          session("2026-10-12", { part1DoneAt: iso("2026-10-12 18:00"), part2DoneAt: iso("2026-10-12 21:00") }),
          // skills only → not OK
          session(YESTERDAY, { part2DoneAt: iso(`${YESTERDAY} 18:00`) }),
        ],
      }),
      vn(`${TODAY} 15:00`),
    );
    expect(s.week.slice(-4, -1).map((d) => d.result)).toEqual(["miss", "ok", "miss"]);
  });

  it("covers bedtime, pass, sick, holiday, exam and missing days", () => {
    const s = computeDayState(
      input({
        sessions: [
          done("2026-10-08", "21:29:59"), // before bedtime → ok
          done("2026-10-09", "21:30"), // exactly bedtime → miss
          session("2026-10-10", { passUsedAt: iso("2026-10-10 18:00") }), // pass
          session("2026-10-11", { dayType: "sick" }), // sick
          session("2026-10-12", { dayType: "holiday" }), // holiday → ok
          session(YESTERDAY, { dayType: "exam" }), // exam not auto ok → miss
        ],
        templates: [tpl("e1", "extra")],
      }),
      vn(`${TODAY} 15:00`),
    );
    expect(s.week).toEqual([
      { date: "2026-10-08", result: "ok" },
      { date: "2026-10-09", result: "miss" },
      { date: "2026-10-10", result: "pass" },
      { date: "2026-10-11", result: "sick" },
      { date: "2026-10-12", result: "ok" },
      { date: YESTERDAY, result: "miss" },
      { date: TODAY, result: "today" },
    ]);
  });

  it("exam day counts when Part 2 was done before bedtime; bedtime comes from the profile", () => {
    const s = computeDayState(
      input({
        bedtime: "22:00",
        sessions: [done(YESTERDAY, "21:45", { dayType: "exam" }), done("2026-10-12", "22:00")],
      }),
      vn(`${TODAY} 15:00`),
    );
    expect(s.week.at(-2)?.result).toBe("ok");
    expect(s.week.at(-3)?.result).toBe("miss");
  });

  it("today becomes 'ok' once Part 2 is done before bedtime", () => {
    const s = computeDayState(
      input({ sessions: [session(TODAY, { ...P1_DONE, breakSkipped: true })] }),
      vn(`${TODAY} 17:00`),
    );
    expect(s.week.at(-1)).toEqual({ date: TODAY, result: "ok" });
  });

  it("today stays 'today' (not 'miss') after bedtime while unfinished; sick today shows 'sick'", () => {
    expect(computeDayState(normalDay(), vn(`${TODAY} 22:00`)).week.at(-1)?.result).toBe("today");
    expect(
      computeDayState(normalDay({ sessions: [session(TODAY, { dayType: "sick" })] }), vn(`${TODAY} 10:00`)).week.at(-1)
        ?.result,
    ).toBe("sick");
  });
});

// ---------------------------------------------------------------------------
// Trust progress
// ---------------------------------------------------------------------------

describe("trust progress", () => {
  const NOW = vn(`${TODAY} 15:00`); // current week starts Mon 2026-10-12
  const W1 = "2026-10-05"; // most recent complete week
  const W2 = "2026-09-28";
  const W3 = "2026-09-21";
  const W4 = "2026-09-14";

  /** A Monday-week with `okDays` OK days (Part 2 done at 20:00), the rest missed. */
  function week(monday: string, okDays: number): DaySessionInput[] {
    const out: DaySessionInput[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(`${monday}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + d);
      const day = date.toISOString().slice(0, 10);
      out.push(d < okDays ? session(day, { part1DoneAt: iso(`${day} 19:00`), part2DoneAt: iso(`${day} 20:00`) }) : session(day));
    }
    return out;
  }

  it("3 consecutive weeks ≥ 90% → weeksMet 3 and suggestTrust (never auto-switch)", () => {
    const s = computeDayState(input({ sessions: [...week(W1, 7), ...week(W2, 7), ...week(W3, 7)] }), NOW);
    expect(s.trust).toEqual({ mode: "lock", weeksMet: 3, weeksNeeded: 3, suggestTrust: true, suggestLock: false });
    expect(s.status).toBe("FREE_READY"); // still the normal locked flow
  });

  it("counts only consecutive most-recent weeks", () => {
    const olderBad = computeDayState(input({ sessions: [...week(W1, 7), ...week(W2, 7), ...week(W3, 6)] }), NOW);
    expect(olderBad.trust.weeksMet).toBe(2);
    expect(olderBad.trust.suggestTrust).toBe(false);
    const recentBad = computeDayState(input({ sessions: [...week(W1, 6), ...week(W2, 7), ...week(W3, 7)] }), NOW);
    expect(recentBad.trust.weeksMet).toBe(0);
  });

  it("the current (incomplete) week and missing data never count", () => {
    const s = computeDayState(
      input({ sessions: [...week("2026-10-12", 2), ...week(W1, 7), ...week(W2, 7)] }),
      NOW,
    );
    expect(s.trust.weeksMet).toBe(2);
    expect(computeDayState(input(), NOW).trust.weeksMet).toBe(0);
  });

  it("thresholds come from family_settings; weeksMet is capped at weeksNeeded", () => {
    const lenient = { ...SETTINGS, trustUpPct: 85, trustUpWeeks: 2 };
    const s = computeDayState(
      input({ settings: lenient, sessions: [...week(W1, 6), ...week(W2, 6), ...week(W3, 7), ...week(W4, 7)] }),
      NOW,
    );
    expect(s.trust).toMatchObject({ weeksMet: 2, weeksNeeded: 2, suggestTrust: true });
  });

  it("sick / holiday / pass days count as OK; exam days do not", () => {
    const w = week(W1, 4);
    w[4] = session(w[4]!.localDate, { dayType: "sick" });
    w[5] = session(w[5]!.localDate, { dayType: "holiday" });
    w[6] = session(w[6]!.localDate, { passUsedAt: iso(`${w[6]!.localDate} 18:00`) });
    const s = computeDayState(input({ settings: { ...SETTINGS, trustUpWeeks: 1 }, sessions: w }), NOW);
    expect(s.trust.weeksMet).toBe(1);
    w[6] = session(w[6]!.localDate, { dayType: "exam" });
    expect(computeDayState(input({ settings: { ...SETTINGS, trustUpWeeks: 1 }, sessions: w }), NOW).trust.weeksMet).toBe(0);
  });

  it("in trust mode: last complete week < 70% → suggestLock; ≥ 70% → no suggestion", () => {
    const bad = computeDayState(input({ trustMode: "trust", sessions: [...week(W1, 4), ...week(W2, 7)] }), NOW);
    expect(bad.trust).toMatchObject({ mode: "trust", suggestLock: true, suggestTrust: false });
    const ok = computeDayState(input({ trustMode: "trust", sessions: [...week(W1, 5), ...week(W2, 1)] }), NOW);
    expect(ok.trust.suggestLock).toBe(false);
  });

  it("lock mode never suggests lock", () => {
    expect(computeDayState(input({ sessions: week(W1, 0) }), NOW).trust.suggestLock).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

describe("purity", () => {
  it("serverNow echoes `now`", () => {
    const now = vn(`${TODAY} 15:00:07`);
    expect(computeDayState(normalDay(), now).serverNow).toBe(now.toISOString());
  });

  it("never reads the real clock", () => {
    const i = normalDay({ sessions: [session(TODAY, { ...P1_DONE, freeStartedAt: iso(`${TODAY} 19:00`) })] });
    const now = vn(`${TODAY} 19:30`);
    const expected = computeDayState(i, now);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("1999-01-01T00:00:00Z"));
    const underFakeClock = computeDayState(i, now);
    vi.setSystemTime(new Date("2099-12-31T23:59:59Z"));
    const underFutureClock = computeDayState(i, now);
    expect(underFakeClock).toEqual(expected);
    expect(underFutureClock).toEqual(expected);
    expect(underFakeClock.status).toBe("FREE");
    expect(underFakeClock.serverNow).toBe(now.toISOString());
  });

  it("does not mutate the input", () => {
    const i = input({ sessions: [session(TODAY, { breakSkipped: true })] });
    const snapshot = structuredClone(i);
    computeDayState(i, vn(`${TODAY} 07:00`));
    expect(i).toEqual(snapshot);
  });

  it("throws on a malformed instant (caller stays fail-closed)", () => {
    expect(() =>
      computeDayState(input({ sessions: [session(TODAY, { freeStartedAt: "not-a-date" })] }), vn(`${TODAY} 07:00`)),
    ).toThrow(/invalid instant/);
    expect(() => computeDayState(input(), new Date(Number.NaN))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// S2c (parent decisions 17/10/2026): homework groups, empty-day quota, ★ sớm
// ---------------------------------------------------------------------------

describe("homework groups and the empty-day quota (interpretation 17)", () => {
  const NOW = vn(`${TODAY} 15:00`);
  const LATER = "2026-10-20";
  const LATER2 = "2026-10-22";

  it("no due homework: one upcoming item is required (default 1), the child picks which", () => {
    const s = computeDayState(input({ homework: [hw("a", { dueDate: LATER }), hw("b", { dueDate: LATER2 })] }), NOW);
    expect(s.part1.pick).toEqual({ needed: 1, done: 0 });
    expect(s.part1.total).toBe(1);
    expect(s.part1.done).toBe(0);
    expect(s.status).toBe("LOCK_P1");
  });

  it("finishing any one upcoming item completes Part 1 on an empty day", () => {
    const s = computeDayState(
      input({
        homework: [hw("a", { dueDate: LATER }), hw("b", { dueDate: LATER2, doneAt: iso(`${TODAY} 14:30`) })],
      }),
      NOW,
    );
    expect(s.part1.pick).toEqual({ needed: 1, done: 1 });
    expect(s.part1.done).toBe(1);
    expect(s.part1.complete).toBe(true);
    expect(s.milestones.part1DoneAt).toBe(NOW.toISOString());
    expect(s.status).toBe("FREE"); // no skills today: empty Part 2 is frozen with Part 1
  });

  it("quota never exceeds the upcoming items that exist", () => {
    const s = computeDayState(
      input({ settings: { ...SETTINGS, homeworkMinUpcoming: 3 }, homework: [hw("a", { dueDate: LATER })] }),
      NOW,
    );
    expect(s.part1.pick.needed).toBe(1);
  });

  it("homework_min_upcoming = 0 turns the rule off (empty Part 1 as before)", () => {
    const s = computeDayState(
      input({ settings: { ...SETTINGS, homeworkMinUpcoming: 0 }, homework: [hw("a", { dueDate: LATER })] }),
      NOW,
    );
    expect(s.part1.pick.needed).toBe(0);
    expect(s.part1.total).toBe(0);
    expect(s.status).toBe("FREE_READY"); // both parts empty
    expect(s.milestones.part1DoneAt).toBeUndefined(); // still not frozen (interpretation 15)
  });

  it("due homework present: upcoming items are optional, extra upcoming done does not count", () => {
    const s = computeDayState(
      input({
        homework: [hw("due", { dueDate: TODAY }), hw("up", { dueDate: LATER, doneAt: iso(`${TODAY} 10:00`) })],
      }),
      NOW,
    );
    expect(s.part1.pick).toEqual({ needed: 0, done: 1 });
    expect(s.part1.total).toBe(1);
    expect(s.part1.done).toBe(0);
    expect(s.status).toBe("LOCK_P1");
  });

  it("due homework finished today still counts as a due day (no extra quota)", () => {
    const s = computeDayState(
      input({ homework: [hw("due", { dueDate: TODAY, doneAt: iso(`${TODAY} 09:00`) }), hw("up", { dueDate: LATER })] }),
      NOW,
    );
    expect(s.part1.pick.needed).toBe(0);
    expect(s.part1.complete).toBe(true);
  });

  it("extra templates stay required alongside the quota", () => {
    const s = computeDayState(
      input({ homework: [hw("up", { dueDate: LATER, doneAt: iso(`${TODAY} 10:00`) })], templates: [tpl("x", "extra")] }),
      NOW,
    );
    expect(s.part1.total).toBe(2);
    expect(s.part1.done).toBe(1);
    expect(s.status).toBe("LOCK_P1");
  });

  it("frozen Part 1 is not re-locked when the quota changes later (interpretation 13)", () => {
    const s = computeDayState(
      input({
        sessions: [session(TODAY, P1_DONE)],
        homework: [hw("new-up", { dueDate: LATER, createdAt: iso(`${TODAY} 17:00`) })],
      }),
      vn(`${TODAY} 18:00`),
    );
    expect(s.part1.complete).toBe(true);
    expect(s.status).toBe("FREE");
  });

  it("templates carry group null", () => {
    const s = computeDayState(input({ templates: [tpl("x", "extra")] }), NOW);
    expect(s.part1.items[0]?.group).toBeNull();
  });
});

describe("★ sớm (interpretation 18)", () => {
  const NOW = vn(`${TODAY} 15:00`);

  it("early = finished on a date at least 2 days before the due date", () => {
    const s = computeDayState(
      input({
        homework: [
          hw("two-days", { dueDate: "2026-10-16", doneAt: iso(`${TODAY} 10:00`) }),
          hw("one-day", { dueDate: TOMORROW, doneAt: iso(`${TODAY} 11:00`) }),
          hw("late-night", { dueDate: "2026-10-16", doneAt: iso(`${TODAY} 23:30`) }),
        ],
      }),
      NOW,
    );
    const early = Object.fromEntries(s.part1.items.map((x) => [x.id, x.early]));
    expect(early).toEqual({ "two-days": true, "one-day": false, "late-night": true });
  });

  it("earlyThisWeek counts early homework done since Monday, even if not listed today", () => {
    const s = computeDayState(
      input({
        homework: [
          hw("mon", { dueDate: "2026-10-15", doneAt: iso("2026-10-12 19:00") }),
          hw("tue", { dueDate: "2026-10-20", doneAt: iso(`${YESTERDAY} 19:00`) }),
          hw("tue-not-early", { dueDate: TODAY, doneAt: iso(`${YESTERDAY} 19:00`) }),
          hw("last-week", { dueDate: "2026-10-15", doneAt: iso("2026-10-11 19:00") }),
          hw("archived", { dueDate: "2026-10-20", doneAt: iso(`${YESTERDAY} 19:00`), archivedAt: iso(`${TODAY} 08:00`) }),
        ],
      }),
      NOW,
    );
    expect(s.earlyThisWeek).toBe(2);
    expect(s.part1.items).toHaveLength(0); // none done today, none unfinished
  });

  it("★ never changes status or counts", () => {
    const a = computeDayState(input({ homework: [hw("x", { dueDate: TODAY })] }), NOW);
    expect(a.earlyThisWeek).toBe(0);
    expect(a.status).toBe("LOCK_P1");
  });
});

// ---------------------------------------------------------------------------
// R8b "Ngân hàng giờ nghỉ" (parent decision 08/11/2026): gold examples G1-G18
// (docs/superpowers/specs/2026-11-09-r8-design.md) + earn boundaries, union, midnight, legacy.
// ---------------------------------------------------------------------------

describe("R8b break bank", () => {
  let brkSeq = 0;
  /** A day_breaks row: started at `start`, planned minutes, ended early at `ended` ("Học tiếp"). */
  function brk(start: string, planned: number, ended: string | null = null): BreakRowInput {
    brkSeq += 1;
    return { id: `brk-${brkSeq}`, localDate: TODAY, startedAt: iso(`${TODAY} ${start}`), plannedMinutes: planned, endedAt: ended === null ? null : iso(`${TODAY} ${ended}`) };
  }
  const t = (hhmm: string) => iso(`${TODAY} ${hhmm}`);
  const at = (hhmm: string) => vn(`${TODAY} ${hhmm}`);
  /** A finished template run of e1 (Part 1) or s1 (Part 2). */
  const tplRun = (templateId: "e1" | "s1", from: string, to: string | null) => run({ templateId, startedAt: t(from), doneAt: to === null ? null : t(to) });
  const hwRun = (from: string, to: string | null) => run({ source: "homework", homeworkItemId: "h1", startedAt: t(from), doneAt: to === null ? null : t(to) });
  /** Homework h1 finished at `doneAt` (so Part 1 can complete). */
  const hwDone = (doneAt: string) => [hw("h1", { doneAt: t(doneAt) })];

  describe("earnBreak (default tiers [[45,10],[90,30],[120,45],[180,60]])", () => {
    it.each([
      [0, 0],
      [44, 0],
      [45, 10],
      [89, 10],
      [90, 30],
      [119, 30],
      [120, 45],
      [179, 45],
      [180, 60],
      [224, 60],
      [225, 70],
      [270, 90],
      [360, 120],
    ])("%i' of focus → %i' of break", (f, b) => expect(earnBreak(f)).toBe(b));

    it("fractions are floored; negative / NaN earn nothing", () => {
      expect(earnBreak(44.99)).toBe(0);
      expect(earnBreak(-5)).toBe(0);
      expect(earnBreak(Number.NaN)).toBe(0);
    });

    it("custom tiers are data: [[30,5],[60,15]] → 65' earns 15 + earn(5) = 15, 90' earns 15 + 5", () => {
      const custom = [
        [30, 5],
        [60, 15],
      ];
      expect(earnBreak(29, custom)).toBe(0);
      expect(earnBreak(30, custom)).toBe(5);
      expect(earnBreak(65, custom)).toBe(15);
      expect(earnBreak(90, custom)).toBe(20);
    });

    it("malformed tiers fall back to the defaults", () => {
      for (const bad of [null, undefined, "x", {}, [], [[45]], [[45, 10], [40, 30]], [[45, 30], [90, 30]], [[0, 10]], [[45, -1]], [[45.5, 10]], [["45", 10]], Array(9).fill([1, 1])]) {
        expect(validBreakTiers(bad)).toBe(false);
        expect(earnBreak(50, bad)).toBe(10);
        expect(earnBreak(225, bad)).toBe(70);
      }
      expect(validBreakTiers(DEFAULT_BREAK_TIERS)).toBe(true);
    });

    it("malformed tiers in family_settings: the day uses the defaults (never crashes)", () => {
      const d = normalDay({ settings: { ...SETTINGS, breakTiers: { nope: true } }, runs: [tplRun("e1", "15:00", "15:50")] });
      expect(computeDayState(d, at("15:51")).break).toMatchObject({ bankMinutes: 10, canStart: true });
    });
  });

  describe("focus = union of run intervals", () => {
    const m = (hhmm: string) => vn(`${TODAY} ${hhmm}`).getTime();
    const day0 = m("00:00");

    it("overlapping runs count once; gaps do not count", () => {
      const f = focusIntervals(
        [
          [m("15:00"), m("15:40")],
          [m("15:10"), m("16:00")],
          [m("17:00"), m("17:10")],
        ],
        [],
        day0,
        m("23:00"),
      );
      expect(f).toEqual([
        [m("15:00"), m("16:00")],
        [m("17:00"), m("17:10")],
      ]);
    });

    it("excluded windows are cut out; the result is clipped to the day and to `until`", () => {
      const f = focusIntervals([[m("15:00"), m("16:00")]], [[m("15:20"), m("15:30")], [m("15:50"), Infinity]], day0, m("23:00"));
      expect(f).toEqual([
        [m("15:00"), m("15:20")],
        [m("15:30"), m("15:50")],
      ]);
      expect(focusIntervals([[day0 - 30 * 60_000, m("00:10")]], [], day0, m("23:00"))).toEqual([[day0, m("00:10")]]);
      expect(focusIntervals([[m("22:00"), m("23:30")]], [], day0, m("23:00"))).toEqual([[m("22:00"), m("23:00")]]);
    });

    it("breakBank: blocks close at each break start; used = floored minutes", () => {
      const focus = [[m("08:00"), m("09:40")] as const, [m("09:52"), m("10:22")] as const];
      const r = breakBank(focus, [{ startMs: m("09:40"), endMs: m("09:52") + 30_000 }], DEFAULT_BREAK_TIERS, day0, m("10:23"));
      expect(r).toEqual({ bankMinutes: 18, earnedMinutes: 30, usedMinutes: 12, blockFocusMinutes: 30 });
    });
  });

  describe("gold examples", () => {
    it("G1: 50' focus → bank 10 → canStart", () => {
      const s = computeDayState(normalDay({ runs: [tplRun("e1", "15:00", "15:50")] }), at("15:51"));
      expect(s.status).toBe("LOCK_P1");
      expect(s.break).toMatchObject({ legacy: false, bankMinutes: 10, blockFocusMinutes: 50, canStart: true, state: "offer", takenToday: 0, maxPerDay: 6 });
      expect(s.break.nextTier).toEqual({ atFocus: 90, minutes: 30 });
    });

    it("G2: 95' focus in one go → bank 30", () => {
      const s = computeDayState(normalDay({ runs: [tplRun("e1", "15:00", "16:35")] }), at("16:36"));
      expect(s.break).toMatchObject({ bankMinutes: 30, blockFocusMinutes: 95, canStart: true });
      expect(s.break.nextTier).toEqual({ atFocus: 120, minutes: 45 });
    });

    it("G3: Math OS 20' then English OS 40' (one after the other) → block 60 → bank 10", () => {
      const s = computeDayState(normalDay({ runs: [tplRun("e1", "15:00", "15:20"), tplRun("s1", "15:20", "16:00")] }), at("16:01"));
      expect(s.break).toMatchObject({ bankMinutes: 10, blockFocusMinutes: 60 });
    });

    it("G4: 50' → break 10' (used fully) → 40' → bank 0 (new block of 40)", () => {
      const s = computeDayState(
        normalDay({ runs: [tplRun("e1", "15:00", "15:50"), tplRun("s1", "16:00", "16:40")], breaks: [brk("15:50", 10)] }),
        at("16:41"),
      );
      expect(s.break).toMatchObject({ bankMinutes: 0, blockFocusMinutes: 40, canStart: false, takenToday: 1, state: "not_yet" });
      expect(s.break.nextTier).toEqual({ atFocus: 45, minutes: 10 });
    });

    it("G5: 45' → break 10' → 45' → bank 10 (not 20: the block resets)", () => {
      const s = computeDayState(
        normalDay({ runs: [tplRun("e1", "15:00", "15:45"), tplRun("s1", "15:55", "16:40")], breaks: [brk("15:45", 10)] }),
        at("16:41"),
      );
      expect(s.break).toMatchObject({ bankMinutes: 10, blockFocusMinutes: 45, canStart: true });
    });

    it.each([
      [120, 45],
      [180, 60],
      [225, 70],
      [270, 90],
    ])("G6: %i' in one go → bank %i", (minutes, bank) => {
      const start = vn(`${TODAY} 08:00`).getTime();
      const end = new Date(start + minutes * 60_000).toISOString();
      const s = computeDayState(normalDay({ runs: [run({ templateId: "e1", startedAt: t("08:00"), doneAt: end })] }), new Date(start + (minutes + 1) * 60_000));
      expect(s.break.bankMinutes).toBe(bank);
    });

    it("G7: 100' → break (30') → “Học tiếp” after 12' → 30' focus → bank 18 → canStart (≥ 5)", () => {
      const before = computeDayState(normalDay({ runs: [tplRun("e1", "08:00", "09:40")] }), at("09:40"));
      expect(before.break.bankMinutes).toBe(30); // what the route plans at the start
      const s = computeDayState(
        normalDay({ runs: [tplRun("e1", "08:00", "09:40"), tplRun("s1", "09:52", "10:22")], breaks: [brk("09:40", 30, "09:52")] }),
        at("10:23"),
      );
      expect(s.break).toMatchObject({ bankMinutes: 18, blockFocusMinutes: 30, canStart: true, takenToday: 1 });
      // Right after "Học tiếp", the 18 unused minutes show as the bank.
      expect(computeDayState(normalDay({ runs: [tplRun("e1", "08:00", "09:40")], breaks: [brk("09:40", 30, "09:52")] }), at("09:53")).break.bankMinutes).toBe(18);
    });

    it("G8: 120' in one go, then both parts done → free time = 45 + 45 = 90'", () => {
      const now = at("10:00");
      const d = normalDay({ homework: hwDone("09:00"), runs: [hwRun("08:00", "09:00"), tplRun("e1", "09:00", "09:40"), tplRun("s1", "09:40", "10:00")] });
      const s = computeDayState(d, now);
      expect(s.milestones.freeStartedAt).toBe(now.toISOString());
      expect(s.status).toBe("FREE");
      expect(s.free).toMatchObject({ bonusMinutes: 45, endsAt: t("11:30") });
      expect(s.openUntil).toBe(t("11:30"));
      expect(s.break.bankMinutes).toBe(0); // moved into free time
      // Deterministic: a later read (free_started_at stored, a "Làm thêm" run after it) agrees.
      const stored = [session(TODAY, { part1DoneAt: now.toISOString(), part2DoneAt: now.toISOString(), freeStartedAt: now.toISOString() })];
      const later = computeDayState({ ...d, runs: [...d.runs, tplRun("e1", "10:05", "10:45")], sessions: stored }, at("10:50"));
      expect(later.free).toMatchObject({ bonusMinutes: 45, endsAt: t("11:30") });
      expect(computeDayState({ ...d, sessions: stored }, at("11:29:59")).status).toBe("FREE");
      expect(computeDayState({ ...d, sessions: stored }, at("11:30")).status).toBe("LOCK_END");
    });

    it("G9: 50', break 10', 60' more, then both parts done → free time = 45 + 10 = 55'", () => {
      const s = computeDayState(
        normalDay({
          homework: hwDone("08:50"),
          runs: [hwRun("08:00", "08:50"), tplRun("e1", "09:00", "09:40"), tplRun("s1", "09:40", "10:00")],
          breaks: [brk("08:50", 10)],
        }),
        at("10:00"),
      );
      expect(s.status).toBe("FREE");
      expect(s.free).toMatchObject({ bonusMinutes: 10, endsAt: t("10:55") });
    });

    it("G10: homework 40' and skill 50' overlapping for 30' → focus = union (60'), not the sum (90')", () => {
      const s = computeDayState(normalDay({ runs: [hwRun("15:00", "15:40"), tplRun("s1", "15:10", "16:00")] }), at("16:01"));
      expect(s.break).toMatchObject({ blockFocusMinutes: 60, bankMinutes: 10 });
    });

    it("G11: 6 breaks taken, bank 30 → canStart false; the bank is added to free time later", () => {
      const six = ["06:00", "06:01", "06:02", "06:03", "06:04", "06:05"].map((h) => brk(h, 5, h));
      const s = computeDayState(normalDay({ runs: [tplRun("e1", "07:00", "08:35")], breaks: six }), at("08:36"));
      expect(s.break).toMatchObject({ bankMinutes: 30, canStart: false, takenToday: 6, maxPerDay: 6, state: "done", nextTier: null });
      const done = computeDayState(normalDay({ homework: hwDone("08:40"), runs: [tplRun("e1", "07:00", "08:35"), tplRun("s1", "08:35", "08:40")], breaks: six }), at("08:41"));
      expect(done.status).toBe("FREE");
      expect(done.free.bonusMinutes).toBe(30); // 100' block → 30
    });

    it("G12: parent LOCK override in effect, bank 30 → canStart false; focus during the lock still counts", () => {
      const s = computeDayState(
        normalDay({ runs: [tplRun("e1", "15:00", "16:35")], overrides: [ov("lock_until", `${TODAY} 17:00`, `${TODAY} 15:30`)] }),
        at("16:36"),
      );
      expect(s.status).toBe("LOCK_OVERRIDE");
      expect(s.break).toMatchObject({ bankMinutes: 30, blockFocusMinutes: 95, canStart: false });
      // A parent OPEN window is not focus (the laptop was open anyway): 95' - 30' = 65' → 10.
      const open = computeDayState(normalDay({ runs: [tplRun("e1", "15:00", "16:35")], overrides: [ov("open_until", `${TODAY} 16:00`, `${TODAY} 15:30`)] }), at("16:36"));
      expect(open.break).toMatchObject({ blockFocusMinutes: 65, bankMinutes: 10 });
      // An open window superseded early by a newer lock: only 15:30-15:40 is cut.
      const cut = computeDayState(
        normalDay({ runs: [tplRun("e1", "15:00", "16:35")], overrides: [ov("open_until", `${TODAY} 16:00`, `${TODAY} 15:30`), ov("lock_until", `${TODAY} 15:45`, `${TODAY} 15:40`)] }),
        at("16:36"),
      );
      expect(cut.break.blockFocusMinutes).toBe(85);
    });

    it("G13: free time started → canStart false; later runs add no focus", () => {
      const pass = session(TODAY, { passUsedAt: t("15:00"), freeStartedAt: t("15:00") });
      const s = computeDayState(normalDay({ sessions: [pass], runs: [tplRun("e1", "14:00", "14:50"), tplRun("s1", "15:10", "16:40")] }), at("15:30"));
      expect(s.status).toBe("FREE");
      expect(s.break).toMatchObject({ canStart: false, bankMinutes: 0, nextTier: null });
      expect(s.free).toMatchObject({ bonusMinutes: 10, endsAt: t("15:55") }); // only the 50' before 15:00
    });

    it("G14: break running, the homework run continues during it → the break minutes are not focus", () => {
      const d = normalDay({ runs: [hwRun("15:00", null)], breaks: [brk("15:50", 10)] });
      const during = computeDayState(d, at("15:55"));
      expect(during.status).toBe("BREAK");
      expect(during.break).toMatchObject({ state: "running", plannedMinutes: 10, blockFocusMinutes: 0 });
      const after = computeDayState(d, at("16:10"));
      expect(after.status).toBe("LOCK_P1");
      expect(after.break).toMatchObject({ blockFocusMinutes: 10, bankMinutes: 0 }); // not 20'
    });

    it("G15: a break started 23:50 with planned 30 → open until 00:00", () => {
      const s = computeDayState(normalDay({ breaks: [brk("23:50", 30)] }), at("23:55"));
      expect(s.status).toBe("BREAK");
      expect(s.openUntil).toBe(MIDNIGHT);
      expect(s.break.endsAt).toBe(MIDNIGHT);
    });

    it("G16: timed run running, bank 30 → canStart false (“bấm Xong trước”)", () => {
      const s = computeDayState(normalDay({ runs: [tplRun("e1", "15:00", "16:35"), tplRun("s1", "16:36", null)] }), at("16:40"));
      expect(s.break).toMatchObject({ bankMinutes: 30, canStart: false });
    });

    it("G17: legacy break_started_at, no day_breaks → counts as 1 break of break_minutes", () => {
      const d = normalDay({ sessions: [session(TODAY, { breakStartedAt: t("15:50") })], runs: [tplRun("e1", "15:00", "15:50")], breaks: [] });
      const during = computeDayState(d, at("15:55"));
      expect(during.status).toBe("BREAK");
      expect(during.openUntil).toBe(t("16:00"));
      expect(during.break).toMatchObject({ legacy: false, takenToday: 1, plannedMinutes: 10 });
      expect(computeDayState(d, at("16:05")).break).toMatchObject({ bankMinutes: 0, takenToday: 1, state: "not_yet" });
      // A legacy break_skipped alone: one taken break that used break_minutes.
      const skipped = computeDayState(normalDay({ sessions: [session(TODAY, { breakSkipped: true })], runs: [tplRun("e1", "15:00", "16:35")] }), at("16:36"));
      expect(skipped.break).toMatchObject({ takenToday: 1, bankMinutes: 20 });
    });

    it("G18: 4' left in the bank after “Học tiếp” → canStart false (< 5); the 4' is added to free time", () => {
      const base = { runs: [tplRun("e1", "15:00", "15:50")], breaks: [brk("15:50", 10, "15:56")] };
      const s = computeDayState(normalDay(base), at("15:57"));
      expect(s.break).toMatchObject({ bankMinutes: 4, canStart: false });
      const done = computeDayState(
        normalDay({ homework: hwDone("16:10"), runs: [...base.runs, hwRun("16:00", "16:10"), tplRun("s1", "16:10", "16:30")], breaks: base.breaks }),
        at("16:30"),
      );
      expect(done.status).toBe("FREE");
      expect(done.free).toMatchObject({ bonusMinutes: 4, endsAt: t("17:19") });
    });
  });

  describe("more rules", () => {
    it("the old “a part must be done” condition is gone: 50' of focus, nothing finished → canStart", () => {
      const s = computeDayState(normalDay({ runs: [hwRun("15:00", null)] }), at("15:50"));
      expect(s.part1.complete).toBe(false);
      expect(s.part2.complete).toBe(false);
      expect(s.break.canStart).toBe(true);
    });

    it("a running break ends when free time starts: its unused minutes are added to free time", () => {
      // 95' → bank 30; break from 09:35 (planned 30); the parent's proof finishes the day at 09:45.
      const s = computeDayState(
        normalDay({ homework: hwDone("09:45"), runs: [hwRun("08:00", "09:00"), tplRun("e1", "09:00", "09:20"), tplRun("s1", "09:20", "09:35")], breaks: [brk("09:35", 30)] }),
        at("09:45"),
      );
      expect(s.status).toBe("FREE");
      expect(s.free).toMatchObject({ bonusMinutes: 20, endsAt: t("10:50") }); // 30 - 10 used, 45 + 20
    });

    it("trust mode or a sick day: no focus (the laptop is open); lock mode since today: earlier time is not focus", () => {
      const runs = [tplRun("e1", "08:00", "09:35")];
      expect(computeDayState(normalDay({ runs, trustMode: "trust" }), at("10:00")).break.bankMinutes).toBe(0);
      expect(computeDayState(normalDay({ runs, sessions: [session(TODAY, { dayType: "sick" })] }), at("10:00")).break.bankMinutes).toBe(0);
      expect(computeDayState(normalDay({ runs, trustSince: t("09:00") }), at("10:00")).break.blockFocusMinutes).toBe(35);
      expect(computeDayState(normalDay({ runs, trustSince: iso(`${YESTERDAY} 09:00`) }), at("10:00")).break.blockFocusMinutes).toBe(95);
    });

    it("break_max_per_day is data (0 = no break); out of range → 6", () => {
      const d = normalDay({ runs: [tplRun("e1", "15:00", "15:50")] });
      expect(computeDayState({ ...d, settings: { ...SETTINGS, breakMaxPerDay: 0 } }, at("15:51")).break).toMatchObject({ canStart: false, maxPerDay: 0, state: "not_yet" });
      expect(computeDayState({ ...d, settings: { ...SETTINGS, breakMaxPerDay: 99 } }, at("15:51")).break).toMatchObject({ canStart: true, maxPerDay: 6 });
    });

    it("only one running break: BREAK until started_at + planned; “Học tiếp” (ended_at) ends it", () => {
      const s = computeDayState(normalDay({ runs: [tplRun("e1", "15:00", "15:50")], breaks: [brk("15:50", 10)] }), at("15:59:59"));
      expect(s.status).toBe("BREAK");
      expect(s.break).toMatchObject({ state: "running", startedAt: t("15:50"), endsAt: t("16:00"), plannedMinutes: 10, nextTier: null, canStart: false });
      expect(computeDayState(normalDay({ runs: [tplRun("e1", "15:00", "15:50")], breaks: [brk("15:50", 10)] }), at("16:00")).status).toBe("LOCK_P1");
      expect(computeDayState(normalDay({ runs: [tplRun("e1", "15:00", "15:50")], breaks: [brk("15:50", 10, "15:52")] }), at("15:53")).status).toBe("LOCK_P1");
    });

    it("breaks of other days are ignored; malformed day_breaks rows throw (fail-closed)", () => {
      const old = { ...brk("15:50", 10), localDate: YESTERDAY, startedAt: iso(`${YESTERDAY} 15:50`) };
      expect(computeDayState(normalDay({ runs: [tplRun("e1", "15:00", "15:50")], breaks: [old] }), at("15:55")).break).toMatchObject({ takenToday: 0, bankMinutes: 10 });
      expect(() => computeDayState(normalDay({ breaks: [{ ...brk("15:50", 10), startedAt: "nope" }] }), at("16:00"))).toThrow();
      expect(() => computeDayState(normalDay({ breaks: [{ ...brk("15:50", 10), plannedMinutes: 0 }] }), at("16:00"))).toThrow();
      expect(() => computeDayState(normalDay({ breaks: [{ ...brk("15:50", 10), endedAt: "nope" }] }), at("16:00"))).toThrow();
    });

    it("midnight: a run still running at 23:59 counts only up to now; the next day starts with an empty bank", () => {
      const late = normalDay({ runs: [hwRun("23:00", null)] });
      expect(computeDayState(late, at("23:59")).break.blockFocusMinutes).toBe(59);
      expect(computeDayState(late, vn(`${TOMORROW} 00:01`)).break).toMatchObject({ bankMinutes: 0, blockFocusMinutes: 0, takenToday: 0 });
    });

    it("before 0014 (breaks: null): no bank, no bonus — the old rule (see the [legacy] tests above)", () => {
      const s = computeDayState(legacy(normalDay({ runs: [tplRun("e1", "08:00", "10:00")] })), at("10:01"));
      expect(s.break).toMatchObject({ legacy: true, bankMinutes: 0, canStart: false, maxPerDay: 1, nextTier: null });
      const free = computeDayState(legacy(normalDay({ sessions: [session(TODAY, { passUsedAt: t("10:00"), freeStartedAt: t("10:00") })], runs: [tplRun("e1", "08:00", "10:00")] })), at("10:01"));
      expect(free.free).toMatchObject({ bonusMinutes: 0, endsAt: t("10:45") });
    });
  });
});
