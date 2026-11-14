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
 *     = bank); BREAK (row 7) is open until started_at + planned_minutes (clipped at 00:00),
 *     "Học tiếp" (ended_at) or a parent LOCK override created during it (09/11/2026: the break ends
 *     then and does not resume after the lock). A homework run may keep running during a break.
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
 * 19. Break bank (R8b, parent decisions 08/11 and 09/11/2026, gold examples G1-G21 in
 *     docs/superpowers/specs/2026-11-09-r8-design.md). All on the server clock, clipped to today
 *     (00:00-24:00 VN):
 *     - Focus = the union (overlaps once) of today's FINISHED counted run intervals [started_at,
 *       min(done_at, started_at + break_run_cap_minutes)] (09/11: a running or forgotten run adds
 *       nothing until it is finished; one run adds at most 180' by default): homework (the listed
 *       item's run; done_at falls back to the homework's done_at), template required runs and
 *       "Làm thêm" runs (an ignored double start never counts). Finishing a run later may add
 *       earnings to the block(s) its interval falls in, deterministically from the data. NOT focus:
 *       inside a break [started_at, its real end (below)], from free_started_at on, under a parent OPEN override (each override is
 *       in effect from its created_at until its `until` or the next newer override), the whole day
 *       while trust mode is on or the day is sick, and, in lock mode, the part of today before
 *       trust_state.since when the mode was changed today (it may have been trust then; the
 *       history is not stored, so this excludes more, never less). Time under a parent LOCK override counts. Limitation: a day
 *       that WAS sick and is normal again is not excluded (day_type has no history).
 *     - Block = focus since the start of the latest break (or 00:00). Each block earns
 *       `earnBreak(floor(block minutes), break_tiers)`: the break minutes of the highest tier with
 *       focusMinutes <= F; from the top tier on, the rest earns again as a new block.
 *     - A break's real end = min(ended_at, started_at + planned, free_started_at, 00:00, the
 *       created_at of the first parent LOCK override created after it started (09/11: the lock
 *       ends the break for good; the unused minutes go back to the bank)).
 *     - Bank = all blocks' earnings - minutes used in every break (floor((min(real end, now) -
 *       started_at) / 1'), at least 0), never < 0.
 *     - break_tiers that are not 1-8 strictly ascending [focus, break] pairs of positive
 *       integers fall back to DEFAULT_BREAK_TIERS; a break_max_per_day outside 0-12 to 6; a
 *       break_run_cap_minutes outside 30-600 to 180.
 *     - Legacy: day_sessions.break_started_at counts as one break of break_minutes from then
 *       (ended at break_ended_at); break_skipped alone counts as one taken break that used
 *       break_minutes. The spec says "with no day_breaks rows"; it is counted even when rows exist
 *       (the new route never writes these columns, so it is a different break, and dropping it
 *       would give its minutes back).
 *     - Free time = free_minutes + the bank at free_started_at (computed from data up to that
 *       instant, so every read agrees); `break.bankMinutes` is 0 from then on (it moved to
 *       `free.bonusMinutes`).
 */

// The code lives in lib/dayState/ (split 12/11/2026, no behaviour change): types.ts, instants.ts,
// runs.ts, tasks.ts, week.ts, overrides.ts, breakBank.ts, compute.ts. This file is the public
// entry: import from "@/lib/dayState" only.

export type {
  AppSlotInput,
  BreakRowInput,
  BreakView,
  DayInput,
  DayMilestones,
  DaySessionInput,
  DayState,
  DayType,
  FamilySettingsInput,
  FreeView,
  HomeworkItemInput,
  OverrideInput,
  PartView,
  PickView,
  Status,
  TaskRunInput,
  TaskTemplateInput,
  TaskView,
  TrustMode,
  TrustView,
  WeekResult,
} from "./dayState/types";
export { splitTemplateRuns } from "./dayState/runs";
export { appLabelOf, scheduledTemplates } from "./dayState/tasks";
export { isDayOk } from "./dayState/week";
export type { BankBreak, BankResult, BreakTier, Interval } from "./dayState/breakBank";
export {
  breakBank,
  breakTiersOf,
  DEFAULT_BREAK_MAX_PER_DAY,
  DEFAULT_BREAK_RUN_CAP_MINUTES,
  DEFAULT_BREAK_TIERS,
  earnBreak,
  focusIntervals,
  MAX_BREAK_TIERS,
  MIN_BREAK_MINUTES,
  validBreakTiers,
} from "./dayState/breakBank";
export { computeDayState } from "./dayState/compute";
