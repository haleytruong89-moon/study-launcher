import { describe, expect, it } from "vitest";
import type { TaskView } from "@/lib/dayState";
import { appLinkMode } from "@/lib/today/rules";

/** "Mở app = bắt đầu luôn" (15/11/2026): which app action a task shows. */
function task(patch: Partial<TaskView> = {}): TaskView {
  return {
    key: "template:t1",
    source: "template",
    id: "t1",
    part: 2,
    title: "Tiếng Anh",
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
    deepLink: "https://english.example.com/lesson",
    appLabel: "English OS",
    addedAfterPart1Done: false,
    group: null,
    early: false,
    state: "todo",
    todayMinutes: 0,
    sessions: 0,
    extra: null,
    ...patch,
  };
}

const FREE = { paused: false, waiting: false };

describe("appLinkMode", () => {
  it("a skill or supplementary task with an app that can start: one action, start + open", () => {
    expect(appLinkMode(task(), FREE)).toBe("startAndOpen");
    expect(appLinkMode(task({ part: 1 }), FREE)).toBe("startAndOpen");
    expect(appLinkMode(task({ minMinutes: 0 }), FREE)).toBe("startAndOpen");
  });

  it("no app link: nothing to open", () => {
    expect(appLinkMode(task({ deepLink: null, appLabel: null }), FREE)).toBeNull();
    expect(appLinkMode(task({ deepLink: null, source: "homework" }), FREE)).toBeNull();
  });

  it("cannot start right now (break, another timed task): a plain link only", () => {
    expect(appLinkMode(task(), { paused: true, waiting: false })).toBe("open");
    expect(appLinkMode(task(), { paused: false, waiting: true })).toBe("open");
  });

  it("running or done: a plain link (never a second start)", () => {
    expect(appLinkMode(task({ state: "running", runId: "r1", startedAt: "2026-11-15T08:00:00Z" }), FREE)).toBe("open");
    expect(appLinkMode(task({ state: "done", runId: "r1", doneAt: "2026-11-15T08:30:00Z" }), FREE)).toBe("open");
    // R8a "Làm thêm" keeps its own button; the app link stays plain.
    expect(appLinkMode(task({ state: "done", extra: { runId: "r2", startedAt: "2026-11-15T09:00:00Z" } }), FREE)).toBe("open");
  });

  it("homework and placeholders never start from the app link", () => {
    expect(appLinkMode(task({ source: "homework", key: "homework:h1", requiresProof: true, minMinutes: 0, part: 1 }), FREE)).toBe("open");
    expect(appLinkMode(task({ placeholder: true, state: "placeholder" }), FREE)).toBe("open");
    expect(appLinkMode(task({ requiresProof: true }), FREE)).toBe("open");
  });
});
