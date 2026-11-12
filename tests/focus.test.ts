import { describe, expect, it } from "vitest";
import type { TaskView } from "@/lib/dayState";
import { FOCUS_LINES, chipTime, focusLine, isLongRunning, minutesLabel, pickHash, remainingMinutes, shortTitle, studyTimerLabel, todayLine } from "@/lib/today/focus";
import { extraRunView } from "@/lib/today/rules";
import { taskMeta } from "@/lib/today/view";

const MIN = 60_000;

const base: TaskView = {
  key: "template:t1",
  id: "t1",
  source: "template",
  part: 1,
  title: "Luyện đề",
  subject: null,
  note: null,
  dueDate: null,
  overdue: false,
  minMinutes: 20,
  runId: null,
  startedAt: null,
  canFinishAt: null,
  doneAt: null,
  requiresProof: false,
  proofCount: 0,
  placeholder: false,
  deepLink: null,
  appLabel: null,
  addedAfterPart1Done: false,
  group: null,
  early: false,
  state: "todo",
  todayMinutes: 0,
  sessions: 0,
  extra: null,
};
const now = Date.parse("2026-11-08T10:00:00Z");

describe("minutesLabel (R7a: minutes only, never seconds)", () => {
  it("under a minute is 'vừa bắt đầu'", () => {
    expect(minutesLabel(0)).toBe("vừa bắt đầu");
    expect(minutesLabel(59_999)).toBe("vừa bắt đầu");
    expect(minutesLabel(-5 * MIN)).toBe("vừa bắt đầu");
  });
  it("minutes up to an hour", () => {
    expect(minutesLabel(MIN)).toBe("1 phút");
    expect(minutesLabel(59 * MIN)).toBe("59 phút");
    expect(minutesLabel(59 * MIN + 59_999)).toBe("59 phút");
  });
  it("hours and two-digit minutes", () => {
    expect(minutesLabel(60 * MIN)).toBe("1 giờ 00 phút");
    expect(minutesLabel(125 * MIN)).toBe("2 giờ 05 phút");
    expect(minutesLabel(152 * MIN + 22_000)).toBe("2 giờ 32 phút");
  });
  it("never shows a clock with seconds", () => {
    for (const ms of [0, 30_000, 61_000, 3_599_000, 9_142_000]) expect(minutesLabel(ms)).not.toMatch(/\d:\d\d/);
  });
});

describe("remainingMinutes", () => {
  it("rounds up and never goes below 0", () => {
    expect(remainingMinutes(0)).toBe(0);
    expect(remainingMinutes(-10_000)).toBe(0);
    expect(remainingMinutes(1)).toBe(1);
    expect(remainingMinutes(MIN)).toBe(1);
    expect(remainingMinutes(MIN + 1)).toBe(2);
    expect(remainingMinutes(19 * MIN + 30_000)).toBe(20);
  });
});

describe("isLongRunning", () => {
  it("at least 2 hours for short tasks", () => {
    expect(isLongRunning(119 * MIN + 59_999, 20)).toBe(false);
    expect(isLongRunning(120 * MIN, 20)).toBe(true);
    expect(isLongRunning(120 * MIN, 0)).toBe(true);
  });
  it("3 × the minimum for long tasks", () => {
    expect(isLongRunning(120 * MIN, 50)).toBe(false);
    expect(isLongRunning(149 * MIN, 50)).toBe(false);
    expect(isLongRunning(150 * MIN, 50)).toBe(true);
  });
  it("negative or zero elapsed is never long", () => {
    expect(isLongRunning(-1, 20)).toBe(false);
    expect(isLongRunning(0, 0)).toBe(false);
  });
});

