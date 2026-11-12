import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppSlotInput,
  BreakRowInput,
  DayInput,
  DaySessionInput,
  FamilySettingsInput,
  HomeworkItemInput,
  OverrideInput,
  TaskRunInput,
  TaskTemplateInput,
} from "@/lib/dayState";
import { addDays, startOfLocalDay, weekStart } from "@/lib/time";

/** What the loader returns besides the pure `DayInput`. */
export interface LoadedDay {
  input: DayInput;
  /** homework_items.photo_paths by homework id (the parent's photos of the assignment). */
  homeworkPhotos: Record<string, string[]>;
}

interface SettingsRow {
  break_minutes: number;
  free_minutes: number;
  extra_min_minutes: number;
  skill_min_minutes: number;
  passes_per_week: number;
  trust_up_pct: number;
  trust_up_weeks: number;
  trust_down_pct: number;
  homework_lookahead_days: number;
  /** Added by 0002; absent until that migration runs (e.g. on a preview before merge). */
  homework_min_upcoming?: number;
}

/** Default of family_settings.homework_min_upcoming (0002). */
export const DEFAULT_MIN_UPCOMING = 1;

/**
 * Before a migration adds a table or a column (a preview on the production database until the
 * parents merge): Postgres 42P01 / 42703, PostgREST PGRST205 / PGRST204. Never anything else.
 */
export function notMigratedYet(e: { code?: string; message: string }): boolean {
  return (
    e.code === "42P01" ||
    e.code === "42703" ||
    e.code === "PGRST205" ||
    e.code === "PGRST204" ||
    /relation .* does not exist|could not find the table|column .* does not exist/i.test(e.message)
  );
}

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): NonNullable<T> {
  if (res.error) throw new Error(`loadDay: ${what}: ${res.error.message}`);
  if (res.data === null || res.data === undefined) throw new Error(`loadDay: ${what}: no data`);
  return res.data as NonNullable<T>;
}

function trustChangedAt(since: string | null | undefined, createdAt: string | null | undefined): string | null {
  if (!since || !createdAt) return null;
  return Date.parse(since) > Date.parse(createdAt) ? since : null;
}

type Res<T> = { data: T | null; error: { code?: string; message: string } | null };

const MAIN_COLUMNS =
  "break_minutes, free_minutes, extra_min_minutes, skill_min_minutes, passes_per_week, trust_up_pct, trust_up_weeks, trust_down_pct, homework_lookahead_days";
/** 0002 */
const MIN_UPCOMING_COLUMN = "homework_min_upcoming";
/** 0014 (R8b break bank) */
const BANK_COLUMNS = "break_tiers, break_max_per_day, break_run_cap_minutes";

interface BankRow {
  break_tiers: unknown;
  break_max_per_day: number;
  break_run_cap_minutes: number;
}

function settingsInput(row: SettingsRow, bank: Res<BankRow>): FamilySettingsInput {
  return {
    breakMinutes: row.break_minutes,
    freeMinutes: row.free_minutes,
    extraMinMinutes: row.extra_min_minutes,
    skillMinMinutes: row.skill_min_minutes,
    passesPerWeek: row.passes_per_week,
    trustUpPct: row.trust_up_pct,
    trustUpWeeks: row.trust_up_weeks,
    trustDownPct: row.trust_down_pct,
    homeworkLookaheadDays: row.homework_lookahead_days,
    homeworkMinUpcoming: row.homework_min_upcoming ?? DEFAULT_MIN_UPCOMING,
    ...(bank.error || !bank.data
      ? {}
      : {
          breakTiers: bank.data.break_tiers,
          breakMaxPerDay: bank.data.break_max_per_day,
          breakRunCapMinutes: bank.data.break_run_cap_minutes,
        }),
  };
}

/**
 * family_settings in ONE read once every migration has run. Only when a column does not exist
 * yet (a preview before merge) the three separate reads below are used, exactly as before.
 * `bankOk`: the 0014 columns were read (bank mode also needs the day_breaks table).
 */
