import { describe, expect, it } from "vitest";
import { computeDayState, splitTemplateRuns, type DayInput, type TaskRunInput, type TaskTemplateInput } from "@/lib/dayState";
import { countUnreviewed, extraLine, splitExtraRuns, type RunRowLite } from "@/lib/parent/extraRuns";
import { childOverview, type Verdict } from "@/lib/parent/overview";
import { eveningMessage } from "@/lib/push/messages";

// D2 A5: "Làm thêm" runs (R8a) in the parent's review and reminders. Wednesday 2026-10-14, VN.
const TODAY = "2026-10-14";
const at = (t: string) => new Date(`${TODAY}T${t}+07:00`).toISOString();
const CHILD = "c1";
const TPL = "t-luyen-de";

type Row = RunRowLite & { parent_verdict: "ok" | "not_ok" | null };
const row = (id: string, start: string, done: string | null, patch: Partial<Row> = {}): Row => ({
  id,
  child_id: CHILD,
  local_date: TODAY,
  source: "template",
  template_id: TPL,
  started_at: at(start),
  done_at: done === null ? null : at(done),
  parent_verdict: null,
  ...patch,
});

describe("splitExtraRuns", () => {
  it("the earliest finished run is required; runs started at or after its done_at are extra", () => {
    const rows = [row("extra2", "17:00", "17:45"), row("req", "15:00", "15:25"), row("extra1", "15:25", "15:45")];
    const { extra, byRequired } = splitExtraRuns(rows);
    expect([...extra].sort()).toEqual(["extra1", "extra2"]);
    expect(byRequired.get("req")).toEqual({ count: 2, minutes: 65 });
    expect(extraLine(byRequired.get("req")!)).toBe("Làm thêm: 2 lần · 1 giờ 5 phút");
  });

  it("a running extra is extra but not counted in the summary", () => {
    const { extra, byRequired } = splitExtraRuns([row("req", "15:00", "15:25"), row("x", "16:00", "16:10"), row("live", "18:00", null)]);
    expect(extra.has("live")).toBe(true);
    expect(byRequired.get("req")).toEqual({ count: 1, minutes: 10 });
  });

  it("groups by child, day and template; homework is never extra", () => {
    const rows = [
      row("a", "15:00", "15:25"),
      row("b", "16:00", "16:30", { template_id: "other" }),
      row("c", "16:00", "16:30", { child_id: "c2" }),
      row("d", "16:00", "16:30", { local_date: "2026-10-15" }),
      row("hw", "16:00", "16:30", { source: "homework", template_id: null }),
    ];
    const { extra, byRequired } = splitExtraRuns(rows);
    expect(extra.size).toBe(0);
    expect(byRequired.size).toBe(0);
  });

  it("a run started before the required run was done (double start) is not extra", () => {
    expect([...splitExtraRuns([row("req", "15:00", "15:25"), row("early", "15:10", "15:40")]).extra]).toEqual([]);
  });

  it("matches the day state's own rule", () => {
    const rows = [row("req", "15:00", "15:25"), row("x", "15:30", "15:50"), row("live", "18:00", null)];
    const tpl: TaskTemplateInput = { id: TPL, part: "extra", title: "Luyện đề", subject: null, appSlotId: null, weekdays: [3], minMinutes: 20, deepLink: null, sort: 0, active: true };
    const runs: TaskRunInput[] = rows.map((r) => ({ id: r.id, localDate: TODAY, source: "template", homeworkItemId: null, templateId: TPL, startedAt: r.started_at, doneAt: r.done_at, proofPaths: [] }));
    const input: DayInput = {
      settings: { breakMinutes: 10, freeMinutes: 45, extraMinMinutes: 20, skillMinMinutes: 20, passesPerWeek: 1, trustUpPct: 90, trustUpWeeks: 3, trustDownPct: 70, homeworkLookaheadDays: 1, homeworkMinUpcoming: 1 },
      bedtime: "21:30",
      trustMode: "lock",
      sessions: [],
      homework: [],
      templates: [tpl],
      appSlots: [],
      runs,
      overrides: [],
      breaks: [],
    };
    const item = computeDayState(input, new Date(at("18:10"))).part1.items[0]!;
    expect(item.runId).toBe("req");
    expect(item.extra?.runId).toBe("live");
    expect(item.sessions).toBe(3); // required + finished extra + running extra
    expect(splitTemplateRuns(runs)).toEqual({ requiredId: "req", extraIds: ["x", "live"] });

    // The parent's overview says "đang làm thêm" while the extra runs (display only).
    const o = childOverview(computeDayState(input, new Date(at("18:10"))), new Map<string, Verdict>([["req", "ok"]]), new Date(at("18:10")));
    expect(o.today[0]?.tag).toEqual({ label: "Đạt · đang làm thêm 10′", tone: "ok" });
    const plain = childOverview(computeDayState(input, new Date(at("18:10"))), new Map<string, Verdict>(), new Date(at("18:10")));
    expect(plain.today[0]?.tag).toEqual({ label: "Xong 15:25 · đang làm thêm 10′", tone: "run" });
  });
});

describe("countUnreviewed (evening reminder)", () => {
  it("extra runs never count as 'chưa xem'", () => {
    const rows = [row("req", "15:00", "15:25"), row("x1", "15:30", "15:50"), row("x2", "16:00", "16:20"), row("hw", "17:00", "17:30", { source: "homework", template_id: null })];
    expect(countUnreviewed(rows)).toBe(2); // the required run + the homework
    expect(eveningMessage(countUnreviewed(rows), 0)?.body).toBe("2 bài chưa xem · chạm để mở");
  });

  it("a reviewed required run still anchors its extra runs", () => {
    const rows = [row("req", "15:00", "15:25", { parent_verdict: "ok" }), row("x1", "15:30", "15:50")];
    expect(countUnreviewed(rows)).toBe(0);
    expect(eveningMessage(countUnreviewed(rows), 0)).toBeNull();
  });

  it("unfinished rows are never counted", () => {
    expect(countUnreviewed([row("live", "15:00", null)])).toBe(0);
  });
});
