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
 * was chosen; items 4, 9 and 15 were decided by the parent on 14/10/2026. The priority
 * order of DESIGN section 5 changes only by parent decision: R1 (07/11/2026,
 * docs/MAN_CHINH_MOI.md section 1) opened Part 2 in parallel and moved the break.
 *
 *  1. R1 (parent decision 07/11/2026): Part 1 and Part 2 are open together from the start
 *     of the day, in any order. A part with tasks is done when all of them are; free time
 *     needs BOTH parts. Status LOCK_P1 = Part 1 not done (whatever Part 2 is), LOCK_P2 =
 *     Part 1 done, Part 2 not done.
 *  2. Break (R8b "ngân hàng giờ nghỉ", parent decision 08/11/2026; the bank itself is rule 19):
 *     optional, `break.canStart` when the bank is >= 5 minutes, fewer than break_max_per_day
 *     breaks were taken today, free time has not started, the laptop is in a locked study
 *     status (LOCK_P1 / LOCK_P2 / FREE_READY; not a parent lock, trust, sick or a parent open)
 *     and no timed task is running, a "Làm thêm" run included (R8a). The old "a part must be
 *     done" condition is gone. Starting a break uses the WHOLE bank (day_breaks.planned_minutes
 *     = bank); BREAK (row 7) is open until started_at + planned_minutes (clipped at 00:00) or
 *     "Học tiếp" (ended_at). A homework run may keep running during a break.
 *     Before migration 0014 (`breaks: null`, e.g. a preview on the production database) the
 *     OLD rule applies unchanged: once per day, after Part 1 (an empty Part 1 counts) or a really
 *     done Part 2, break_minutes > 0, same status / timed-task / free-time conditions, BREAK
 *     until break_started_at + break_minutes or break_ended_at; break_skipped = true uses it.
 *  3. OPEN_TRUST and OPEN_SICK: openUntil = next 00:00. Every locked status
 *     (LOCK_*): openUntil = null.
 *  4. Overrides (parent decision 14/10/2026): the NEWEST override of today (by
 *     created_at; on an exact tie the lock wins) supersedes all older ones. It is in
 *     effect while `until` > now; when it expires the normal flow applies, an older
 *     override never comes back. `until` is clipped at 00:00.
 *  5. Trust progress counts only COMPLETE weeks (Mon-Sun) before the current week,
 *     walking back from the most recent one; days without data count as not OK;
 *     the denominator is always 7 days. weeksMet is capped at weeksNeeded.
 *     suggestLock looks only at the most recent complete week.
 *  6. Week strip = the last 7 local days ending today. Precedence per day:
 *     sick > pass > ok > miss. A holiday shows as 'ok'. Today shows 'today' unless
 *     it is already sick / pass / ok (an unfinished today after bedtime is still
 *     'today', not 'miss').
 *  7. "Ngày đạt": part1_done_at AND part2_done_at both strictly BEFORE bedtime on that
 *     local date (bedtime is read as a time on the same date), or pass used, or day_type
 *     sick/holiday. Exam days only via the milestones (or a pass). Every row written since
 *     the first deploy (PR #4) has part1_done_at whenever part2_done_at is set, so past
 *     weeks keep their result.
 *  8. Lazily written milestones use `now` (the read time), as DESIGN says, not the
 *     last task's done_at. If free time already started today (pass), finishing the
 *     parts writes only their milestones (free time is once per day). Whenever both
 *     part milestones are set and free_started_at is not, free time starts at the read
 *     (unless a parent lock is in effect, see 9). A running break ends when free time
 *     starts (FREE is above BREAK). R8b: its unused minutes stay in the bank, and free time
 *     lasts free_minutes + the bank at free_started_at (rule 19). Before 0014 nothing is added.
 *  9. Milestones are computed from data in every status, including OPEN_TRUST,
 *     OPEN_SICK and overrides. Parent decision 14/10/2026: while a LOCK override is
 *     in effect, free time does NOT start; it starts at the first read after the
 *     lock ends (full free_minutes, still clipped at 00:00).
 * 10. Homework done state comes only from homework_items.done_at (set by the finish
 *     route after >= 1 proof photo). Homework done on an EARLIER day is not listed;
 *     homework done today stays listed as done. Template done state = a task_run of
 *     today with done_at; the minimum minutes are enforced by the finish route and
 *     NOT re-checked here (so a settings change mid-day never re-locks a finished
 *     task).
 *     R8a "Làm thêm" (parent decision 08/11/2026): a done template may be started again. Its
 *     REQUIRED run is the earliest run of today with done_at; a run started at or after that
 *     done_at is an EXTRA run. Extra runs never change completion, the part milestones, free
 *     time or any lock, have no minimum, and the running one (latest started, not finished)
 *     is `extra`. It still counts as a timed task: one timed task at a time, and no break while
 *     it runs (interpretation 2). An unfinished run that started before the required run was
 *     done (a double start) is ignored, as before. `todayMinutes` / `sessions` count the
 *     required run, the finished extra runs and the running extra (server clock, a running
 *     run up to now, the sum floored to whole minutes). Display only.
 * 11. Only today's task_runs are used; an unfinished run from a previous day is
 *     ignored (the child starts again). This includes an unfinished extra run.
 * 12. Placeholder app slots are shown with `placeholder: true` and never counted in
 *     EITHER part (a placeholder task cannot be done, so counting it would lock the
 *     day forever). A slot's `active` flag does not change this; only the
 *     template's `active` flag removes a task.
 * 13. Items added after part1_done_at (homework or newly enabled templates) are
 *     listed and counted in total/done, but Part 1 stays done (no re-lock); homework
 *     rows created after the milestone are flagged `addedAfterPart1Done`. Same for
 *     skills enabled after part2_done_at: Part 2 stays done.
 * 14. Pass availability follows DESIGN exactly: passes used in this Monday-week
 *     (by day_sessions.local_date) < passes_per_week AND no free_started_at today.
 *     No extra restriction is added for sick / trust / override days.
 * 15. Empty part (parent decisions 14/10 and 07/11/2026): an empty part counts as done
 *     (the break may start, the other part may finish the day) but is NOT frozen as its
 *     milestone until the OTHER part has its milestone; then it is frozen at that read,
 *     even under a parent lock. Work assigned before that (e.g. 06:00 nothing yet,
 *     homework at 06:30) brings back LOCK_P1 / LOCK_P2. When BOTH parts are empty the
 *     status is FREE_READY (locked) and nothing is frozen until the child presses
 *     "Bắt đầu giờ tự do" (/api/day/free writes both milestones and free_started_at),
 *     so free time never starts on a read the child did not ask for. A pass never
 *     freezes a part.
 * 16. Any malformed instant in the input throws; the caller should then answer with
 *     an error so the extension stays fail-closed.
 * 17. Homework groups (parent decision 17/10/2026, "kiểu C"): the parent enters only the
 *     deadline. EVERY unfinished homework is listed. "due" = overdue, today, or within
 *     homework_lookahead_days: required, counted one by one. "upcoming" = later: not
 *     required one by one, the child may do it early. On a day with NO due homework
 *     (none listed, todo or done today), the child must finish
 *     min(homework_min_upcoming, upcoming listed) upcoming items of their choice: Part 1
 *     counts that quota as `pick.needed` slots, filled by upcoming items done today.
 * 18. "★ sớm" (parent decision 17/10/2026): homework finished on a local date at least 2
 *     days before its due date. `earlyThisWeek` counts such homework done since Monday
 *     (the caller passes homework done since Monday for this). Display only: it never
 *     changes status, Part 1/2 or trust progress (no points, SPEC section 15).
 * 19. Break bank (R8b, parent decision 08/11/2026, gold examples G1-G18 in
 *     docs/superpowers/specs/2026-11-09-r8-design.md). All on the server clock, clipped to today
 *     (00:00-24:00 VN):
 *     - Focus = the union (overlaps once) of today's counted run intervals [started_at,
 *       done_at ?? now]: homework (the listed item's run; done_at falls back to the homework's
 *       done_at), template required runs and "Làm thêm" runs (an ignored double start never
 *       counts). NOT focus: inside a break [started_at, min(ended_at, started_at + planned,
 *       free_started_at)], from free_started_at on, under a parent OPEN override (each override is
 *       in effect from its created_at until its `until` or the next newer override), the whole day
 *       while trust mode is on or the day is sick, and, in lock mode, the part of today before
 *       trust_state.since when the mode was changed today (it may have been trust then; the
 *       history is not stored, so this excludes more, never less). Time under a parent LOCK override counts. Limitation: a day
 *       that WAS sick and is normal again is not excluded (day_type has no history).
 *     - Block = focus since the start of the latest break (or 00:00). Each block earns
 *       `earnBreak(floor(block minutes), break_tiers)`: the break minutes of the highest tier with
 *       focusMinutes <= F; from the top tier on, the rest earns again as a new block.
 *     - Bank = all blocks' earnings - minutes used in every break (floor((min(ended_at,
 *       started_at + planned, free_started_at, now) - started_at) / 1'), at least 0), never < 0.
 *     - break_tiers that are not 1-8 strictly ascending [focus, break] pairs of positive
 *       integers fall back to DEFAULT_BREAK_TIERS; a break_max_per_day outside 0-12 to 6.
 *     - Legacy: day_sessions.break_started_at counts as one break of break_minutes from then
 *       (ended at break_ended_at); break_skipped alone counts as one taken break that used
 *       break_minutes. The spec says "with no day_breaks rows"; it is counted even when rows exist
 *       (the new route never writes these columns, so it is a different break, and dropping it
 *       would give its minutes back).
 *     - Free time = free_minutes + the bank at free_started_at (computed from data up to that
 *       instant, so every read agrees); `break.bankMinutes` is 0 from then on (it moved to
 *       `free.bonusMinutes`).
 */

