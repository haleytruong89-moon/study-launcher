/**
 * Day state machine (docs/DESIGN.md section 5): the single source of truth for
 * "is the web open or locked right now?", shared by the child's Launcher and the
 * browser extension.
 *
 * `computeDayState(input, now)` is PURE: no I/O, never reads the real clock, no
 * randomness. A server route loads the child's rows into `DayInput`, calls it with
 * the server time, persists `milestones` (if any) in ONE transaction, and returns
 * the state. Milestones are already applied to the returned state.
 *
 * The caller must pass only this child's rows. `sessions` must contain today's
 * day_sessions row (if it exists) plus history covering at least
 * `weekStart(today) - 7 * trust_up_weeks` days (week strip, passes, trust progress).
 * `runs` may contain any dates; only today's are used.
 *
 * ---------------------------------------------------------------------------
 * Interpretations (confirm with parent)
 * ---------------------------------------------------------------------------
 * Where DESIGN/SPEC is silent or ambiguous, the stricter (fail-closed) reading
 * was chosen. The priority order of DESIGN section 5 is never changed.
 *
 *  1. Empty Part 2 counts as done only once Part 2 is UNLOCKED (Part 1 done AND
 *     break used/skipped/expired). The web is never opened earlier than the normal
 *     flow would open it. The same "unlocked" condition applies to a non-empty
 *     Part 2 whose tasks are all done.
 *  2. Break: BREAK_OFFER until break_started_at is set or break_skipped. The break
 *     counts as used when break_skipped, or it was started and (break_ended_at is
 *     set or now >= break_started_at + break_minutes). Only once per day. With
 *     break_minutes = 0 the offer is still shown (the child starts or skips it).
 *  3. OPEN_TRUST and OPEN_SICK: openUntil = next 00:00. Every locked status
 *     (LOCK_*): openUntil = null.
 *  4. Overrides: only rows for today's local_date with `until` > now are in effect;
 *     among those the newest by created_at wins, even if it is a lock and an older
 *     one is an open. On an exact created_at tie, the lock wins. `until` is clipped
 *     at 00:00. Consequence to confirm: when the newest override expires, an OLDER
 *     override that is still within its `until` takes effect again.
 *  5. Trust progress counts only COMPLETE weeks (Mon-Sun) before the current week,
 *     walking back from the most recent one; days without data count as not OK;
 *     the denominator is always 7 days. weeksMet is capped at weeksNeeded.
 *     suggestLock looks only at the most recent complete week.
 *  6. Week strip = the last 7 local days ending today. Precedence per day:
 *     sick > pass > ok > miss. A holiday shows as 'ok'. Today shows 'today' unless
 *     it is already sick / pass / ok (an unfinished today after bedtime is still
 *     'today', not 'miss').
 *  7. "Ngày đạt": part2_done_at strictly BEFORE bedtime on that local date (bedtime
 *     is read as a time on the same date), or pass used, or day_type sick/holiday.
 *     Exam days only via part2_done_at (or a pass).
 *  8. Lazily written milestones use `now` (the read time), as DESIGN says, not the
 *     last task's done_at. If free time already started today (pass), finishing
 *     Part 2 writes only part2_done_at (free time is once per day). If the stored
 *     row has part2_done_at but no free_started_at (inconsistent data), free time is
 *     NOT created: the day stays locked until a parent override.
 *  9. Milestones are computed from data in every status, including OPEN_TRUST,
 *     OPEN_SICK and overrides. Under LOCK_OVERRIDE, free time that starts still
 *     runs down while the override keeps the web locked.
 * 10. Homework done state comes only from homework_items.done_at (set by the finish
 *     route after >= 1 proof photo). Homework done on an EARLIER day is not listed;
 *     homework done today stays listed as done. Template done state = a task_run of
 *     today with done_at; the minimum minutes are enforced by the finish route and
 *     NOT re-checked here (so a settings change mid-day never re-locks a finished
 *     task).
 * 11. Only today's task_runs are used; an unfinished run from a previous day is
 *     ignored (the child starts again).
 * 12. Placeholder app slots are shown with `placeholder: true` and never counted in
 *     EITHER part (a placeholder task cannot be done, so counting it would lock the
 *     day forever). A slot's `active` flag does not change this; only the
 *     template's `active` flag removes a task.
 * 13. Items added after part1_done_at (homework or newly enabled templates) are
 *     listed and counted in total/done, but Part 1 stays done (no re-lock); homework
 *     rows created after the milestone are flagged `addedAfterPart1Done`.
 * 14. Pass availability follows DESIGN exactly: passes used in this Monday-week
 *     (by day_sessions.local_date) < passes_per_week AND no free_started_at today.
 *     No extra restriction is added for sick / trust / override days.
 * 15. Spec consequence to be aware of: an EMPTY Part 1 is marked done at the first
 *     read of the day (e.g. 06:00, before the parent assigns homework); homework
 *     assigned later that day will then not re-lock the day.
 * 16. Any malformed instant in the input throws; the caller should then answer with
 *     an error so the extension stays fail-closed.
 */

