/** The task lists of Part 1 / Part 2 (templates, homework groups 17, early 18) and their counts. */

import { addDays, localDate } from "../time";
import { toMs } from "./instants";
import { canFinishAt, focusRun, pickRun, taskState, templateRuns, workedMinutes, type FocusRun } from "./runs";
import type { DayInput, HomeworkItemInput, PickView, TaskRunInput, TaskTemplateInput, TaskView } from "./types";

export function compareTemplates(a: TaskTemplateInput, b: TaskTemplateInput): number {
  if (a.sort !== b.sort) return a.sort - b.sort;
  if (a.title !== b.title) return a.title < b.title ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The templates of one part a child gets on a weekday: active, scheduled that ISO weekday
 * (1 = Monday ... 7 = Sunday) and not turned off for that date (day_sessions.disabled_template_ids),
 * in the list order. Shared by today's lists and the read-only "Lịch của con".
 */
export function scheduledTemplates(templates: readonly TaskTemplateInput[], part: "extra" | "skill", weekday: number, disabled: ReadonlySet<string>): TaskTemplateInput[] {
  return templates.filter((t) => t.part === part && t.active && t.weekdays.includes(weekday) && !disabled.has(t.id)).sort(compareTemplates);
}

export function templateViews(
  input: DayInput,
  part: "extra" | "skill",
  weekday: number,
  disabled: Set<string>,
  runsToday: TaskRunInput[],
  nowMs: number,
  focusRuns: FocusRun[],
): TaskView[] {
  const slots = new Map(input.appSlots.map((s) => [s.id, s]));
  const fallbackMin = part === "extra" ? input.settings.extraMinMinutes : input.settings.skillMinMinutes;
  return scheduledTemplates(input.templates, part, weekday, disabled)
    .map((t) => {
      const slot = t.appSlotId !== null ? slots.get(t.appSlotId) : undefined;
      const placeholder = slot?.kind === "placeholder";
      const runs = placeholder
        ? { run: null, extra: null, counted: [], later: [] }
        : templateRuns(runsToday.filter((r) => r.source === "template" && r.templateId === t.id));
      const run = runs.run;
      for (const r of runs.counted) focusRuns.push(focusRun(r.startedAt, r.doneAt));
      const minMinutes = t.minMinutes ?? fallbackMin;
      const startedAt = run?.startedAt ?? null;
      const doneAt = run?.doneAt ?? null;
      return {
        key: `template:${t.id}`,
        id: t.id,
        source: "template",
        part: part === "extra" ? 1 : 2,
        title: t.title,
        subject: t.subject,
        note: null,
        dueDate: null,
        overdue: false,
        minMinutes,
        runId: run?.id ?? null,
        startedAt,
        canFinishAt: canFinishAt(startedAt, minMinutes),
        doneAt,
        requiresProof: false,
        proofCount: run?.proofPaths.length ?? 0,
        placeholder,
        deepLink: placeholder ? null : (t.deepLink ?? slot?.url ?? null),
        appLabel: placeholder ? null : appLabelOf(t.deepLink && slot?.url && hostOf(t.deepLink) !== hostOf(slot.url) ? null : (slot?.label ?? null), t.deepLink ?? slot?.url ?? null),
        addedAfterPart1Done: false,
        group: null,
        early: false,
        state: taskState(placeholder, run, doneAt),
        todayMinutes: workedMinutes(runs.counted, nowMs),
        sessions: runs.counted.length,
        extra: runs.extra?.startedAt ? { runId: runs.extra.id, startedAt: runs.extra.startedAt } : null,
      } satisfies TaskView;
    });
}

/** Interpretation 18: finished on a local date at least 2 days before the due date. */
export function isEarly(h: HomeworkItemInput): boolean {
  if (h.doneAt === null) return false;
  return localDate(new Date(toMs(h.doneAt, "homework_items.done_at"))) <= addDays(h.dueDate, -2);
}

export function homeworkViews(input: DayInput, today: string, runsToday: TaskRunInput[], nowMs: number, focusRuns: FocusRun[]): TaskView[] {
  const cutoff = addDays(today, input.settings.homeworkLookaheadDays);
  return input.homework
    .filter((h) => {
      if (h.archivedAt !== null) return false;
      if (h.doneAt === null) return true;
      return localDate(new Date(toMs(h.doneAt, "homework_items.done_at"))) === today;
    })
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      const ca = toMs(a.createdAt, "homework_items.created_at");
      const cb = toMs(b.createdAt, "homework_items.created_at");
      if (ca !== cb) return ca - cb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((h) => {
      const run = pickRun(runsToday.filter((r) => r.source === "homework" && r.homeworkItemId === h.id));
      const startedAt = run?.startedAt ?? null;
      if (run?.startedAt) focusRuns.push(focusRun(run.startedAt, run.doneAt ?? h.doneAt));
      return {
        key: `homework:${h.id}`,
        id: h.id,
        source: "homework",
        part: 1,
        title: h.subject,
        subject: h.subject,
        note: h.note,
        dueDate: h.dueDate,
        overdue: h.dueDate < today,
        minMinutes: 0,
        runId: run?.id ?? null,
        startedAt,
        canFinishAt: canFinishAt(startedAt, 0),
        doneAt: h.doneAt,
        requiresProof: true,
        proofCount: run?.proofPaths.length ?? 0,
        placeholder: false,
        deepLink: null,
        appLabel: null,
        addedAfterPart1Done: false,
        group: h.dueDate > cutoff ? "upcoming" : "due",
        early: isEarly(h),
        state: taskState(false, run, h.doneAt),
        todayMinutes: run ? workedMinutes([run], nowMs, h.doneAt) : 0,
        sessions: run?.startedAt ? 1 : 0,
        extra: null,
      } satisfies TaskView;
    });
}

export function countPart(items: TaskView[]): { total: number; done: number } {
  const counted = items.filter((i) => !i.placeholder && i.group !== "upcoming");
  return { total: counted.length, done: counted.filter((i) => i.doneAt !== null).length };
}

/** Interpretation 17: quota of upcoming homework on a day with no due homework. */
export function pickQuota(items: TaskView[], minUpcoming: number): PickView {
  const upcoming = items.filter((i) => i.group === "upcoming");
  const done = upcoming.filter((i) => i.doneAt !== null).length;
  const anyDue = items.some((i) => i.group === "due");
  return { needed: anyDue ? 0 : Math.min(Math.max(0, minUpcoming), upcoming.length), done };
}

/** R6a: the app's name for a link: the slot label, else the site without "www." (null without a link). */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function appLabelOf(slotLabel: string | null, url: string | null): string | null {
  if (!url) return null;
  const label = slotLabel?.trim();
  if (label) return label;
  return hostOf(url) || null;
}