describe("pickHash and focusLine", () => {
  it("pickHash is a stable unsigned 32-bit hash", () => {
    expect(pickHash("abc")).toBe(pickHash("abc"));
    expect(pickHash("abc")).not.toBe(pickHash("abd"));
    for (const s of ["", "a", "homework:1|2026-11-08", "x".repeat(500)]) {
      const h = pickHash(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
  it("has at least 12 calm lines per voice, no '!!', no duplicates", () => {
    for (const voice of ["scientist", "detective"] as const) {
      const lines = FOCUS_LINES[voice];
      expect(lines.length).toBeGreaterThanOrEqual(12);
      expect(new Set(lines).size).toBe(lines.length);
      for (const l of lines) {
        expect(l).not.toContain("!!");
        expect(l.trim()).toBe(l);
        expect(l.length).toBeGreaterThan(10);
        expect(l).not.toMatch(/điểm|xếp hạng|giỏi hơn|nhanh lên/i);
      }
    }
  });
  it("focusLine is deterministic and comes from the voice's list", () => {
    const a = focusLine("scientist", "template:t1|2026-11-08");
    expect(focusLine("scientist", "template:t1|2026-11-08")).toBe(a);
    expect(FOCUS_LINES.scientist).toContain(a);
    expect(FOCUS_LINES.detective).toContain(focusLine("detective", "homework:h|2026-11-09"));
    // Different seeds reach more than one line.
    const seen = new Set(Array.from({ length: 40 }, (_, i) => focusLine("detective", `k${i}`)));
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe("studyTimerLabel (Góc học tập big timer, minutes only)", () => {
  it("a timed task not started shows its minimum", () => {
    expect(studyTimerLabel(base, now)).toBe("20 phút");
  });
  it("a running timed task shows the minutes left, then the time worked once it is enough", () => {
    const run = { ...base, state: "running" as const, startedAt: "2026-11-08T09:55:00Z", canFinishAt: "2026-11-08T10:15:00Z" };
    expect(studyTimerLabel(run, now)).toBe("còn 15 phút");
    expect(studyTimerLabel(run, now + 14 * MIN + 30_000)).toBe("còn 1 phút");
    expect(studyTimerLabel(run, Date.parse("2026-11-08T10:30:00Z"))).toBe("đã làm 35 phút");
  });
  it("homework and untimed tasks show the time worked while running, '—' before", () => {
    const hw = { ...base, source: "homework" as const, minMinutes: 0, requiresProof: true, group: "due" as const };
    expect(studyTimerLabel(hw, now)).toBe("—");
    expect(studyTimerLabel({ ...hw, state: "running", startedAt: "2026-11-08T09:48:00Z" }, now)).toBe("đã làm 12 phút");
    expect(studyTimerLabel({ ...hw, state: "running", startedAt: "2026-11-08T09:59:30Z" }, now)).toBe("vừa bắt đầu");
    expect(studyTimerLabel({ ...hw, state: "running", startedAt: "2026-11-08T07:28:00Z" }, now)).toBe("đã làm 2 giờ 32 phút");
  });
});

describe("running chip helpers", () => {
  it("chipTime says 'hơn 2 giờ' once the run is long", () => {
    expect(chipTime(5 * MIN, 20)).toBe("5 phút");
    expect(chipTime(30_000, 20)).toBe("vừa bắt đầu");
    expect(chipTime(152 * MIN, 20)).toBe("hơn 2 giờ");
  });
  it("shortTitle keeps short titles and trims long ones on a word", () => {
    expect(shortTitle("Ngữ văn")).toBe("Ngữ văn");
    const t = shortTitle("Luyện đề Toán chương 4 hình học phẳng nâng cao");
    expect(t.length).toBeLessThanOrEqual(23);
    expect(t.endsWith("…")).toBe(true);
    expect(shortTitle("Mộtchữrấtdàikhôngcókhoảngtrắngnàocả")).toHaveLength(23);
  });
});

describe("sceneKeyOf (focus background of An's world)", () => {
  it("known worlds map to themselves; anything else falls back to the forest", async () => {
    const { sceneKeyOf } = await import("@/app/today/world-scene");
    expect(sceneKeyOf("rung")).toBe("rung");
    expect(sceneKeyOf("bien")).toBe("bien");
    expect(sceneKeyOf("vu_tru")).toBe("vu_tru");
    expect(sceneKeyOf("nui_lua")).toBe("nui_lua");
    expect(sceneKeyOf("sa_mac")).toBe("rung");
    expect(sceneKeyOf(null)).toBe("rung");
    expect(sceneKeyOf(undefined)).toBe("rung");
  });
});

describe("R8a Làm thêm wording (minutes only, no counters)", () => {
  it("todayLine: “Hôm nay: 1 giờ 30 phút · 2 lần”", () => {
    expect(todayLine({ todayMinutes: 90, sessions: 2 })).toBe("Hôm nay: 1 giờ 30 phút · 2 lần");
    expect(todayLine({ todayMinutes: 25, sessions: 1 })).toBe("Hôm nay: 25 phút · 1 lần");
    expect(todayLine({ todayMinutes: 0, sessions: 1 })).toBe("Hôm nay: dưới 1 phút · 1 lần");
  });

  it("the running extra view: no minimum, Xong at once, calm line", () => {
    const done: TaskView = {
      ...base,
      state: "done",
      runId: "r1",
      startedAt: "2026-11-08T08:00:00Z",
      canFinishAt: "2026-11-08T08:20:00Z",
      doneAt: "2026-11-08T08:25:00Z",
      extra: { runId: "r2", startedAt: "2026-11-08T09:48:00Z" },
    };
    const v = extraRunView(done);
    expect(v).toMatchObject({ state: "running", runId: "r2", minMinutes: 0, canFinishAt: "2026-11-08T09:48:00Z" });
    expect(taskMeta(v!, now)).toBe("Đang làm thêm · 12 phút — không bắt buộc");
    expect(studyTimerLabel(v!, now)).toBe("đã làm 12 phút");
    expect(extraRunView({ ...done, extra: null })).toBeNull();
    expect(extraRunView({ ...done, state: "running" })).toBeNull();
  });
});