import { addDays, atLocalTime, isoWeekday, localDate, nextMidnight, weekStart } from "./time";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Status =
  | "LOCK_P1"
  | "BREAK_OFFER"
  | "BREAK"
  | "LOCK_P2"
  | "FREE"
  | "LOCK_END"
  | "OPEN_SICK"
  | "OPEN_TRUST"
  | "OPEN_OVERRIDE"
  | "LOCK_OVERRIDE";

export type DayType = "normal" | "sick" | "exam" | "holiday";
export type TrustMode = "lock" | "trust";
export type WeekResult = "ok" | "pass" | "miss" | "today" | "sick";

/** family_settings (the family rules). */
export interface FamilySettingsInput {
  breakMinutes: number;
  freeMinutes: number;
  extraMinMinutes: number;
  skillMinMinutes: number;
  passesPerWeek: number;
  trustUpPct: number;
  trustUpWeeks: number;
  trustDownPct: number;
  homeworkLookaheadDays: number;
}

/** A day_sessions row. Instants are ISO strings, dates 'YYYY-MM-DD'. */
export interface DaySessionInput {
  localDate: string;
  dayType: DayType;
  disabledTemplateIds: string[];
  breakStartedAt: string | null;
  breakEndedAt: string | null;
  breakSkipped: boolean;
  part1DoneAt: string | null;
  part2DoneAt: string | null;
  freeStartedAt: string | null;
  passUsedAt: string | null;
}

