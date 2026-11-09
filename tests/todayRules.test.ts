import { describe, expect, it } from "vitest";
import { computeDayState, type DayInput, type DaySessionInput } from "@/lib/dayState";
import { decideBreak, decideConfirmRequest, decideFinish, decideFreeStart, decidePass, decideProof, decideStart, extraRunView, isExtraRun, isProofPath, ON_BREAK_TEXT, passOffered, runningItems, runningTimedTask } from "@/lib/today/rules";
import { bannerFor, clock, dayLabel, dayProgress, daySteps, dueTone, earlyUntil, groupLabel, leftCount, longDate, nextPart1, nextTask, shade, statusPill, taskMeta, vnTime, weekSummary } from "@/lib/today/view";

// Wednesday 2026-10-14, Vietnam time.
const TODAY = "2026-10-14";
const vn = (t: string) => new Date(`${TODAY}T${t}+07:00`);
const at = (t: string) => vn(t).toISOString();
const RULES = { breakMinutes: 10, freeMinutes: 45 };

const HW = "11111111-1111-4111-8111-111111111111";
const EXTRA = "22222222-2222-4222-8222-222222222222";
const SKILL = "33333333-3333-4333-8333-333333333333";
const RUN_HW = "44444444-4444-4444-8444-444444444444";
const RUN_EX = "55555555-5555-4555-8555-555555555555";
const RUN_SK = "66666666-6666-4666-8666-666666666666";
const FAMILY = "66666666-6666-4666-8666-666666666666";
const CHILD = "77777777-7777-4777-8777-777777777777";

