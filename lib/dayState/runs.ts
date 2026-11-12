/** task_runs of today: required / "Làm thêm" runs (rule 10), minutes worked, focus runs (rule 19). */

import { iso, MINUTE_MS, toMs, toMsOrNull } from "./instants";
import type { TaskRunInput, TaskView } from "./types";

/** Prefer a finished run (latest done_at); otherwise the latest started run. */
export function pickRun(runs: TaskRunInput[]): TaskRunInput | null {
  let best: TaskRunInput | null = null;
  for (const r of runs) {
    if (best === null) {
      best = r;
      continue;
    }
    const rDone = toMsOrNull(r.doneAt, "task_runs.done_at");
    const bDone = toMsOrNull(best.doneAt, "task_runs.done_at");
    if (rDone !== null || bDone !== null) {
      if (bDone === null || (rDone !== null && rDone > bDone)) best = r;
      continue;
    }
    const rStart = toMsOrNull(r.startedAt, "task_runs.started_at") ?? -Infinity;
    const bStart = toMsOrNull(best.startedAt, "task_runs.started_at") ?? -Infinity;
    if (rStart > bStart) best = r;
  }
  return best;
}

/** R8a: the runs of one template today (interpretation 10). */
export interface TemplateRuns {
  /** The required run: the earliest finished one, else the latest started (as pickRun). */
  run: TaskRunInput | null;
  /** The running extra run of a done template. */
  extra: TaskRunInput | null;
  /** Runs counted in todayMinutes / sessions. */
  counted: TaskRunInput[];
  /** Every run started at or after the required run's done_at ("Làm thêm"), finished or not. */
  later: TaskRunInput[];
}

export function templateRuns(runs: TaskRunInput[]): TemplateRuns {
  let required: TaskRunInput | null = null;
  let requiredDone = Infinity;
  for (const r of runs) {
    toMsOrNull(r.startedAt, "task_runs.started_at"); // validate every row (malformed input throws)
    const done = toMsOrNull(r.doneAt, "task_runs.done_at");
    if (done !== null && (done < requiredDone || (done === requiredDone && required !== null && r.id < required.id))) {
      required = r;
      requiredDone = done;
    }
  }
  if (required === null) {
    const run = pickRun(runs);
    return { run, extra: null, counted: run?.startedAt ? [run] : [], later: [] };
  }
  const later = runs.filter((r) => r !== required && r.startedAt !== null && toMs(r.startedAt, "task_runs.started_at") >= requiredDone);
  const finished = later.filter((r) => r.doneAt !== null);
  const extra = pickRun(later.filter((r) => r.doneAt === null));
  return { run: required, extra, counted: [required, ...finished, ...(extra ? [extra] : [])].filter((r) => r.startedAt !== null), later };
}

/**
 * R8a (interpretation 10), exported for the parent's review and reminders (D2 A5). Among the runs
 * of ONE template on ONE day (any order): the required run (the earliest finished one; null while
 * none is finished) and the "Làm thêm" runs (every run started at or after its done_at, finished
 * or not). Same rule as the day state. Malformed instants throw, as in computeDayState.
 */
export function splitTemplateRuns(runs: readonly TaskRunInput[]): { requiredId: string | null; extraIds: string[] } {
  const r = templateRuns([...runs]);
  return { requiredId: r.run !== null && r.run.doneAt !== null ? r.run.id : null, extraIds: r.later.map((x) => x.id) };
}

/** R8a: whole minutes worked in these runs (a running run counts up to now). */
export function workedMinutes(runs: TaskRunInput[], nowMs: number, fallbackDoneAt: string | null = null): number {
  let ms = 0;
  for (const r of runs) {
    if (r.startedAt === null) continue;
    const end = toMsOrNull(r.doneAt ?? fallbackDoneAt, "task_runs.done_at") ?? nowMs;
    ms += Math.max(0, end - toMs(r.startedAt, "task_runs.started_at"));
  }
  return Math.floor(ms / MINUTE_MS);
}

export function taskState(placeholder: boolean, run: TaskRunInput | null, doneAt: string | null): TaskView["state"] {
  if (placeholder) return "placeholder";
  if (doneAt !== null) return "done";
  if (run?.startedAt) return "running";
  return "todo";
}

export function canFinishAt(startedAt: string | null, minMinutes: number): string | null {
  if (startedAt === null) return null;
  return iso(toMs(startedAt, "task_runs.started_at") + minMinutes * MINUTE_MS);
}

export interface FocusRun {
  startMs: number;
  /** null while running. */
  endMs: number | null;
}

export function focusRun(startedAt: string | null, doneAt: string | null): FocusRun {
  return {
    startMs: startedAt === null ? NaN : toMs(startedAt, "task_runs.started_at"),
    endMs: toMsOrNull(doneAt, "task_runs.done_at"),
  };
}