import { addDays, atLocalTime, isoWeekday, localDate, nextMidnight, startOfLocalDay, weekStart } from "./time";

const startOfLocalDayMs = (date: string): number => startOfLocalDay(date).getTime();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Status =
  | "LOCK_P1"
  | "BREAK"
  | "LOCK_P2"
  | "FREE_READY"
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
  /** Interpretation 17: upcoming items required on a day with no due homework (0 = off). */
  homeworkMinUpcoming: number;
  /** R8b (0014): `[focusMinutes, breakMinutes]` pairs (jsonb). Malformed or absent -> DEFAULT_BREAK_TIERS. */
  breakTiers?: unknown;
  /** R8b (0014): breaks per day. Absent or outside 0-12 -> DEFAULT_BREAK_MAX_PER_DAY. */
  breakMaxPerDay?: number;
}

/** A day_breaks row (R8b, 0014). */
export interface BreakRowInput {
  id: string;
  localDate: string;
  startedAt: string;
  plannedMinutes: number;
  endedAt: string | null;
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
  /**
   * trust_state.since when the mode was last CHANGED (R8b focus, rule 19); null / absent when unknown
   * or never changed (the loader passes it only when since > created_at).
   */
  trustSince?: string | null;
  /** day_sessions rows: today (if it exists) + history. */
  sessions: DaySessionInput[];
  homework: HomeworkItemInput[];
  templates: TaskTemplateInput[];
  appSlots: AppSlotInput[];
  runs: TaskRunInput[];
  overrides: OverrideInput[];
  /**
   * R8b: day_breaks rows (any dates; only today's are used). null = the table does not exist yet
   * (before migration 0014): the old single-break rule applies (interpretation 2).
   */
  breaks: BreakRowInput[] | null;
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
  /**
   * R6a: which app the link opens ("Khan Academy"): the app slot's label, else the link's site
   * ("khanacademy.org"). null without a link. Display only.
   */
  appLabel: string | null;
  /** Homework created after part1_done_at: shown, does not re-lock the day. */
  addedAfterPart1Done: boolean;
  /** Homework only (interpretation 17): 'due' is required, 'upcoming' can be done early. */
  group: "due" | "upcoming" | null;
  /** Homework finished >= 2 days before its due date (interpretation 18). */
  early: boolean;
  state: "todo" | "running" | "done" | "placeholder";
  /**
   * R8a (interpretation 10): minutes worked on this task today (required run + extra runs, a
   * running run up to now, server clock, floored). Display only.
   */
  todayMinutes: number;
  /** R8a: today's counted runs that have started (required + extra). Display only. */
  sessions: number;
  /** R8a: the running "Làm thêm" run of a done template, else null. Never changes `state`. */
  extra: { runId: string; startedAt: string } | null;
}

