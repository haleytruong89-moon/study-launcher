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
 *  2. Break (parent decision 07/11/2026): optional, once per day, `break.canStart` when
 *     Part 1 is done (an empty Part 1 counts, E5d) or Part 2 is really done (an empty Part 2
 *     alone does not count: on a day without skills the break still follows the homework),
 *     free time has not started,
 *     break_minutes > 0, the laptop is in a locked study status (LOCK_P1 / LOCK_P2 /
 *     FREE_READY; not a parent lock, trust, sick or a parent open) and no timed task is
 *     running (so the 10' are never counted as task minutes). BREAK (row 7) is open until
 *     break_started_at + break_minutes or "Học tiếp" (break_ended_at). A legacy
 *     break_skipped = true means the break of that day is used.
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
 *     starts (FREE is above BREAK; the rest of the break is not added).
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
 * 11. Only today's task_runs are used; an unfinished run from a previous day is
 *     ignored (the child starts again).
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
  startedAt: string | null;
  /** break_started_at + break_minutes, clipped at 00:00. */
  endsAt: string | null;
}

export interface FreeView {
  /** Empty day (both parts have no task): the child may press "Bắt đầu giờ tự do". */
  canStart: boolean;
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
        appLabel: placeholder ? null : appLabelOf(t.deepLink && slot?.url && hostOf(t.deepLink) !== hostOf(slot.url) ? null : (slot?.label ?? null), t.deepLink ?? slot?.url ?? null),
        addedAfterPart1Done: false,
        group: null,
        early: false,
        state: taskState(placeholder, run, doneAt),
      } satisfies TaskView;
    });
}

/** Interpretation 18: finished on a local date at least 2 days before the due date. */
function isEarly(h: HomeworkItemInput): boolean {
  if (h.doneAt === null) return false;
  return localDate(new Date(toMs(h.doneAt, "homework_items.done_at"))) <= addDays(h.dueDate, -2);
}

function homeworkViews(input: DayInput, today: string, runsToday: TaskRunInput[]): TaskView[] {
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

  // --- Part 1: due homework + extra templates of today + upcoming homework (17) ---
  const homework = homeworkViews(input, today, runsToday);
  const part1Items = [
    ...homework.filter((i) => i.group === "due"),
    ...templateViews(input, "extra", weekday, disabled, runsToday),
    ...homework.filter((i) => i.group === "upcoming"),
  ];
  const pick = pickQuota(part1Items, settings.homeworkMinUpcoming);
  const counted = countPart(part1Items);
  const part1Count = { total: counted.total + pick.needed, done: counted.done + Math.min(pick.done, pick.needed) };
  const part1Empty = part1Count.total === 0;

  // --- Part 2: skill templates of today. Open in parallel with Part 1 (R1, 07/11/2026) ---
  const part2Items = templateViews(input, "skill", weekday, disabled, runsToday);
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

  // --- Free time ---
  const freeStartMs = toMsOrNull(session.freeStartedAt, "day_sessions.free_started_at");
  const freeEndMs = freeStartMs === null ? null : freeStartMs + settings.freeMinutes * MINUTE_MS;

  // --- Break (interpretation 2) ---
  const breakStartMs = toMsOrNull(session.breakStartedAt, "day_sessions.break_started_at");
  const breakEndMs = breakStartMs === null ? null : breakStartMs + settings.breakMinutes * MINUTE_MS;
  const breakRunning =
    breakStartMs !== null && session.breakEndedAt === null && nowMs < (breakEndMs as number) && freeStartMs === null;

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

  const timedRunning = [...part1Items, ...part2Items].some(
    (i) => i.state === "running" && i.source === "template" && i.minMinutes > 0,
  );
  const breakTaken = session.breakSkipped || breakStartMs !== null;
  const lockedStatus = status === "LOCK_P1" || status === "LOCK_P2" || status === "FREE_READY";
  // "A part is done" for the break (parent 07/11/2026): Part 1 done (an empty Part 1 counts, as
  // before R1, E5d) or Part 2 really finished. An empty Part 2 alone does not open the break:
  // on a day without skills the break still comes after the homework, as before.
  const partDoneForBreak = part1Done || session.part2DoneAt !== null;
  const breakCanStart =
    !breakTaken && settings.breakMinutes > 0 && session.freeStartedAt === null && partDoneForBreak && lockedStatus && !timedRunning;
  let breakState: BreakView["state"];
  if (breakStartMs !== null) breakState = breakRunning ? "running" : "done";
  else if (session.breakSkipped) breakState = "skipped";
  else breakState = breakCanStart ? "offer" : "not_yet";
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
      startedAt: session.breakStartedAt,
      endsAt: breakEndMs === null ? null : iso(Math.min(breakEndMs, midnightMs)),
    },
    free: {
      canStart: freeCanStart,
      startedAt: session.freeStartedAt,
      endsAt: freeEndMs === null ? null : iso(Math.min(freeEndMs, midnightMs)),
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
