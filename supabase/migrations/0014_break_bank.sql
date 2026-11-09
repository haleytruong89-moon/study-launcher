-- 0014 (R8b "Ngân hàng giờ nghỉ", docs/superpowers/specs/2026-11-09-r8-design.md, parent decisions
-- 08/11/2026): focus time earns break minutes by tiers; a break uses the whole bank; the unused rest
-- is added to free time. The rules live in lib/dayState.ts (interpretation 19); this file only
-- stores the breaks and the two family rules.
--
-- ADDITIVE and idempotent: one new table, three new family_settings columns, constraints, grants,
-- policies. Nothing is dropped, no existing row is changed. family_settings.break_minutes and the
-- day_sessions.break_* columns stay (legacy, read only for days in flight).
--
-- day_breaks: one row per break. Written ONLY by the server (service_role, POST /api/day/break):
--   start inserts planned_minutes = the bank; "Học tiếp" sets ended_at. Browsers may only read:
--   a child its own rows, a parent the family's rows. No insert / update / delete for anyone else.

create table if not exists public.day_breaks (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families (id) on delete cascade,
  child_id         uuid not null references public.profiles (id) on delete cascade,
  local_date       date not null,
  started_at       timestamptz not null,
  planned_minutes  integer not null check (planned_minutes > 0),
  ended_at         timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists day_breaks_child_date_idx on public.day_breaks (child_id, local_date);

-- Integrity: the child belongs to the SAME family as the row (same pattern as 0001).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'day_breaks_child_family_fk' and conrelid = 'public.day_breaks'::regclass) then
    alter table public.day_breaks add constraint day_breaks_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.day_breaks enable row level security;

-- Browsers read only; the server writes (service_role).
revoke all on public.day_breaks from public, anon, authenticated;
grant select on public.day_breaks to authenticated;
grant all on public.day_breaks to service_role;

-- Same read pattern as task_runs: a child sees its own rows, a parent the family's rows.
drop policy if exists child_select_own on public.day_breaks;
create policy child_select_own on public.day_breaks
  for select to authenticated
  using (public.auth_role() = 'child' and child_id = auth.uid());

drop policy if exists parent_select on public.day_breaks;
create policy parent_select on public.day_breaks
  for select to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id());

-- The family rules (never hard-coded): [[focusMinutes, breakMinutes], ...] ascending, the
-- number of breaks per day, and (parent decision 09/11/2026) the most focus one finished run adds. The server validates the tiers; a malformed value falls back to the
-- defaults in lib/dayState.ts.
alter table public.family_settings
  add column if not exists break_tiers jsonb not null default '[[45,10],[90,30],[120,45],[180,60]]'::jsonb;
alter table public.family_settings
  add column if not exists break_max_per_day integer not null default 6;
alter table public.family_settings
  add column if not exists break_run_cap_minutes integer not null default 180;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'family_settings_break_tiers_array' and conrelid = 'public.family_settings'::regclass) then
    alter table public.family_settings add constraint family_settings_break_tiers_array
      check (jsonb_typeof(break_tiers) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'family_settings_break_max_per_day_range' and conrelid = 'public.family_settings'::regclass) then
    alter table public.family_settings add constraint family_settings_break_max_per_day_range
      check (break_max_per_day between 0 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'family_settings_break_run_cap_minutes_range' and conrelid = 'public.family_settings'::regclass) then
    alter table public.family_settings add constraint family_settings_break_run_cap_minutes_range
      check (break_run_cap_minutes between 30 and 600);
  end if;
end $$;