/** Interpretation 17: the "choose upcoming homework" quota of a day with no due homework. */
export interface PickView {
  /** Upcoming items that must be finished today (0 when there is due homework). */
  needed: number;
  /** Upcoming items finished today (may exceed `needed`). */
  done: number;
}

export interface PartView {
  /** Counted tasks (placeholders excluded). */
  total: number;
  done: number;
  /** The part is done: its milestone is set, or it has no task (empty part, interpretation 15). */
  complete: boolean;
  doneAt: string | null;
  items: TaskView[];
}

export interface BreakView {
  /** 'offer' = the child may start the break right now (same as canStart). */
  state: "not_yet" | "offer" | "running" | "done" | "skipped";
  /** Interpretation 2: the break button is shown and /api/day/break start is allowed. */
  canStart: boolean;
  /** The latest break's start (today). */
  startedAt: string | null;
  /** The latest break's started_at + planned minutes, clipped at 00:00. */
  endsAt: string | null;
  /** true before migration 0014: the old single break of break_minutes (no bank). */
  legacy: boolean;
  /** R8b: break minutes the child may take now (rule 19). 0 once free time started (see free.bonusMinutes). */
  bankMinutes: number;
  /** R8b: focus minutes of the current block (since the latest break started). */
  blockFocusMinutes: number;
  /** R8b: the next step of the current block: at `atFocus` block minutes the bank becomes `minutes`. */
  nextTier: { atFocus: number; minutes: number } | null;
  /** Breaks taken today (a legacy break counts as one). */
  takenToday: number;
  /** break_max_per_day (1 before 0014). */
  maxPerDay: number;
  /** Minutes planned for the running break, else null. */
  plannedMinutes: number | null;
}

export interface FreeView {
  /** Empty day (both parts have no task): the child may press "Bắt đầu giờ tự do". */
  canStart: boolean;
  startedAt: string | null;
  /** free_started_at + free_minutes + bonusMinutes, clipped at 00:00. */
  endsAt: string | null;
  /**
   * R8b: unused break minutes added to free time: the bank at free_started_at once free time has
   * started, before that the current bank (what would be added now). 0 before 0014.
   */
  bonusMinutes: number;
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
  part1: PartView & { pick: PickView };
  part2: PartView;
  break: BreakView;
  free: FreeView;
  passAvailable: boolean;
  passesLeft: number;
  week: { date: string; result: WeekResult }[];
  /** Homework finished early (>= 2 days before due) since Monday. Display only. */
  earlyThisWeek: number;
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

/** R8a: the runs of one template today (interpretation 10). */
interface TemplateRuns {
  /** The required run: the earliest finished one, else the latest started (as pickRun). */
  run: TaskRunInput | null;
  /** The running extra run of a done template. */
  extra: TaskRunInput | null;
  /** Runs counted in todayMinutes / sessions. */
  counted: TaskRunInput[];
}

function templateRuns(runs: TaskRunInput[]): TemplateRuns {
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
    return { run, extra: null, counted: run?.startedAt ? [run] : [] };
  }
  const later = runs.filter((r) => r !== required && r.startedAt !== null && toMs(r.startedAt, "task_runs.started_at") >= requiredDone);
  const finished = later.filter((r) => r.doneAt !== null);
  const extra = pickRun(later.filter((r) => r.doneAt === null));
  return { run: required, extra, counted: [required, ...finished, ...(extra ? [extra] : [])].filter((r) => r.startedAt !== null) };
}

