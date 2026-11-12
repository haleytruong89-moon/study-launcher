/** Input and output types of computeDayState (see the rules in lib/dayState.ts). */

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
  /** R8b (0014, parent 09/11): one finished run adds at most this much focus. Absent or outside 30-600 -> 180. */
  breakRunCapMinutes?: number;
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
