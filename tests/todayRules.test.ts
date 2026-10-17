import { describe, expect, it } from "vitest";
import { computeDayState, type DayInput, type DaySessionInput } from "@/lib/dayState";
import { decideBreak, decideFinish, decidePass, decideProof, decideStart, isProofPath, passOffered, runningTimedTask } from "@/lib/today/rules";
import { bannerFor, clock, dayLabel, dayProgress, dueTone, earlyUntil, longDate, nextTask, shade, statusPill, stepIndex, taskMeta, vnTime, weekSummary } from "@/lib/today/view";

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

  it("refuses a Part 2 task while Part 2 is locked", () => {
    const d = decideStart(computeDayState(day(), vn("15:00")), "template", SKILL);
    expect(d).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses an unknown task, and a task of another weekday", () => {
    const s = computeDayState(day(), vn("15:00"));
    expect(decideStart(s, "template", "99999999-9999-4999-8999-999999999999")).toMatchObject({ ok: false, status: 404 });
    const thursdayOnly = day({ templates: [{ ...day().templates[0]!, weekdays: [4] }] });
    expect(decideStart(computeDayState(thursdayOnly, vn("15:00")), "template", EXTRA)).toMatchObject({ ok: false, status: 404 });
  });

  it("is idempotent for a running task and refuses a finished one", () => {
    const running = computeDayState(day({ runs: [run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00") })] }), vn("15:05"));
    expect(decideStart(running, "template", EXTRA)).toMatchObject({ ok: true, value: { alreadyRunning: true } });
    const done = computeDayState(
      day({ runs: [run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("15:00"), doneAt: at("15:25") })] }),
      vn("15:30"),
    );
    expect(decideStart(done, "template", EXTRA)).toMatchObject({ ok: false, status: 409 });
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

describe("decideBreak", () => {
  const p1Done = day({ sessions: [session({ part1DoneAt: at("16:00") })] });

  it("start / skip only on offer; not before Part 1 is done", () => {
    expect(decideBreak(computeDayState(day(), vn("15:00")), "start")).toMatchObject({ ok: false });
    expect(decideBreak(computeDayState(p1Done, vn("16:05")), "start")).toMatchObject({ ok: true });
    expect(decideBreak(computeDayState(p1Done, vn("16:05")), "skip")).toMatchObject({ ok: true });
  });

  it("only once a day", () => {
    const used = day({ sessions: [session({ part1DoneAt: at("16:00"), breakStartedAt: at("16:01"), breakEndedAt: at("16:05") })] });
    expect(decideBreak(computeDayState(used, vn("17:00")), "start")).toMatchObject({ ok: false, status: 409 });
  });

  it("end only while running", () => {
    const running = day({ sessions: [session({ part1DoneAt: at("16:00"), breakStartedAt: at("16:01") })] });
    expect(decideBreak(computeDayState(running, vn("16:05")), "end")).toMatchObject({ ok: true });
    expect(decideBreak(computeDayState(running, vn("16:11")), "end")).toMatchObject({ ok: false });
  });
});

describe("decidePass", () => {
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
    expect(bannerFor(computeDayState(day(), vn("15:00")), RULES).title).toBe("Còn 2 việc ở Phần 1");
    const offer = computeDayState(day({ sessions: [session({ part1DoneAt: at("16:00") })] }), vn("16:05"));
    expect(bannerFor(offer, RULES)).toMatchObject({ title: "Xong Phần 1 — giỏi lắm!", tone: "dark" });
    const free = computeDayState(day({ sessions: [session({ part1DoneAt: at("16:00"), passUsedAt: at("16:10"), freeStartedAt: at("16:10") })] }), vn("16:20"));
    expect(bannerFor(free, RULES).tone).toBe("open");
    expect(stepIndex(free, vn("16:20").getTime())).toBe(3);
    expect(stepIndex(free, vn("17:00").getTime())).toBe(4);
  });

  it("empty-day banner asks to pick upcoming work, then falls back to the normal count", () => {
    const upcoming = { id: HW, subject: "Toán", dueDate: "2026-10-20", note: null, doneAt: null, archivedAt: null, createdAt: at("06:00") };
    const pick = computeDayState(day({ homework: [upcoming] }), vn("15:00"));
    expect(bannerFor(pick, RULES)).toMatchObject({ title: "Hôm nay không có bài đến hạn" });
    expect(bannerFor(pick, RULES).sub).toContain("Tự chọn 1 bài");
    const picked = computeDayState(day({ homework: [{ ...upcoming, doneAt: at("14:00") }] }), vn("15:00"));
    expect(bannerFor(picked, RULES).title).toBe("Còn 1 việc ở Phần 1");
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
    expect(taskMeta(extra, vn("15:04:12").getTime())).toBe("Đang làm · 04:12 / 20:00");
    expect(taskMeta(extra, vn("15:20:00").getTime())).toBe("Đủ 20 phút — bấm Xong khi làm xong");
    expect(weekSummary(s.week)).toBe("0/6 ngày đạt");
  });
});

describe("S2d screen helpers", () => {
  it("next task: due homework, then extras, then Part 2 once unlocked; a running task wins", () => {
    const s0 = computeDayState(day(), vn("15:00"));
    expect(nextTask(s0)?.id).toBe(HW);
    const hwDone = computeDayState(day({ homework: [{ id: HW, subject: "Toán", dueDate: "2026-10-15", note: null, doneAt: at("14:00"), archivedAt: null, createdAt: at("06:00") }] }), vn("15:00"));
    expect(nextTask(hwDone)?.id).toBe(EXTRA);
    const running = computeDayState(day({ runs: [run(RUN_EX, { source: "template", ref: EXTRA, startedAt: at("14:50") })] }), vn("15:00"));
    expect(nextTask(running)?.id).toBe(EXTRA);
    const offer = computeDayState(day({ sessions: [session({ part1DoneAt: at("16:00") })] }), vn("16:05"));
    expect(nextTask(offer)).toBeNull(); // Part 2 still locked during the break offer
    const p2 = computeDayState(day({ sessions: [session({ part1DoneAt: at("16:00"), breakSkipped: true })] }), vn("16:05"));
    expect(nextTask(p2)?.id).toBe(SKILL);
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