function session(patch: Partial<DaySessionInput> = {}): DaySessionInput {
  return {
    localDate: TODAY,
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

function day(patch: Partial<DayInput> = {}): DayInput {
  return {
    settings: {
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
    },
    bedtime: "21:30",
    trustMode: "lock",
    sessions: [],
    homework: [{ id: HW, subject: "Toán", dueDate: "2026-10-15", note: null, doneAt: null, archivedAt: null, createdAt: at("06:00") }],
    templates: [
      { id: EXTRA, part: "extra", title: "Toán bổ sung", subject: "Toán", appSlotId: null, weekdays: [3], minMinutes: null, deepLink: null, sort: 0, active: true },
      { id: SKILL, part: "skill", title: "Đọc sách", subject: null, appSlotId: null, weekdays: [3], minMinutes: 20, deepLink: null, sort: 0, active: true },
    ],
    appSlots: [],
    runs: [],
    overrides: [],
    ...patch,
  };
}

const run = (id: string, patch: { source: "homework" | "template"; ref: string; startedAt: string; doneAt?: string; proofs?: string[] }) => ({
  id,
  localDate: TODAY,
  source: patch.source,
  homeworkItemId: patch.source === "homework" ? patch.ref : null,
  templateId: patch.source === "template" ? patch.ref : null,
  startedAt: patch.startedAt,
  doneAt: patch.doneAt ?? null,
  proofPaths: patch.proofs ?? [],
});

describe("decideStart", () => {
  it("starts a Part 1 task", () => {
    const d = decideStart(computeDayState(day(), vn("15:00")), "template", EXTRA);
    expect(d).toMatchObject({ ok: true, value: { alreadyRunning: false } });
  });

  it("E1 (R1): starts a skill before any homework (both parts are open)", () => {
    const d = decideStart(computeDayState(day(), vn("15:00")), "template", SKILL);
    expect(d).toMatchObject({ ok: true, value: { alreadyRunning: false } });
  });

  it("E8: no task action during the break; 'Học tiếp' first", () => {
    const onBreak = computeDayState(
      day({
        sessions: [session({ part1DoneAt: at("16:00"), breakStartedAt: at("16:01") })],
        runs: [run(RUN_HW, { source: "homework", ref: HW, startedAt: at("15:00") })],
      }),
      vn("16:05"),
    );
    expect(onBreak.status).toBe("BREAK");
    expect(decideStart(onBreak, "template", SKILL)).toMatchObject({ ok: false, status: 409, error: ON_BREAK_TEXT });
    expect(decideProof(onBreak, RUN_HW)).toMatchObject({ ok: false, status: 409, error: ON_BREAK_TEXT });
    expect(decideConfirmRequest(onBreak, RUN_HW)).toMatchObject({ ok: false, status: 409, error: ON_BREAK_TEXT });
    const withProof = computeDayState(
      day({
        sessions: [session({ part1DoneAt: at("16:00"), breakStartedAt: at("16:01") })],
        runs: [run(RUN_HW, { source: "homework", ref: HW, startedAt: at("15:00"), proofs: ["p.jpg"] })],
      }),
      vn("16:05"),
    );
    expect(decideFinish(withProof, RUN_HW, vn("16:05"))).toMatchObject({ ok: false, status: 409, error: ON_BREAK_TEXT });
  });

  it("refuses an unknown task, and a task of another weekday", () => {
    const s = computeDayState(day(), vn("15:00"));
    expect(decideStart(s, "template", "99999999-9999-4999-8999-999999999999")).toMatchObject({ ok: false, status: 404 });
    const thursdayOnly = day({ templates: [{ ...day().templates[0]!, weekdays: [4] }] });
    expect(decideStart(computeDayState(thursdayOnly, vn("15:00")), "template", EXTRA)).toMatchObject({ ok: false, status: 404 });
  });

  it("is idempotent for a running task; a finished template starts “Làm thêm” instead (R8a)", () => {
    const running = computeDayState(day({ runs: [run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00") })] }), vn("15:05"));
    expect(decideStart(running, "template", EXTRA)).toMatchObject({ ok: true, value: { alreadyRunning: true, extra: false } });
    const done = computeDayState(
      day({ runs: [run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00"), doneAt: at("15:25") })] }),
      vn("15:30"),
    );
    expect(decideStart(done, "template", EXTRA)).toMatchObject({ ok: true, value: { alreadyRunning: false, extra: true } });
  });
});

describe("one timed task at a time (decision 15/10/2026)", () => {
  const EXTRA2 = "99999999-9999-4999-8999-999999999990";
  const twoExtras = (runs: ReturnType<typeof run>[]) =>
    day({
      templates: [
        ...day().templates,
        { id: EXTRA2, part: "extra", title: "Anh bổ sung", subject: "Anh", appSlotId: null, weekdays: [3], minMinutes: null, deepLink: null, sort: 1, active: true },
      ],
      runs,
    });

  it("a second timed task cannot start while one is running", () => {
    const s = computeDayState(twoExtras([run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00") })]), vn("15:05"));
    expect(runningTimedTask(s)?.id).toBe(EXTRA);
    const d = decideStart(s, "template", EXTRA2);
    expect(d).toMatchObject({ ok: false, status: 409 });
    if (!d.ok) expect(d.error).toContain("Toán bổ sung");
  });

  it("homework (no minimum) can still be started meanwhile", () => {
    const s = computeDayState(twoExtras([run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00") })]), vn("15:05"));
    expect(decideStart(s, "homework", HW)).toMatchObject({ ok: true });
  });

  it("once the first is finished the next one may start", () => {
    const s = computeDayState(
      twoExtras([run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00"), doneAt: at("15:21") })]),
      vn("15:22"),
    );
    expect(runningTimedTask(s)).toBeNull();
    expect(decideStart(s, "template", EXTRA2)).toMatchObject({ ok: true });
  });
});

describe("R8a “Làm thêm” (parent decision 08/11/2026)", () => {
  const RUN_X = "88888888-8888-4888-8888-888888888881";
  const RUN_X2 = "88888888-8888-4888-8888-888888888882";
  const exDone = run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00"), doneAt: at("15:25") });
  const extraRun = run(RUN_X, { source: "template", ref: EXTRA, startedAt: at("15:40") });

  it("a second start while the extra run is running returns it (idempotent)", () => {
    const s = computeDayState(day({ runs: [exDone, extraRun] }), vn("15:41"));
    expect(decideStart(s, "template", EXTRA)).toMatchObject({ ok: true, value: { alreadyRunning: true, extra: true } });
  });

  it("start is refused for homework that is done (no Làm thêm for homework)", () => {
    const s = computeDayState(
      day({
        homework: [{ ...day().homework[0]!, doneAt: at("15:10") }],
        runs: [run(RUN_HW, { source: "homework", ref: HW, startedAt: at("15:00"), doneAt: at("15:10"), proofs: ["p.jpg"] })],
      }),
      vn("15:20"),
    );
    const d = decideStart(s, "homework", HW);
    expect(d).toMatchObject({ ok: false, status: 409 });
    if (!d.ok) expect(d.error).toBe("Việc này đã xong rồi.");
    expect(s.part1.items.find((i) => i.id === HW)?.extra).toBeNull();
  });

  it("finishing an extra run has no minimum (Xong right after the start), and the task stays done", () => {
    const now = vn("15:40:05");
    const s = computeDayState(day({ runs: [exDone, extraRun] }), now);
    const d = decideFinish(s, RUN_X, now);
    expect(d).toMatchObject({ ok: true, value: { item: { runId: RUN_X, source: "template", id: EXTRA, state: "running" } } });
    // The required run is still the done one: finishing it again is refused.
    expect(decideFinish(s, RUN_EX, now)).toMatchObject({ ok: false, status: 409 });
    expect(s.part1.items.find((i) => i.id === EXTRA)).toMatchObject({ state: "done", runId: RUN_EX, doneAt: at("15:25") });
  });

  it("an extra run counts as timed: other timed tasks wait, and it waits for them", () => {
    const s = computeDayState(day({ runs: [exDone, extraRun] }), vn("15:45"));
    const timed = runningTimedTask(s);
    expect(timed).toMatchObject({ id: EXTRA, runId: RUN_X, state: "running" });
    expect(timed && isExtraRun(timed)).toBe(true);
    const d = decideStart(s, "template", SKILL);
    expect(d).toMatchObject({ ok: false, status: 409 });
    if (!d.ok) expect(d.error).toContain("Toán bổ sung");
    // Homework (no minimum) can still start meanwhile, as before.
    expect(decideStart(s, "homework", HW)).toMatchObject({ ok: true });

    const skillRunning = computeDayState(day({ runs: [exDone, run(RUN_SK, { source: "template", ref: SKILL, startedAt: at("15:30") })] }), vn("15:45"));
    const e = decideStart(skillRunning, "template", EXTRA);
    expect(e).toMatchObject({ ok: false, status: 409 });
    if (!e.ok) expect(e.error).toContain("Đọc sách");
  });

  it("an extra run of a no-minimum task still counts as timed (one at a time)", () => {
    const noMin = day({ templates: day().templates.map((t) => (t.id === EXTRA ? { ...t, minMinutes: 0 } : t)), runs: [exDone, extraRun] });
    const s = computeDayState(noMin, vn("15:45"));
    expect(runningTimedTask(s)?.runId).toBe(RUN_X);
    expect(decideStart(s, "template", SKILL)).toMatchObject({ ok: false, status: 409 });
  });

  it("no extra run during the break; no break while an extra run runs", () => {
    const onBreak = day({ sessions: [session({ part1DoneAt: at("15:30"), breakStartedAt: at("15:35") })], runs: [exDone] });
    expect(decideStart(computeDayState(onBreak, vn("15:40")), "template", EXTRA)).toMatchObject({ ok: false, status: 409, error: ON_BREAK_TEXT });

    const p1 = day({ homework: [], sessions: [session({ part1DoneAt: at("15:30") })], runs: [exDone, extraRun] });
    const s = computeDayState(p1, vn("15:45"));
    expect(s.break.canStart).toBe(false);
    const d = decideBreak(s, "start");
    expect(d).toMatchObject({ ok: false, status: 409 });
    if (!d.ok) expect(d.error).toContain("Xong việc đang làm");
  });

  it("runningItems lists the extra run as a running view; extraRunView is null without one", () => {
    const s = computeDayState(day({ runs: [exDone, extraRun, run(RUN_HW, { source: "homework", ref: HW, startedAt: at("15:41") })] }), vn("15:45"));
    expect(runningItems(s).map((i) => [i.id, i.runId])).toEqual([
      [HW, RUN_HW],
      [EXTRA, RUN_X],
    ]);
    const view = runningItems(s)[1]!;
    expect(view).toMatchObject({ minMinutes: 0, canFinishAt: at("15:40"), startedAt: at("15:40"), doneAt: null, extra: { runId: RUN_X } });
    const plain = computeDayState(day({ runs: [exDone] }), vn("15:45"));
    expect(plain.part1.items.map(extraRunView).every((v) => v === null)).toBe(true);
    expect(runningItems(plain)).toEqual([]);
  });

  it("after the extra run is finished, another one can start (sessions grow)", () => {
    const finished = run(RUN_X, { source: "template", ref: EXTRA, startedAt: at("15:40"), doneAt: at("15:50") });
    const s = computeDayState(day({ runs: [exDone, finished] }), vn("16:00"));
    expect(decideStart(s, "template", EXTRA)).toMatchObject({ ok: true, value: { alreadyRunning: false, extra: true } });
    const again = computeDayState(day({ runs: [exDone, finished, run(RUN_X2, { source: "template", ref: EXTRA, startedAt: at("16:00") })] }), vn("16:05"));
    expect(again.part1.items.find((i) => i.id === EXTRA)).toMatchObject({ state: "done", sessions: 3, todayMinutes: 40, extra: { runId: RUN_X2 } });
  });
});

describe("decideFinish (server clock decides)", () => {
  const started = day({ runs: [run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00:00") })] });

  it("refuses one second before the minimum (20 min) and allows exactly at it", () => {
    expect(decideFinish(computeDayState(started, vn("15:19:59")), RUN_EX, vn("15:19:59"))).toMatchObject({ ok: false, status: 409 });
    expect(decideFinish(computeDayState(started, vn("15:20:00")), RUN_EX, vn("15:20:00"))).toMatchObject({ ok: true });
  });

  it("homework: needs a proof photo, but no minimum time", () => {
    const noProof = day({ runs: [run(RUN_HW, { source: "homework", ref: HW, startedAt: at("15:00") })] });
    expect(decideFinish(computeDayState(noProof, vn("15:01")), RUN_HW, vn("15:01"))).toMatchObject({ ok: false, status: 409 });
    const withProof = day({ runs: [run(RUN_HW, { source: "homework", ref: HW, startedAt: at("15:00"), proofs: ["p.jpg"] })] });
    expect(decideFinish(computeDayState(withProof, vn("15:01")), RUN_HW, vn("15:01"))).toMatchObject({ ok: true });
  });

  it("refuses an unknown run", () => {
    expect(decideFinish(computeDayState(started, vn("16:00")), RUN_HW, vn("16:00"))).toMatchObject({ ok: false, status: 404 });
  });
});

describe("decideProof", () => {
  it("only for a running homework run", () => {
    const s = computeDayState(
      day({
        runs: [
          run(RUN_HW, { source: "homework", ref: HW, startedAt: at("15:00") }),
          run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00") }),
        ],
      }),
      vn("15:05"),
    );
    expect(decideProof(s, RUN_HW)).toMatchObject({ ok: true });
    expect(decideProof(s, RUN_EX)).toMatchObject({ ok: false, status: 409 });
  });

  it("proof paths must be in the child's own folder for today", () => {
    const file = "88888888-8888-4888-8888-888888888888.jpg";
    expect(isProofPath(`${FAMILY}/${CHILD}/${TODAY}/${file}`, FAMILY, CHILD, TODAY)).toBe(true);
    expect(isProofPath(`${FAMILY}/${CHILD}/2026-10-13/${file}`, FAMILY, CHILD, TODAY)).toBe(false);
    expect(isProofPath(`${FAMILY}/${HW}/${TODAY}/${file}`, FAMILY, CHILD, TODAY)).toBe(false);
    expect(isProofPath(`${FAMILY}/${CHILD}/${TODAY}/../${file}`, FAMILY, CHILD, TODAY)).toBe(false);
  });
});

describe("decideBreak (R1, parent decision 07/11/2026)", () => {
  const p1Done = day({ sessions: [session({ part1DoneAt: at("16:00") })] });

  it("E5: refused while no part is done; E5c: allowed once Part 1 is done", () => {
    const none = decideBreak(computeDayState(day(), vn("15:00")), "start");
    expect(none).toMatchObject({ ok: false, status: 409 });
    if (!none.ok) expect(none.error).toBe("Xong bài tập hoặc xong kỹ năng là được nghỉ.");
    expect(decideBreak(computeDayState(p1Done, vn("16:05")), "start")).toMatchObject({ ok: true });
  });

  it("E5b: allowed once the skills are done, homework still open", () => {
    const skillDone = day({
      sessions: [session({ part2DoneAt: at("15:40") })],
      runs: [run(RUN_SK, { source: "template", ref: SKILL, startedAt: at("15:15"), doneAt: at("15:38") })],
    });
    expect(decideBreak(computeDayState(skillDone, vn("15:41")), "start")).toMatchObject({ ok: true });
  });

  it("E6: only once a day (a legacy skip counts as used)", () => {
    const used = day({ sessions: [session({ part1DoneAt: at("16:00"), breakStartedAt: at("16:01"), breakEndedAt: at("16:05") })] });
    expect(decideBreak(computeDayState(used, vn("17:00")), "start")).toMatchObject({ ok: false, status: 409, error: "Hôm nay con đã nghỉ rồi." });
    const skipped = day({ sessions: [session({ part1DoneAt: at("16:00"), breakSkipped: true })] });
    expect(decideBreak(computeDayState(skipped, vn("17:00")), "start")).toMatchObject({ ok: false, status: 409 });
  });

  it("E7: refused while a timed task is running", () => {
    const running = day({
      sessions: [session({ part1DoneAt: at("16:00") })],
      runs: [run(RUN_SK, { source: "template", ref: SKILL, startedAt: at("16:02") })],
    });
    const d = decideBreak(computeDayState(running, vn("16:05")), "start");
    expect(d).toMatchObject({ ok: false, status: 409 });
    if (!d.ok) expect(d.error).toContain("Xong việc đang làm");
  });

  it("E12: refused during a parent lock", () => {
    const locked = day({
      sessions: [session({ part1DoneAt: at("16:00") })],
      overrides: [{ id: "o", localDate: TODAY, kind: "lock_until", until: at("18:00"), createdAt: at("16:01") }],
    });
    expect(decideBreak(computeDayState(locked, vn("16:05")), "start")).toMatchObject({ ok: false, error: "Bố mẹ đang khóa máy." });
  });

  it("a break still running under a parent lock keeps tasks paused (no timer resumes inside the break)", () => {
    const s = computeDayState(
      day({
        sessions: [session({ part1DoneAt: at("16:00"), breakStartedAt: at("16:01") })],
        overrides: [{ id: "o", localDate: TODAY, kind: "lock_until", until: at("16:20"), createdAt: at("16:02") }],
      }),
      vn("16:05"),
    );
    expect(s.status).toBe("LOCK_OVERRIDE");
    expect(decideStart(s, "template", SKILL)).toMatchObject({ ok: false, error: ON_BREAK_TEXT });
    expect(decideBreak(s, "end")).toMatchObject({ ok: true });
  });

  it("end only while running", () => {
    const running = day({ sessions: [session({ part1DoneAt: at("16:00"), breakStartedAt: at("16:01") })] });
    expect(decideBreak(computeDayState(running, vn("16:05")), "end")).toMatchObject({ ok: true });
    expect(decideBreak(computeDayState(running, vn("16:11")), "end")).toMatchObject({ ok: false });
  });
});

describe("decideFreeStart (empty day, parent decision 07/11/2026)", () => {
  const empty = day({ homework: [], templates: [] });

  it("allowed only on a day with no task at all, once", () => {
    expect(decideFreeStart(computeDayState(empty, vn("09:00")))).toMatchObject({ ok: true });
    expect(decideFreeStart(computeDayState(day(), vn("09:00")))).toMatchObject({ ok: false, status: 409 });
    const started = day({ homework: [], templates: [], sessions: [session({ part1DoneAt: at("09:00"), part2DoneAt: at("09:00"), freeStartedAt: at("09:00") })] });
    expect(decideFreeStart(computeDayState(started, vn("09:10")))).toMatchObject({ ok: false });
  });

  it("refused during a parent lock", () => {
    const locked = day({
      homework: [],
      templates: [],
      overrides: [{ id: "o", localDate: TODAY, kind: "lock_until", until: at("18:00"), createdAt: at("08:00") }],
    });
    expect(decideFreeStart(computeDayState(locked, vn("09:00")))).toMatchObject({ ok: false, error: "Bố mẹ đang khóa máy." });
  });
});

describe("decidePass", () => {
  it("not offered on an empty day (the free-time button is there)", () => {
    const empty = computeDayState(day({ homework: [], templates: [] }), vn("09:00"));
    expect(passOffered(empty)).toBe(false);
    expect(decidePass(empty)).toMatchObject({ ok: false, status: 409 });
  });

  it("available once per week, not when free time already started", () => {
    expect(decidePass(computeDayState(day(), vn("15:00")))).toMatchObject({ ok: true });
    const usedMonday = day({ sessions: [session({ localDate: "2026-10-12", passUsedAt: "2026-10-12T10:00:00Z", freeStartedAt: "2026-10-12T10:00:00Z" })] });
    expect(decidePass(computeDayState(usedMonday, vn("15:00")))).toMatchObject({ ok: false, status: 409 });
  });

  it("refused and not offered while a parent lock is in effect (decision 15/10/2026)", () => {
    const locked = day({ overrides: [{ id: "o", localDate: TODAY, kind: "lock_until", until: at("18:00"), createdAt: at("14:00") }] });
    const s = computeDayState(locked, vn("15:00"));
    expect(decidePass(s)).toMatchObject({ ok: false, status: 409 });
    expect(passOffered(s)).toBe(false);
    expect(passOffered(computeDayState(day(), vn("15:00")))).toBe(true);
  });
});

describe("screen wording", () => {
  it("banners follow the status", () => {
    expect(bannerFor(computeDayState(day(), vn("15:00")), RULES).title).toBe("Còn 2 bài tập · 1 kỹ năng");
    const p1 = computeDayState(day({ sessions: [session({ part1DoneAt: at("16:00") })] }), vn("16:05"));
    expect(bannerFor(p1, RULES)).toMatchObject({ title: "Xong bài tập — còn 1 kỹ năng", tone: "lock" });
    expect(bannerFor(p1, RULES).sub).toContain("nghỉ 10 phút");
    const free = computeDayState(day({ sessions: [session({ part1DoneAt: at("16:00"), passUsedAt: at("16:10"), freeStartedAt: at("16:10") })] }), vn("16:20"));
    expect(bannerFor(free, RULES).tone).toBe("open");
    expect(daySteps(free).map((st) => st.done)).toEqual([true, false, true]);
    const empty = computeDayState(day({ homework: [], templates: [] }), vn("09:00"));
    expect(bannerFor(empty, RULES).title).toBe("Hôm nay không có việc nào");
  });

  it("empty-day banner asks to pick upcoming work, then falls back to the normal count", () => {
    const upcoming = { id: HW, subject: "Toán", dueDate: "2026-10-20", note: null, doneAt: null, archivedAt: null, createdAt: at("06:00") };
    const pick = computeDayState(day({ homework: [upcoming] }), vn("15:00"));
    expect(bannerFor(pick, RULES)).toMatchObject({ title: "Hôm nay không có bài đến hạn" });
    expect(bannerFor(pick, RULES).sub).toContain("Tự chọn 1 bài");
    const picked = computeDayState(day({ homework: [{ ...upcoming, doneAt: at("14:00") }] }), vn("15:00"));
    expect(bannerFor(picked, RULES).title).toBe("Còn 1 bài tập · 1 kỹ năng");
  });

  it("dates, clocks and task lines", () => {
    expect(longDate(TODAY)).toBe("Thứ Tư, 14/10/2026");
    expect(dayLabel("2026-10-12", TODAY)).toBe("T2");
    expect(dayLabel(TODAY, TODAY)).toBe("Nay");
    expect(vnTime(at("21:05"))).toBe("21:05");
    expect(clock(65_000)).toBe("01:05");
    expect(clock(3_725_000)).toBe("1:02:05");
    expect(clock(-5)).toBe("00:00");

    const s = computeDayState(day({ runs: [run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00:00") })] }), vn("15:04:12"));
    const extra = s.part1.items.find((i) => i.id === EXTRA)!;
    expect(taskMeta(extra, vn("15:04:12").getTime())).toBe("Đang làm · 4 phút / 20 phút"); // R7a: minutes only
    expect(taskMeta(extra, vn("15:20:00").getTime())).toBe("Đủ 20 phút — bấm Xong khi làm xong");
    expect(weekSummary(s.week)).toBe("0/6 ngày đạt");
  });
});

describe("S2d screen helpers", () => {
  it("next task: due homework, then extras, then skills; a running task wins", () => {
    const s0 = computeDayState(day(), vn("15:00"));
    expect(nextTask(s0)?.id).toBe(HW);
    const hwDone = computeDayState(day({ homework: [{ id: HW, subject: "Toán", dueDate: "2026-10-15", note: null, doneAt: at("14:00"), archivedAt: null, createdAt: at("06:00") }] }), vn("15:00"));
    expect(nextTask(hwDone)?.id).toBe(EXTRA);
    const running = computeDayState(day({ runs: [run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("14:50") })] }), vn("15:00"));
    expect(nextTask(running)?.id).toBe(EXTRA);
    const p2 = computeDayState(day({ sessions: [session({ part1DoneAt: at("16:00") })] }), vn("16:05"));
    expect(nextTask(p2)?.id).toBe(SKILL); // no break step in between (R1)
  });

  it("next task on an empty day is an upcoming item to pick", () => {
    const s = computeDayState(day({ homework: [{ id: HW, subject: "Toán", dueDate: "2026-10-20", note: null, doneAt: null, archivedAt: null, createdAt: at("06:00") }], templates: [] }), vn("15:00"));
    expect(nextTask(s)?.id).toBe(HW);
  });

  it("progress, tones, ★ deadline, pill wording, shade", () => {
    const s = computeDayState(day(), vn("15:00"));
    expect(dayProgress(s)).toEqual({ done: 0, total: 3 });
    expect(dueTone("2026-10-13", TODAY)).toBe("urgent");
    expect(dueTone(TODAY, TODAY)).toBe("urgent");
    expect(dueTone("2026-10-15", TODAY)).toBe("soon");
    expect(dueTone("2026-10-16", TODAY)).toBe("later");
    expect(earlyUntil("2026-10-16", TODAY)).toBe(TODAY);
    expect(earlyUntil("2026-10-15", TODAY)).toBeNull();
    expect(statusPill(s, vn("15:00").getTime())).toEqual({ label: "Giờ học · máy chỉ mở trang học", open: false });
    const free = computeDayState(day({ sessions: [session({ part1DoneAt: at("16:00"), passUsedAt: at("16:10"), freeStartedAt: at("16:10") })] }), vn("16:20"));
    expect(statusPill(free, vn("16:20").getTime())).toEqual({ label: "Giờ tự do · còn 35:00", open: true });
    expect(shade("#2F5D9E")).toMatch(/^#[0-9a-f]{6}$/);
    expect(shade("bad")).toBe("#16243a");
  });
});


describe("leftCount (R6d Vui chơi: còn N việc)", () => {
  it("counts not-done tasks of both parts; upcoming picks are not counted", () => {
    const UP = "88888888-8888-4888-8888-888888888888";
    const d = day({
      homework: [
        { id: HW, subject: "Toán", dueDate: "2026-10-15", note: null, doneAt: null, archivedAt: null, createdAt: at("06:00") },
        { id: UP, subject: "Văn", dueDate: "2026-10-20", note: null, doneAt: null, archivedAt: null, createdAt: at("06:00") },
      ],
    });
    const s = computeDayState(d, vn("15:00"));
    expect(s.part1.items.some((i) => i.group === "upcoming")).toBe(true);
    expect(leftCount(s)).toBe(3);
    const running = computeDayState({ ...d, runs: [run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00") })] }, vn("15:05"));
    expect(leftCount(running)).toBe(3);
    const done = computeDayState({ ...d, runs: [run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00"), doneAt: at("15:25") })] }, vn("15:30"));
    expect(leftCount(done)).toBe(2);
  });

  it("a day with no due homework still counts the upcoming quota left (never 0 while closed)", () => {
    const UP = "88888888-8888-4888-8888-888888888888";
    const d = day({ homework: [{ id: UP, subject: "Văn", dueDate: "2026-10-20", note: null, doneAt: null, archivedAt: null, createdAt: at("06:00") }] });
    const s = computeDayState(d, vn("15:00"));
    expect(s.part1.pick.needed).toBe(1);
    expect(leftCount(s)).toBe(3);
    expect(leftCount(s)).toBe(s.part1.total - s.part1.done + s.part2.total - s.part2.done);
  });
});

describe("nextPart1 (R6d Học tập card: never a skill)", () => {
  it("a running skill + only upcoming homework: suggests the upcoming one, not 'all done'", () => {
    const d = day({ homework: [{ id: HW, subject: "Toán", dueDate: "2026-10-20", note: null, doneAt: null, archivedAt: null, createdAt: at("06:00") }], templates: day().templates.filter((t) => t.part === "skill") });
    const s = computeDayState({ ...d, runs: [run(RUN_SK, { source: "template", ref: SKILL, startedAt: at("15:00") })] }, vn("15:05"));
    expect(s.part2.items.some((i) => i.state === "running")).toBe(true);
    expect(s.part1.complete).toBe(false);
    const n = nextPart1(s, null);
    expect(n?.id).toBe(HW);
    expect(groupLabel(n!)).toBe("Làm trước");
  });
  it("follows the child's own order, skipping skills", () => {
    const s = computeDayState(day(), vn("15:00"));
    const extra = s.part1.items.find((i) => i.id === EXTRA)!;
    const skill = s.part2.items.find((i) => i.id === SKILL)!;
    expect(nextPart1(s, [skill.key, extra.key])?.id).toBe(EXTRA);
    expect(nextPart1(s, null)?.id).toBe(HW);
  });
  it("Phần 1 complete: nothing to suggest", () => {
    const s = computeDayState(day({ sessions: [session({ part1DoneAt: at("16:00") })] }), vn("16:05"));
    expect(s.part1.complete).toBe(true);
    expect(nextPart1(s, null)).toBeNull();
  });
});
