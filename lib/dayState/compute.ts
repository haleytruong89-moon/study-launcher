/** computeDayState: the status machine of DESIGN section 5 (rules in lib/dayState.ts). */

import { addDays, isoWeekday, localDate, nextMidnight, weekStart } from "../time";
import { breakBank, breakMaxOf, breakRunCapOf, breakTiersOf, focusIntervals, MIN_BREAK_MINUTES, nextTierOf, type BankResult, type Interval } from "./breakBank";
import { iso, MINUTE_MS, startOfLocalDayMs, toMs, toMsOrNull } from "./instants";
import { openOverrideIntervals, pickOverride } from "./overrides";
import type { FocusRun } from "./runs";
import { countPart, homeworkViews, isEarly, pickQuota, templateViews } from "./tasks";
import type { BreakView, DayInput, DayMilestones, DaySessionInput, DayState, Status } from "./types";
import { emptySession, isDayOk, weekResult } from "./week";

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
  const allBreaks: { startMs: number; plannedMinutes: number; endedMs: number | null }[] = [];
  for (const b of input.breaks ?? []) {
    // Validate every row (malformed input throws, interpretation 16).
    const startMs = toMs(b.startedAt, "day_breaks.started_at");
    const endedMs = toMsOrNull(b.endedAt, "day_breaks.ended_at");
    if (!Number.isInteger(b.plannedMinutes) || b.plannedMinutes <= 0) {
      throw new Error(`computeDayState: invalid day_breaks.planned_minutes: ${b.plannedMinutes}`);
    }
    if (b.localDate === today) allBreaks.push({ startMs, plannedMinutes: b.plannedMinutes, endedMs });
  }
  // Legacy: the day_sessions break of break_minutes (before 0014 the only one; after it, a day in
  // flight). The new route never writes these columns, so it is never the same break as a
  // day_breaks row and is always counted (never dropped once a day_breaks row exists, which would
  // give its minutes back). break_skipped alone = a taken break that used break_minutes.
  const legacyStartMs = toMsOrNull(session.breakStartedAt, "day_sessions.break_started_at");
  const legacyEndedMs = toMsOrNull(session.breakEndedAt, "day_sessions.break_ended_at");
  const legacySkipped = session.breakSkipped && legacyStartMs === null;
  if (legacyStartMs !== null) allBreaks.push({ startMs: legacyStartMs, plannedMinutes: Math.max(0, settings.breakMinutes), endedMs: legacyEndedMs });
  const legacySkippedMinutes = legacySkipped ? Math.max(0, settings.breakMinutes) : 0;
  allBreaks.sort((a, b) => a.startMs - b.startMs);
  // Parent decision 09/11/2026: a parent LOCK override created during a break ends it then (the
  // unused minutes go back to the bank). Only real locks (until > created_at) count. Before 0014 the
  // old rule is unchanged (the break resumes after the lock).
  const lockStarts = input.overrides
    .filter((o) => bankMode && o.localDate === today && o.kind === "lock_until")
    .map((o) => ({ created: toMs(o.createdAt, "overrides.created_at"), until: toMs(o.until, "overrides.until") }))
    .filter((o) => o.until > o.created)
    .map((o) => o.created)
    .sort((a, b) => a - b);
  /**
   * When a break really ended: "Học tiếp", its planned end, free time starting, 00:00, or the first
   * parent LOCK override created after it started.
   */
  const realEnd = (b: (typeof allBreaks)[number]) =>
    Math.min(
      b.endedMs ?? Infinity,
      b.startMs + b.plannedMinutes * MINUTE_MS,
      freeStartMs ?? Infinity,
      midnightMs,
      lockStarts.find((c) => c >= b.startMs) ?? Infinity,
    );
  // A break can only start while none runs (BREAK is not a locked study status), so a row that starts
  // before the previous break really ended is a duplicate of it (two "start" requests at once: a
  // double tap, two devices). It is ignored: counted once, its minutes not used twice.
  const dayBreaks: typeof allBreaks = [];
  for (const b of allBreaks) {
    const prev = dayBreaks[dayBreaks.length - 1];
    if (prev === undefined || b.startMs >= realEnd(prev)) dayBreaks.push(b);
  }
  const takenToday = dayBreaks.length + (legacySkipped ? 1 : 0);

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
    // Parent decision 09/11/2026: only FINISHED runs add focus (a running or forgotten run adds 0
    // until Xong / the photo / the parent's confirmation), each at most break_run_cap_minutes.
    const capMs = breakRunCapOf(settings.breakRunCapMinutes) * MINUTE_MS;
    const runIntervals = focusRuns
      .filter((r) => Number.isFinite(r.startMs) && r.endMs !== null)
      .map((r): Interval => [r.startMs, Math.min(r.endMs as number, r.startMs + capMs)]);
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
  // realEnd: a parent lock created during the break ends it for good (it does not resume after the lock).
  const breakRunning =
    latestBreak !== undefined &&
    latestBreak.endedMs === null &&
    latestBreak.startMs <= nowMs &&
    nowMs < realEnd(latestBreak) &&
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
