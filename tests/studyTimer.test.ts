import { describe, expect, it } from "vitest";
import type { TaskView } from "@/lib/dayState";
import { timerMs } from "@/lib/today/view";

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
};
const now = Date.parse("2026-11-08T10:00:00Z");

describe("Góc học tập big timer (R6c)", () => {
  it("a timed task not started shows its minimum", () => {
    expect(timerMs(base, now)).toBe(20 * 60_000);
  });
  it("a running timed task counts down to the server's canFinishAt, never below 0", () => {
    const run = { ...base, state: "running" as const, startedAt: "2026-11-08T09:55:00Z", canFinishAt: "2026-11-08T10:15:00Z" };
    expect(timerMs(run, now)).toBe(15 * 60_000);
    expect(timerMs(run, Date.parse("2026-11-08T10:30:00Z"))).toBe(0);
  });
  it("homework: 00:00 before starting, then the time since it started", () => {
    const hw = { ...base, source: "homework" as const, minMinutes: 0, requiresProof: true, group: "due" as const };
    expect(timerMs(hw, now)).toBe(0);
    expect(timerMs({ ...hw, state: "running", startedAt: "2026-11-08T09:48:00Z" }, now)).toBe(12 * 60_000);
  });
  it("a task with no minimum counts up while running", () => {
    const skill = { ...base, part: 2 as const, minMinutes: 0, state: "running" as const, startedAt: "2026-11-08T09:59:00Z" };
    expect(timerMs(skill, now)).toBe(60_000);
  });
});