/** R8a: whole minutes worked in these runs (a running run counts up to now). */
function workedMinutes(runs: TaskRunInput[], nowMs: number, fallbackDoneAt: string | null = null): number {
  let ms = 0;
  for (const r of runs) {
    if (r.startedAt === null) continue;
    const end = toMsOrNull(r.doneAt ?? fallbackDoneAt, "task_runs.done_at") ?? nowMs;
    ms += Math.max(0, end - toMs(r.startedAt, "task_runs.started_at"));
  }
  return Math.floor(ms / MINUTE_MS);
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
  nowMs: number,
  focusRuns: FocusRun[],
): TaskView[] {
  const slots = new Map(input.appSlots.map((s) => [s.id, s]));
  const fallbackMin = part === "extra" ? input.settings.extraMinMinutes : input.settings.skillMinMinutes;
  return input.templates
    .filter((t) => t.part === part && t.active && t.weekdays.includes(weekday) && !disabled.has(t.id))
    .sort(compareTemplates)
    .map((t) => {
      const slot = t.appSlotId !== null ? slots.get(t.appSlotId) : undefined;
      const placeholder = slot?.kind === "placeholder";
      const runs = placeholder
        ? { run: null, extra: null, counted: [] }
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
function isEarly(h: HomeworkItemInput): boolean {
  if (h.doneAt === null) return false;
  return localDate(new Date(toMs(h.doneAt, "homework_items.done_at"))) <= addDays(h.dueDate, -2);
}

function homeworkViews(input: DayInput, today: string, runsToday: TaskRunInput[], nowMs: number, focusRuns: FocusRun[]): TaskView[] {
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

function countPart(items: TaskView[]): { total: number; done: number } {
  const counted = items.filter((i) => !i.placeholder && i.group !== "upcoming");
  return { total: counted.length, done: counted.filter((i) => i.doneAt !== null).length };
}

/** Interpretation 17: quota of upcoming homework on a day with no due homework. */
function pickQuota(items: TaskView[], minUpcoming: number): PickView {
  const upcoming = items.filter((i) => i.group === "upcoming");
  const done = upcoming.filter((i) => i.doneAt !== null).length;
  const anyDue = items.some((i) => i.group === "due");
  return { needed: anyDue ? 0 : Math.min(Math.max(0, minUpcoming), upcoming.length), done };
}

/** "Ngày đạt" for a day_sessions row (DESIGN section 5). */
export function isDayOk(s: DaySessionInput, bedtime: string): boolean {
  if (s.dayType === "sick" || s.dayType === "holiday") return true;
  if (s.passUsedAt !== null) return true;
  // Interpretation 7 (R1): both parts done before bedtime (they may finish in any order).
  if (s.part1DoneAt === null || s.part2DoneAt === null) return false;
  const bed = atLocalTime(s.localDate, bedtime).getTime();
  return toMs(s.part1DoneAt, "day_sessions.part1_done_at") < bed && toMs(s.part2DoneAt, "day_sessions.part2_done_at") < bed;
}

function weekResult(s: DaySessionInput | undefined, bedtime: string, isToday: boolean): WeekResult {
  if (s !== undefined) {
    if (s.dayType === "sick") return "sick";
    if (s.passUsedAt !== null) return "pass";
    if (isDayOk(s, bedtime)) return "ok";
  }
  return isToday ? "today" : "miss";
}

/** R6a: the app's name for a link: the slot label, else the site without "www." (null without a link). */
function hostOf(url: string): string | null {
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

/**
 * The newest override of today (by created_at; on a tie the lock wins) SUPERSEDES all
 * older ones (parent decision 14/10/2026). It is in effect only while `until` > now;
 * once it expires the day returns to the normal flow, never to an older override.
 */
function pickOverride(overrides: OverrideInput[], today: string, nowMs: number): OverrideInput | null {
  let newest: OverrideInput | null = null;
  let newestCreated = -Infinity;
  for (const o of overrides) {
    if (o.localDate !== today) continue;
    const created = toMs(o.createdAt, "overrides.created_at");
    toMs(o.until, "overrides.until"); // validate every row (malformed input throws)
    if (newest === null || created > newestCreated || (created === newestCreated && o.kind === "lock_until")) {
      newest = o;
      newestCreated = created;
    }
  }
  if (newest === null) return null;
  return toMs(newest.until, "overrides.until") > nowMs ? newest : null;
}

// ---------------------------------------------------------------------------
// Break bank (R8b, interpretation 19). Pure, exported for tests.
// ---------------------------------------------------------------------------

/** `[focusMinutes, breakMinutes]`: from `focusMinutes` of focus in one block, `breakMinutes` of break. */
export type BreakTier = readonly [number, number];

/** family_settings.break_tiers default (0014). */
export const DEFAULT_BREAK_TIERS: readonly BreakTier[] = [
  [45, 10],
  [90, 30],
  [120, 45],
  [180, 60],
];
/** family_settings.break_max_per_day default (0014). */
export const DEFAULT_BREAK_MAX_PER_DAY = 6;
/** A break may start only with at least this many minutes in the bank (rule 1). */
export const MIN_BREAK_MINUTES = 5;
/** At most this many tiers are accepted. */
export const MAX_BREAK_TIERS = 8;

/** 1-8 pairs of positive integers (<= 1440), both columns strictly ascending. */
export function validBreakTiers(value: unknown): value is BreakTier[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BREAK_TIERS) return false;
  let prevFocus = 0;
  let prevBreak = 0;
  for (const t of value) {
    if (!Array.isArray(t) || t.length !== 2) return false;
    const [f, b] = t as unknown[];
    if (!Number.isInteger(f) || !Number.isInteger(b)) return false;
    const fi = f as number;
    const bi = b as number;
    if (fi <= prevFocus || bi <= prevBreak || fi > 1440 || bi > 1440) return false;
    prevFocus = fi;
    prevBreak = bi;
  }
  return true;
}

/** The tiers to use: `value` when valid, else the defaults (malformed data never crashes the day). */
export function breakTiersOf(value: unknown): readonly BreakTier[] {
  return validBreakTiers(value) ? value : DEFAULT_BREAK_TIERS;
}

function breakMaxOf(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 12 ? (value as number) : DEFAULT_BREAK_MAX_PER_DAY;
}

/**
 * Break minutes earned by `focusMinutes` of focus in ONE block: the highest tier with
 * focusMinutes <= F; from the top tier on, the rest counts again as a new block
 * (default tiers: 44 -> 0, 45 -> 10, 90 -> 30, 180 -> 60, 225 -> 70, 360 -> 120).
 */
export function earnBreak(focusMinutes: number, tiers: unknown = DEFAULT_BREAK_TIERS): number {
  if (!Number.isFinite(focusMinutes) || focusMinutes <= 0) return 0;
  const t = breakTiersOf(tiers);
  const [topFocus, topBreak] = t[t.length - 1] as BreakTier;
  let rest = Math.floor(focusMinutes);
  let earned = Math.floor(rest / topFocus) * topBreak;
  rest %= topFocus;
  for (let i = t.length - 1; i >= 0; i--) {
    const [f, b] = t[i] as BreakTier;
    if (f <= rest) {
      earned += b;
      break;
    }
  }
  return earned;
}

/** A half-open interval [start, end) in ms. */
export type Interval = readonly [number, number];

/** Sorted, merged, non-empty intervals. */
function unionOf(list: readonly Interval[]): Interval[] {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

function lengthWithin(list: readonly Interval[], lo: number, hi: number): number {
  let ms = 0;
  for (const [a, b] of list) ms += Math.max(0, Math.min(b, hi) - Math.max(a, lo));
  return ms;
}

/**
 * Focus (rule 19): the union of the run intervals, clipped to [dayStartMs, untilMs), minus the
 * union of the excluded intervals. Overlapping runs count once.
 */
export function focusIntervals(runs: readonly Interval[], excluded: readonly Interval[], dayStartMs: number, untilMs: number): Interval[] {
  const base = unionOf(runs.map(([a, b]): Interval => [Math.max(a, dayStartMs), Math.min(b, untilMs)]));
  const cut = unionOf(excluded);
  const out: Interval[] = [];
  for (const [a, b] of base) {
    let start = a;
    for (const [x, y] of cut) {
      if (y <= start || x >= b) continue;
      if (x > start) out.push([start, x]);
      start = Math.max(start, y);
      if (start >= b) break;
    }
    if (start < b) out.push([start, b]);
  }
  return out;
}

/** A break for the bank: its start and the instant it really ended (ended_at, planned end, free time). */
export interface BankBreak {
  startMs: number;
  endMs: number;
}

export interface BankResult {
  /** max(0, earned - used). */
  bankMinutes: number;
  /** Earned by every block (closed ones + the current one). */
  earnedMinutes: number;
  /** Used in the breaks started up to `atMs`. */
  usedMinutes: number;
  /** Focus minutes of the current block (since the latest break started). */
  blockFocusMinutes: number;
}

/**
 * The bank at `atMs` (rule 19): breaks started up to `atMs` close the blocks; each block earns
 * earnBreak(floor(its focus minutes)); each break used floor((min(endMs, atMs) - startMs) / 1').
 * `extraUsedMinutes` = a legacy break_skipped with no start.
 */
export function breakBank(focus: readonly Interval[], breaks: readonly BankBreak[], tiers: unknown, dayStartMs: number, atMs: number, extraUsedMinutes = 0): BankResult {
  const started = breaks.filter((b) => b.startMs <= atMs).sort((x, y) => x.startMs - y.startMs);
  let earned = 0;
  let used = extraUsedMinutes;
  let from = dayStartMs;
  for (const b of started) {
    earned += earnBreak(Math.floor(lengthWithin(focus, from, b.startMs) / MINUTE_MS), tiers);
    used += Math.max(0, Math.floor((Math.min(b.endMs, atMs) - b.startMs) / MINUTE_MS));
    from = Math.max(from, b.startMs);
  }
  const block = Math.floor(lengthWithin(focus, from, atMs) / MINUTE_MS);
  earned += earnBreak(block, tiers);
  return { bankMinutes: Math.max(0, earned - used), earnedMinutes: earned, usedMinutes: used, blockFocusMinutes: block };
}

/** The next block length (> blockMinutes) that earns more, and the bank then; null if none in a day. */
function nextTierOf(blockMinutes: number, rawBankMinutes: number, tiers: unknown): { atFocus: number; minutes: number } | null {
  const now = earnBreak(blockMinutes, tiers);
  for (let f = blockMinutes + 1; f <= blockMinutes + 1440; f++) {
    const e = earnBreak(f, tiers);
    if (e > now) return { atFocus: f, minutes: Math.max(0, rawBankMinutes + e - now) };
  }
  return null;
}

/**
 * Parent OPEN override windows of today: each override is in effect from its created_at until its
 * `until` or the next newer override (on a tie the lock wins, as pickOverride), clipped at 00:00.
 */
function openOverrideIntervals(overrides: OverrideInput[], today: string, midnightMs: number): Interval[] {
  const rows = overrides
    .filter((o) => o.localDate === today)
    .map((o) => ({ kind: o.kind, created: toMs(o.createdAt, "overrides.created_at"), until: toMs(o.until, "overrides.until") }))
    .sort((a, b) => a.created - b.created || (a.kind === b.kind ? 0 : a.kind === "open_until" ? -1 : 1));
  const out: Interval[] = [];
  rows.forEach((o, i) => {
    if (o.kind !== "open_until") return;
    const next = rows[i + 1];
    out.push([o.created, Math.min(o.until, next ? next.created : Infinity, midnightMs)]);
  });
  return out;
}

interface FocusRun {
  startMs: number;
  /** null while running. */
  endMs: number | null;
}

function focusRun(startedAt: string | null, doneAt: string | null): FocusRun {
  return {
    startMs: startedAt === null ? NaN : toMs(startedAt, "task_runs.started_at"),
    endMs: toMsOrNull(doneAt, "task_runs.done_at"),
  };
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

  // R8b: the runs that count as focus (interpretation 19), collected while listing the tasks.
  const focusRuns: FocusRun[] = [];

  // --- Part 1: due homework + extra templates of today + upcoming homework (17) ---
  const homework = homeworkViews(input, today, runsToday, nowMs, focusRuns);
  const part1Items = [
    ...homework.filter((i) => i.group === "due"),
    ...templateViews(input, "extra", weekday, disabled, runsToday, nowMs, focusRuns),
    ...homework.filter((i) => i.group === "upcoming"),
  ];
  const pick = pickQuota(part1Items, settings.homeworkMinUpcoming);
  const counted = countPart(part1Items);
  const part1Count = { total: counted.total + pick.needed, done: counted.done + Math.min(pick.done, pick.needed) };
  const part1Empty = part1Count.total === 0;

  // --- Part 2: skill templates of today. Open in parallel with Part 1 (R1, 07/11/2026) ---
  const part2Items = templateViews(input, "skill", weekday, disabled, runsToday, nowMs, focusRuns);
  const part2Count = countPart(part2Items);
  const part2Empty = part2Count.total === 0;

  // A part with tasks is done once all of them are (any order, interpretation 1).
  if (session.part1DoneAt === null && !part1Empty && part1Count.done === part1Count.total) {
    session.part1DoneAt = nowIso;
    milestones.part1DoneAt = nowIso;
  }
  if (session.part2DoneAt === null && !part2Empty && part2Count.done === part2Count.total) {
    session.part2DoneAt = nowIso;
    milestones.part2DoneAt = nowIso;
  }
  // Interpretation 15 (revised R1): an EMPTY part is frozen as done only once the OTHER part
  // has a milestone, even while a parent lock is in effect (so "ngày đạt" is not delayed by the
  // lock). When BOTH parts are empty nothing is frozen: the child presses "Bắt đầu giờ tự do"
  // (route /api/day/free writes the three milestones), so free time never starts on a read
  // nobody asked for (e.g. the extension polling at 00:00). A pass never freezes a part.
  const part1Ready = session.part1DoneAt !== null || part1Empty;
  const part2Ready = session.part2DoneAt !== null || part2Empty;
  if (part1Ready && part2Ready && (session.part1DoneAt !== null || session.part2DoneAt !== null)) {
    if (session.part1DoneAt === null) {
      session.part1DoneAt = nowIso;
      milestones.part1DoneAt = nowIso;
    }
    if (session.part2DoneAt === null) {
      session.part2DoneAt = nowIso;
      milestones.part2DoneAt = nowIso;
    }
  }
  const part1Done = part1Ready;
  const part2Done = part2Ready;
  const bothDone = session.part1DoneAt !== null && session.part2DoneAt !== null;
  const emptyDay = part1Ready && part2Ready && !bothDone; // both parts empty, not started

  const part1DoneMs = toMsOrNull(session.part1DoneAt, "day_sessions.part1_done_at");
  if (part1DoneMs !== null) {
    const created = new Map(input.homework.map((h) => [h.id, h.createdAt]));
    for (const item of part1Items) {
      if (item.source !== "homework") continue;
      const c = created.get(item.id);
      item.addedAfterPart1Done = c !== undefined && toMs(c, "homework_items.created_at") > part1DoneMs;
    }
  }

  // --- Overrides: the NEWEST override of today supersedes all older ones ---
  const override = pickOverride(input.overrides, today, nowMs);

  // Free time starts once BOTH parts are done (once per day). Parent decision 14/10/2026:
  // while a parent LOCK override is in effect, free time is deferred and starts at the
  // first read after the lock ends (still clipped at 00:00).
  if (bothDone && session.freeStartedAt === null && override?.kind !== "lock_until") {
    session.freeStartedAt = nowIso;
    milestones.freeStartedAt = nowIso;
  }

  // --- Breaks of today (interpretations 2 and 19) ---
  const freeStartMs = toMsOrNull(session.freeStartedAt, "day_sessions.free_started_at");
  const dayStartMs = startOfLocalDayMs(today);
  const bankMode = input.breaks !== null;
  const tiers = breakTiersOf(settings.breakTiers);
  const maxPerDay = bankMode ? breakMaxOf(settings.breakMaxPerDay) : 1;
  const dayBreaks: { startMs: number; plannedMinutes: number; endedMs: number | null }[] = [];
  for (const b of input.breaks ?? []) {
    // Validate every row (malformed input throws, interpretation 16).
    const startMs = toMs(b.startedAt, "day_breaks.started_at");
    const endedMs = toMsOrNull(b.endedAt, "day_breaks.ended_at");
    if (!Number.isInteger(b.plannedMinutes) || b.plannedMinutes <= 0) {
      throw new Error(`computeDayState: invalid day_breaks.planned_minutes: ${b.plannedMinutes}`);
    }
    if (b.localDate === today) dayBreaks.push({ startMs, plannedMinutes: b.plannedMinutes, endedMs });
  }
  // Legacy: the day_sessions break of break_minutes (before 0014 the only one; after it, a day in
  // flight). The new route never writes these columns, so it is never the same break as a
  // day_breaks row and is always counted (never dropped once a day_breaks row exists, which would
  // give its minutes back). break_skipped alone = a taken break that used break_minutes.
  const legacyStartMs = toMsOrNull(session.breakStartedAt, "day_sessions.break_started_at");
  const legacyEndedMs = toMsOrNull(session.breakEndedAt, "day_sessions.break_ended_at");
  const legacySkipped = session.breakSkipped && legacyStartMs === null;
  if (legacyStartMs !== null) dayBreaks.push({ startMs: legacyStartMs, plannedMinutes: Math.max(0, settings.breakMinutes), endedMs: legacyEndedMs });
  const legacySkippedMinutes = legacySkipped ? Math.max(0, settings.breakMinutes) : 0;
  dayBreaks.sort((a, b) => a.startMs - b.startMs);
  const takenToday = dayBreaks.length + (legacySkipped ? 1 : 0);
  /** When a break really ended: "Học tiếp", its planned end, free time starting, or 00:00. */
  const realEnd = (b: (typeof dayBreaks)[number]) =>
    Math.min(b.endedMs ?? Infinity, b.startMs + b.plannedMinutes * MINUTE_MS, freeStartMs ?? Infinity, midnightMs);

  // --- Focus and the bank (interpretation 19) ---
  let bank: BankResult | null = null;
  if (bankMode) {
    const excluded: Interval[] = dayBreaks.map((b): Interval => [b.startMs, realEnd(b)]);
    if (freeStartMs !== null) excluded.push([freeStartMs, Infinity]);
    excluded.push(...openOverrideIntervals(input.overrides, today, midnightMs));
    if (input.trustMode === "trust" || session.dayType === "sick") {
      excluded.push([dayStartMs, Infinity]);
    } else {
      const since = toMsOrNull(input.trustSince ?? null, "trust_state.since");
      if (since !== null && since > dayStartMs) excluded.push([dayStartMs, since]);
    }
    const runIntervals = focusRuns.filter((r) => Number.isFinite(r.startMs)).map((r): Interval => [r.startMs, r.endMs ?? nowMs]);
    const focus = focusIntervals(runIntervals, excluded, dayStartMs, Math.min(nowMs, midnightMs));
    bank = breakBank(
      focus,
      dayBreaks.map((b) => ({ startMs: b.startMs, endMs: realEnd(b) })),
      tiers,
      dayStartMs,
      freeStartMs ?? nowMs,
      legacySkippedMinutes,
    );
  }
  const bonusMinutes = bank?.bankMinutes ?? 0;

  // --- Free time: free_minutes + the bank at free_started_at (R8b) ---
  const freeEndMs = freeStartMs === null ? null : freeStartMs + (settings.freeMinutes + bonusMinutes) * MINUTE_MS;

  // --- The running break (row 7): only the latest one can run ---
  const latestBreak = dayBreaks[dayBreaks.length - 1];
  const breakEndMs = latestBreak === undefined ? null : latestBreak.startMs + latestBreak.plannedMinutes * MINUTE_MS;
  const breakRunning =
    latestBreak !== undefined &&
    latestBreak.endedMs === null &&
    latestBreak.startMs <= nowMs &&
    nowMs < (breakEndMs as number) &&
    freeStartMs === null;

  // --- Status: DESIGN section 5 priority table, top-down, first match wins ---
  let status: Status;
  let openUntilMs: number | null = null;
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
  } else if (breakRunning) {
    status = "BREAK"; // row 7
    openUntilMs = breakEndMs;
  } else if (!part1Done) {
    status = "LOCK_P1"; // row 8
  } else if (!part2Done) {
    status = "LOCK_P2"; // row 9
  } else {
    status = "FREE_READY"; // row 10: empty day, waiting for "Bắt đầu giờ tự do"
  }
  if (openUntilMs !== null) openUntilMs = Math.min(openUntilMs, midnightMs);
  const open = openUntilMs !== null;

  // R8a: a running "Làm thêm" run counts as timed too (no break while it runs).
  const timedRunning = [...part1Items, ...part2Items].some(
    (i) => (i.state === "running" && i.source === "template" && i.minMinutes > 0) || i.extra !== null,
  );
  const lockedStatus = status === "LOCK_P1" || status === "LOCK_P2" || status === "FREE_READY";
  let breakCanStart: boolean;
  let breakState: BreakView["state"];
  if (bank !== null) {
    // R8b rule 1: the bank decides; no "part done" condition any more (parent 08/11/2026).
    breakCanStart =
      bank.bankMinutes >= MIN_BREAK_MINUTES && takenToday < maxPerDay && session.freeStartedAt === null && lockedStatus && !timedRunning;
    if (breakRunning) breakState = "running";
    else if (breakCanStart) breakState = "offer";
    else breakState = takenToday > 0 && takenToday >= maxPerDay ? "done" : "not_yet";
  } else {
    // Before 0014 (legacy, interpretation 2): once a day, after a part is done. Part 1 done (an
    // empty Part 1 counts, E5d) or Part 2 really finished; an empty Part 2 alone does not count.
    const breakTaken = session.breakSkipped || legacyStartMs !== null;
    const partDoneForBreak = part1Done || session.part2DoneAt !== null;
    breakCanStart =
      !breakTaken && settings.breakMinutes > 0 && session.freeStartedAt === null && partDoneForBreak && lockedStatus && !timedRunning;
    if (legacyStartMs !== null) breakState = breakRunning ? "running" : "done";
    else if (session.breakSkipped) breakState = "skipped";
    else breakState = breakCanStart ? "offer" : "not_yet";
  }
  // The "học thêm N' nữa" hint: only while focus can still earn a break today.
  const earning = status === "LOCK_P1" || status === "LOCK_P2" || status === "FREE_READY" || status === "LOCK_OVERRIDE";
  const nextTier =
    bank !== null && earning && session.freeStartedAt === null && !breakRunning && takenToday < maxPerDay
      ? nextTierOf(bank.blockFocusMinutes, bank.earnedMinutes - bank.usedMinutes, tiers)
      : null;
  // Only where it means something: the locked empty day, or trust mode (to mark the day). Not
  // during a parent lock / open window or a sick day (it would spend the day's 45' for nothing).
  const freeCanStart = emptyDay && session.freeStartedAt === null && (status === "FREE_READY" || status === "OPEN_TRUST");

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

  const mondayMs = startOfLocalDayMs(monday);
  const earlyThisWeek = input.homework.filter(
    (h) => h.archivedAt === null && isEarly(h) && toMs(h.doneAt as string, "homework_items.done_at") >= mondayMs,
  ).length;

  return {
    status,
    open,
    openUntil: openUntilMs === null ? null : iso(openUntilMs),
    localDate: today,
    dayType: session.dayType,
    part1: { ...part1Count, complete: part1Done, doneAt: session.part1DoneAt, items: part1Items, pick },
    part2: {
      ...part2Count,
      complete: part2Done,
      doneAt: session.part2DoneAt,
      items: part2Items,
    },
    break: {
      state: breakState,
      canStart: breakCanStart,
      startedAt: latestBreak === undefined ? null : iso(latestBreak.startMs),
      endsAt: breakEndMs === null ? null : iso(Math.min(breakEndMs, midnightMs)),
      legacy: !bankMode,
      bankMinutes: bank === null || session.freeStartedAt !== null ? 0 : bank.bankMinutes,
      blockFocusMinutes: bank?.blockFocusMinutes ?? 0,
      nextTier,
      takenToday,
      maxPerDay,
      plannedMinutes: breakRunning && latestBreak !== undefined ? latestBreak.plannedMinutes : null,
    },
    free: {
      canStart: freeCanStart,
      startedAt: session.freeStartedAt,
      endsAt: freeEndMs === null ? null : iso(Math.min(freeEndMs, midnightMs)),
      bonusMinutes,
    },
    passAvailable,
    passesLeft,
    week,
    earlyThisWeek,
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