/** A homework_items row. */
export interface HomeworkItemInput {
  id: string;
  subject: string;
  dueDate: string;
  note: string | null;
  doneAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

/** A task_templates row. */
export interface TaskTemplateInput {
  id: string;
  part: "extra" | "skill";
  title: string;
  subject: string | null;
  appSlotId: string | null;
  /** 1 = Monday ... 7 = Sunday */
  weekdays: number[];
  minMinutes: number | null;
  deepLink: string | null;
  sort: number;
  active: boolean;
}

/** An app_slots row. */
export interface AppSlotInput {
  id: string;
  kind: "internal" | "external" | "placeholder";
  label: string;
  url: string | null;
  active: boolean;
}

/** A task_runs row. */
export interface TaskRunInput {
  id: string;
  localDate: string;
  source: "homework" | "template";
  homeworkItemId: string | null;
  templateId: string | null;
  startedAt: string | null;
  doneAt: string | null;
  proofPaths: string[];
}

/** An overrides row. */
export interface OverrideInput {
  id: string;
  localDate: string;
  kind: "open_until" | "lock_until";
  until: string;
  createdAt: string;
}

export interface DayInput {
  settings: FamilySettingsInput;
  /** profiles.bedtime, "HH:MM" or "HH:MM:SS" (local time). */
  bedtime: string;
  /** trust_state.mode; use 'lock' when the row does not exist. */
  trustMode: TrustMode;
  /** day_sessions rows: today (if it exists) + history. */
  sessions: DaySessionInput[];
  homework: HomeworkItemInput[];
  templates: TaskTemplateInput[];
  appSlots: AppSlotInput[];
  runs: TaskRunInput[];
  overrides: OverrideInput[];
}

export interface TaskView {
  /** Stable key: 'homework:<id>' or 'template:<id>'. */
  key: string;
  id: string;
  source: "homework" | "template";
  part: 1 | 2;
  title: string;
  subject: string | null;
  note: string | null;
  /** Homework only: due date and whether it is past due. */
  dueDate: string | null;
  overdue: boolean;
  /** 0 for homework (no minimum). */
  minMinutes: number;
  runId: string | null;
  startedAt: string | null;
  /** startedAt + minMinutes; null when not started. */
  canFinishAt: string | null;
  doneAt: string | null;
  /** Homework needs >= 1 proof photo to be finished. */
  requiresProof: boolean;
  proofCount: number;
  /** "Đang xây" slot: shown but not counted and cannot be started. */
  placeholder: boolean;
  deepLink: string | null;
  /** Homework created after part1_done_at: shown, does not re-lock the day. */
  addedAfterPart1Done: boolean;
  state: "todo" | "running" | "done" | "placeholder";
}

export interface PartView {
  /** Counted tasks (placeholders excluded). */
  total: number;
  done: number;
  /** The part's milestone is set (part1_done_at / part2_done_at). */
  complete: boolean;
  doneAt: string | null;
  items: TaskView[];
}

export interface BreakView {
  state: "not_yet" | "offer" | "running" | "done" | "skipped";
  startedAt: string | null;
  /** break_started_at + break_minutes, clipped at 00:00. */
  endsAt: string | null;
}

export interface FreeView {
  startedAt: string | null;
  /** free_started_at + free_minutes, clipped at 00:00. */
  endsAt: string | null;
}

/** Milestones the caller must persist (one transaction). Already applied to the state. */
export interface DayMilestones {
  part1DoneAt?: string;
  part2DoneAt?: string;
  freeStartedAt?: string;
}

export interface TrustView {
  mode: TrustMode;
  weeksMet: number;
  weeksNeeded: number;
  /** Lock mode and enough weeks met: suggest Trust to the parent (never auto-switch). */
  suggestTrust: boolean;
  /** Trust mode and the last complete week < trust_down_pct: suggest Lock. */
  suggestLock: boolean;
}

export interface DayState {
  status: Status;
  /** The extension only needs this + the allowlist. */
  open: boolean;
  /** ISO; when the current open window ends (always <= next 00:00). null when locked. */
  openUntil: string | null;
  localDate: string;
  dayType: DayType;
  part1: PartView;
  part2: PartView & { locked: boolean };
  break: BreakView;
  free: FreeView;
  passAvailable: boolean;
  passesLeft: number;
  week: { date: string; result: WeekResult }[];
  trust: TrustView;
  milestones: DayMilestones;
  serverNow: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINUTE_MS = 60_000;

function toMs(value: string, field: string): number {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) throw new Error(`computeDayState: invalid instant in ${field}: ${value}`);
  return t;
}

function toMsOrNull(value: string | null, field: string): number | null {
  return value === null ? null : toMs(value, field);
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function emptySession(date: string): DaySessionInput {
  return {
    localDate: date,
    dayType: "normal",
    disabledTemplateIds: [],
    breakStartedAt: null,
    breakEndedAt: null,
    breakSkipped: false,
    part1DoneAt: null,
    part2DoneAt: null,
    freeStartedAt: null,
    passUsedAt: null,
  };
}

/** Prefer a finished run (latest done_at); otherwise the latest started run. */
function pickRun(runs: TaskRunInput[]): TaskRunInput | null {
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

function taskState(placeholder: boolean, run: TaskRunInput | null, doneAt: string | null): TaskView["state"] {
  if (placeholder) return "placeholder";
  if (doneAt !== null) return "done";
  if (run?.startedAt) return "running";
  return "todo";
}

function canFinishAt(startedAt: string | null, minMinutes: number): string | null {
  if (startedAt === null) return null;
  return iso(toMs(startedAt, "task_runs.started_at") + minMinutes * MINUTE_MS);
}

function compareTemplates(a: TaskTemplateInput, b: TaskTemplateInput): number {
  if (a.sort !== b.sort) return a.sort - b.sort;
  if (a.title !== b.title) return a.title < b.title ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function templateViews(
  input: DayInput,
  part: "extra" | "skill",
  weekday: number,
  disabled: Set<string>,
  runsToday: TaskRunInput[],
): TaskView[] {
  const slots = new Map(input.appSlots.map((s) => [s.id, s]));
  const fallbackMin = part === "extra" ? input.settings.extraMinMinutes : input.settings.skillMinMinutes;
  return input.templates
    .filter((t) => t.part === part && t.active && t.weekdays.includes(weekday) && !disabled.has(t.id))
    .sort(compareTemplates)
    .map((t) => {
      const slot = t.appSlotId !== null ? slots.get(t.appSlotId) : undefined;
      const placeholder = slot?.kind === "placeholder";
      const run = placeholder
        ? null
        : pickRun(runsToday.filter((r) => r.source === "template" && r.templateId === t.id));
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
        addedAfterPart1Done: false,
        state: taskState(placeholder, run, doneAt),
      } satisfies TaskView;
    });
}

function homeworkViews(input: DayInput, today: string, runsToday: TaskRunInput[]): TaskView[] {
  const cutoff = addDays(today, input.settings.homeworkLookaheadDays);
  return input.homework
    .filter((h) => {
      if (h.archivedAt !== null) return false;
      if (h.dueDate > cutoff) return false;
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
        addedAfterPart1Done: false,
        state: taskState(false, run, h.doneAt),
      } satisfies TaskView;
    });
}

function countPart(items: TaskView[]): { total: number; done: number } {
  const counted = items.filter((i) => !i.placeholder);
  return { total: counted.length, done: counted.filter((i) => i.doneAt !== null).length };
}

/** "Ngày đạt" for a day_sessions row (DESIGN section 5). */
function isDayOk(s: DaySessionInput, bedtime: string): boolean {
  if (s.dayType === "sick" || s.dayType === "holiday") return true;
  if (s.passUsedAt !== null) return true;
  if (s.part2DoneAt === null) return false;
  return toMs(s.part2DoneAt, "day_sessions.part2_done_at") < atLocalTime(s.localDate, bedtime).getTime();
}

function weekResult(s: DaySessionInput | undefined, bedtime: string, isToday: boolean): WeekResult {
  if (s !== undefined) {
    if (s.dayType === "sick") return "sick";
    if (s.passUsedAt !== null) return "pass";
    if (isDayOk(s, bedtime)) return "ok";
  }
  return isToday ? "today" : "miss";
}

function pickOverride(overrides: OverrideInput[], today: string, nowMs: number): OverrideInput | null {
  let best: OverrideInput | null = null;
  let bestCreated = -Infinity;
  for (const o of overrides) {
    if (o.localDate !== today) continue;
    if (!(toMs(o.until, "overrides.until") > nowMs)) continue;
    const created = toMs(o.createdAt, "overrides.created_at");
    if (best === null || created > bestCreated || (created === bestCreated && o.kind === "lock_until")) {
      best = o;
      bestCreated = created;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// computeDayState
// ---------------------------------------------------------------------------

export function computeDayState(input: DayInput, now: Date): DayState {
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) throw new Error("computeDayState: invalid now");
  const nowIso = iso(nowMs);
  const today = localDate(now);
  const midnightMs = nextMidnight(now).getTime();
  const settings = input.settings;

  const stored = input.sessions.find((s) => s.localDate === today);
  const session: DaySessionInput = { ...(stored ?? emptySession(today)) };
  const milestones: DayMilestones = {};

  const runsToday = input.runs.filter((r) => r.localDate === today);
  const weekday = isoWeekday(today);
  const disabled = new Set(session.disabledTemplateIds);

  // --- Part 1: homework (lookahead + overdue) + extra templates of today ---
  const part1Items = [
    ...homeworkViews(input, today, runsToday),
    ...templateViews(input, "extra", weekday, disabled, runsToday),
  ];
  const part1Count = countPart(part1Items);
  if (session.part1DoneAt === null && part1Count.done === part1Count.total) {
    session.part1DoneAt = nowIso;
    milestones.part1DoneAt = nowIso;
  }
  const part1Done = session.part1DoneAt !== null;
  const part1DoneMs = toMsOrNull(session.part1DoneAt, "day_sessions.part1_done_at");
  if (part1DoneMs !== null) {
    const created = new Map(input.homework.map((h) => [h.id, h.createdAt]));
    for (const item of part1Items) {
      if (item.source !== "homework") continue;
      const c = created.get(item.id);
      item.addedAfterPart1Done = c !== undefined && toMs(c, "homework_items.created_at") > part1DoneMs;
    }
  }

  // --- Break ---
  const breakStartMs = toMsOrNull(session.breakStartedAt, "day_sessions.break_started_at");
  const breakEndMs = breakStartMs === null ? null : breakStartMs + settings.breakMinutes * MINUTE_MS;
  const breakRunning = breakStartMs !== null && session.breakEndedAt === null && nowMs < (breakEndMs as number);
  const breakUsed = session.breakSkipped || (breakStartMs !== null && !breakRunning);
  let breakState: BreakView["state"];
  if (breakStartMs !== null) breakState = breakRunning ? "running" : "done";
  else if (session.breakSkipped) breakState = "skipped";
  else breakState = part1Done ? "offer" : "not_yet";

  // --- Part 2: skill templates of today; locked from data, not web status ---
  const part2Locked = !part1Done || !breakUsed;
  const part2Items = templateViews(input, "skill", weekday, disabled, runsToday);
  const part2Count = countPart(part2Items);
  if (!part2Locked && session.part2DoneAt === null && part2Count.done === part2Count.total) {
    session.part2DoneAt = nowIso;
    milestones.part2DoneAt = nowIso;
    if (session.freeStartedAt === null) {
      session.freeStartedAt = nowIso;
      milestones.freeStartedAt = nowIso;
    }
  }

  // --- Free time ---
  const freeStartMs = toMsOrNull(session.freeStartedAt, "day_sessions.free_started_at");
  const freeEndMs = freeStartMs === null ? null : freeStartMs + settings.freeMinutes * MINUTE_MS;

  // --- Status: DESIGN section 5 priority table, top-down, first match wins ---
  let status: Status;
  let openUntilMs: number | null = null;
  const override = pickOverride(input.overrides, today, nowMs);
  if (override !== null) {
    if (override.kind === "lock_until") {
      status = "LOCK_OVERRIDE"; // rows 1-2
    } else {
      status = "OPEN_OVERRIDE";
      openUntilMs = toMs(override.until, "overrides.until");
    }
  } else if (input.trustMode === "trust") {
    status = "OPEN_TRUST"; // row 3
    openUntilMs = midnightMs;
  } else if (session.dayType === "sick") {
    status = "OPEN_SICK"; // row 4
    openUntilMs = midnightMs;
  } else if (freeEndMs !== null && nowMs >= freeEndMs) {
    status = "LOCK_END"; // row 5
  } else if (freeEndMs !== null) {
    status = "FREE"; // row 6
    openUntilMs = freeEndMs;
  } else if (!part1Done) {
    status = "LOCK_P1"; // row 7
  } else if (breakStartMs === null && !session.breakSkipped) {
    status = "BREAK_OFFER"; // row 8
  } else if (breakRunning) {
    status = "BREAK"; // row 9
    openUntilMs = breakEndMs;
  } else {
    status = "LOCK_P2"; // row 10
  }
  if (openUntilMs !== null) openUntilMs = Math.min(openUntilMs, midnightMs);
  const open = openUntilMs !== null;

  // --- Passes (Monday-week) ---
  const monday = weekStart(today);
  const passesUsed = input.sessions.filter(
    (s) => s.localDate >= monday && s.localDate <= today && s.passUsedAt !== null,
  ).length;
  const passesLeft = Math.max(0, settings.passesPerWeek - passesUsed);
  const passAvailable = passesLeft > 0 && session.freeStartedAt === null;

  // --- Week strip + trust progress (today uses the applied session) ---
  const byDate = new Map<string, DaySessionInput>();
  for (const s of input.sessions) if (!byDate.has(s.localDate)) byDate.set(s.localDate, s);
  byDate.set(today, session);

  const week: DayState["week"] = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    week.push({ date, result: weekResult(byDate.get(date), input.bedtime, i === 0) });
  }

  const okDaysInWeek = (start: string): number => {
    let ok = 0;
    for (let d = 0; d < 7; d++) {
      const s = byDate.get(addDays(start, d));
      if (s !== undefined && isDayOk(s, input.bedtime)) ok++;
    }
    return ok;
  };
  const weeksNeeded = settings.trustUpWeeks;
  let weeksMet = 0;
  for (let k = 1; k <= weeksNeeded; k++) {
    if (okDaysInWeek(addDays(monday, -7 * k)) * 100 >= settings.trustUpPct * 7) weeksMet++;
    else break;
  }
  const lastWeekBelowDown = okDaysInWeek(addDays(monday, -7)) * 100 < settings.trustDownPct * 7;

  return {
    status,
    open,
    openUntil: openUntilMs === null ? null : iso(openUntilMs),
    localDate: today,
    dayType: session.dayType,
    part1: { ...part1Count, complete: part1Done, doneAt: session.part1DoneAt, items: part1Items },
    part2: {
      ...part2Count,
      complete: session.part2DoneAt !== null,
      doneAt: session.part2DoneAt,
      locked: part2Locked,
      items: part2Items,
    },
    break: {
      state: breakState,
      startedAt: session.breakStartedAt,
      endsAt: breakEndMs === null ? null : iso(Math.min(breakEndMs, midnightMs)),
    },
    free: {
      startedAt: session.freeStartedAt,
      endsAt: freeEndMs === null ? null : iso(Math.min(freeEndMs, midnightMs)),
    },
    passAvailable,
    passesLeft,
    week,
    trust: {
      mode: input.trustMode,
      weeksMet,
      weeksNeeded,
      suggestTrust: input.trustMode === "lock" && weeksMet >= weeksNeeded,
      suggestLock: input.trustMode === "trust" && lastWeekBelowDown,
    },
    milestones,
    serverNow: nowIso,
  };
}