async function readSettings(db: SupabaseClient, familyId: string): Promise<{ settings: FamilySettingsInput; bankOk: boolean }> {
  const all = (await db
    .from("family_settings")
    .select(`${MAIN_COLUMNS}, ${MIN_UPCOMING_COLUMN}, ${BANK_COLUMNS}`)
    .eq("family_id", familyId)
    .single()) as Res<SettingsRow & BankRow>;
  if (!all.error || !notMigratedYet(all.error)) {
    const row = must(all, "family_settings");
    return { settings: settingsInput(row, { data: row, error: null }), bankOk: true };
  }

  const settingsRow = must((await db.from("family_settings").select(MAIN_COLUMNS).eq("family_id", familyId).single()) as Res<SettingsRow>, "family_settings");
  // Separate read so the screen keeps working before migration 0002 adds the column
  // (e.g. a preview before merge): missing -> the column's default.
  const minUpcoming = (await db.from("family_settings").select(MIN_UPCOMING_COLUMN).eq("family_id", familyId).maybeSingle()) as Res<{
    homework_min_upcoming: number;
  }>;
  if (minUpcoming.error) settingsRow.homework_min_upcoming = DEFAULT_MIN_UPCOMING;
  else settingsRow.homework_min_upcoming = minUpcoming.data?.homework_min_upcoming ?? DEFAULT_MIN_UPCOMING;
  // R8b (0014): the break bank settings, read on their own like 0002 above. Missing -> the old
  // single break (`breaks: null` in loadDay); any other error throws (fail-closed).
  const bankSettings = (await db.from("family_settings").select(BANK_COLUMNS).eq("family_id", familyId).maybeSingle()) as Res<BankRow>;
  if (bankSettings.error && !notMigratedYet(bankSettings.error)) throw new Error(`loadDay: family_settings (0014): ${bankSettings.error.message}`);
  return { settings: settingsInput(settingsRow, bankSettings), bankOk: !bankSettings.error };
}

/**
 * Loads everything `computeDayState` needs for ONE child, for the local date `today`.
 * `db` should act as the child (RLS: children may SELECT only their own rows), so a bug
 * here can never leak a sibling's data. Throws on any error: callers answer with an
 * error and the extension stays fail-closed.
 */
export async function loadDay(db: SupabaseClient, childId: string, familyId: string, today: string): Promise<LoadedDay> {
  // Homework done since Monday is loaded for the "★ sớm" weekly count (interpretation 18);
  // computeDayState still lists only homework done today.
  const startOfWeek = startOfLocalDay(weekStart(today)).toISOString();

  // Settings first (the history window below depends on them), everything else that does not
  // depend on them in parallel: two sequential round trips instead of five.
  const settingsRead = readSettings(db, familyId);
  const sessionsRead = settingsRead.then(({ settings }) =>
    db
      .from("day_sessions")
      .select("local_date, day_type, disabled_template_ids, break_started_at, break_ended_at, break_skipped, part1_done_at, part2_done_at, free_started_at, pass_used_at")
      .eq("child_id", childId)
      .gte("local_date", addDays(weekStart(today), -7 * settings.trustUpWeeks))
      .lte("local_date", today),
  );
  const rest = Promise.all([
    db.from("profiles").select("bedtime").eq("id", childId).single(),
    db.from("trust_state").select("mode, since, created_at").eq("child_id", childId).maybeSingle(),
    db
      .from("homework_items")
      .select("id, subject, due_date, note, photo_paths, done_at, archived_at, created_at")
      .eq("child_id", childId)
      .is("archived_at", null)
      .or(`done_at.is.null,done_at.gte.${startOfWeek}`),
    db
      .from("task_templates")
      .select("id, part, title, subject, app_slot_id, weekdays, min_minutes, deep_link, sort, active")
      .eq("child_id", childId)
      .eq("active", true),
    db.from("app_slots").select("id, kind, label, url, active").eq("family_id", familyId),
    db
      .from("task_runs")
      .select("id, local_date, source, homework_item_id, template_id, started_at, done_at, proof_paths")
      .eq("child_id", childId)
      .eq("local_date", today),
    db.from("overrides").select("id, local_date, kind, until, created_at").eq("child_id", childId).eq("local_date", today),
    db.from("day_breaks").select("id, local_date, started_at, planned_minutes, ended_at").eq("child_id", childId).eq("local_date", today),
  ]);
  // A settings error rejects first, so it is still the error thrown (as when it was read alone).
  const [{ settings, bankOk }, sessions, [profile, trust, homework, templates, slots, runs, overrides, breaks]] = await Promise.all([
    settingsRead,
    sessionsRead,
    rest,
  ]);

  const bedtime = must(profile, "profiles").bedtime as string;
  if (trust.error) throw new Error(`loadDay: trust_state: ${trust.error.message}`);
  if (breaks.error && !notMigratedYet(breaks.error)) throw new Error(`loadDay: day_breaks: ${breaks.error.message}`);
  // Bank mode needs both the table and the settings columns of 0014 (one migration, so both or none).
  const bankReady = !breaks.error && bankOk;

  const homeworkRows = must(homework, "homework_items");
  const input: DayInput = {
    settings,
    bedtime,
    trustMode: trust.data?.mode === "trust" ? "trust" : "lock",
    // R8b focus (interpretation 19): `since` only when the mode was CHANGED then (since > created_at;
    // the row is created with since = created_at in lock mode, and before it the mode was lock too).
    trustSince: trustChangedAt(trust.data?.since as string | null | undefined, trust.data?.created_at as string | null | undefined),
    sessions: must(sessions, "day_sessions").map(
      (s): DaySessionInput => ({
        localDate: s.local_date,
        dayType: s.day_type,
        disabledTemplateIds: s.disabled_template_ids ?? [],
        breakStartedAt: s.break_started_at,
        breakEndedAt: s.break_ended_at,
        breakSkipped: s.break_skipped,
        part1DoneAt: s.part1_done_at,
        part2DoneAt: s.part2_done_at,
        freeStartedAt: s.free_started_at,
        passUsedAt: s.pass_used_at,
      }),
    ),
    homework: homeworkRows.map(
      (h): HomeworkItemInput => ({
        id: h.id,
        subject: h.subject,
        dueDate: h.due_date,
        note: h.note,
        doneAt: h.done_at,
        archivedAt: h.archived_at,
        createdAt: h.created_at,
      }),
    ),
    templates: must(templates, "task_templates").map(
      (t): TaskTemplateInput => ({
        id: t.id,
        part: t.part,
        title: t.title,
        subject: t.subject,
        appSlotId: t.app_slot_id,
        weekdays: t.weekdays,
        minMinutes: t.min_minutes,
        deepLink: t.deep_link,
        sort: t.sort,
        active: t.active,
      }),
    ),
    appSlots: must(slots, "app_slots").map((s): AppSlotInput => ({ id: s.id, kind: s.kind, label: s.label, url: s.url, active: s.active })),
    runs: must(runs, "task_runs").map(
      (r): TaskRunInput => ({
        id: r.id,
        localDate: r.local_date,
        source: r.source,
        homeworkItemId: r.homework_item_id,
        templateId: r.template_id,
        startedAt: r.started_at,
        doneAt: r.done_at,
        proofPaths: r.proof_paths ?? [],
      }),
    ),
    overrides: must(overrides, "overrides").map(
      (o): OverrideInput => ({ id: o.id, localDate: o.local_date, kind: o.kind, until: o.until, createdAt: o.created_at }),
    ),
    breaks: bankReady
      ? (breaks.data ?? []).map(
          (b): BreakRowInput => ({
            id: b.id,
            localDate: b.local_date,
            startedAt: b.started_at,
            plannedMinutes: b.planned_minutes,
            endedAt: b.ended_at,
          }),
        )
      : null,
  };

  const homeworkPhotos: Record<string, string[]> = {};
  for (const h of homeworkRows) homeworkPhotos[h.id] = h.photo_paths ?? [];
  return { input, homeworkPhotos };
}
