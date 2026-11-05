-- 0008_binh_yen_base.sql — Góc bình yên, slice S-BY0 (docs/BINH_YEN.md §2, §3, R3, R6, §10).
-- ADDITIVE and idempotent: 4 + 4 new columns, 2 new tables, 2 new functions. Nothing is
-- dropped, no existing row is changed, and the feature stays OFF (by_enabled = false) until
-- a parent turns it on in "Luật trong nhà".
--
-- No emotions are stored here (that comes in S-BY1). This file only adds:
--   * the child's OWN Góc bình yên PIN (hash + tries + lock + "wiped by a parent at"),
--   * the family switch and limits,
--   * by_sessions: server-held unlock sessions (idle lock on the SERVER clock),
--   * by_signals: content-free signals to the parents ("Con muốn nói chuyện").

-- ---------------------------------------------------------------------------
-- 1. profiles: the child's own Góc bình yên PIN (R6, Q1)
-- ---------------------------------------------------------------------------
-- Same protection as the login PIN of 0001/0005: browsers have only COLUMN-level grants on
-- profiles (0001 §4), and these new columns get none, so neither a child nor a parent can
-- read or write them through the browser API. Only server routes (service_role) touch them.
alter table public.profiles add column if not exists by_pin_hash text;
alter table public.profiles add column if not exists by_pin_failed_count integer not null default 0;
alter table public.profiles add column if not exists by_pin_locked_until timestamptz;
alter table public.profiles add column if not exists by_pin_reset_at timestamptz;
-- Belt and braces: make sure no column grant on them exists (a no-op when none was given).
revoke select (by_pin_hash, by_pin_failed_count, by_pin_locked_until, by_pin_reset_at) on public.profiles from anon, authenticated;
revoke update (by_pin_hash, by_pin_failed_count, by_pin_locked_until, by_pin_reset_at) on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. family_settings: switch + limits (D4). Parents edit them with their own session
--    (existing parent_all policy); children read them (existing child_select_family).
-- ---------------------------------------------------------------------------
alter table public.family_settings add column if not exists by_enabled boolean not null default false;
alter table public.family_settings add column if not exists by_study_minutes integer not null default 10 check (by_study_minutes >= 5);
alter table public.family_settings add column if not exists by_idle_lock_minutes integer not null default 5 check (by_idle_lock_minutes between 2 and 15);
alter table public.family_settings add column if not exists by_daily_rewards integer not null default 1 check (by_daily_rewards >= 1);

-- ---------------------------------------------------------------------------
-- 3. by_sessions — server only (no browser grant, RLS on, no policy)
-- ---------------------------------------------------------------------------
-- One row per unlock. The browser holds a random token in an httpOnly cookie; only its
-- SHA-256 is stored. device_id = the remembered PIN browser (pin_devices), when known.
create table if not exists public.by_sessions (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  child_id      uuid not null references public.profiles (id) on delete cascade,
  token_hash    text not null unique,
  device_id     uuid references public.pin_devices (id) on delete set null,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ended_at      timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists by_sessions_open_idx on public.by_sessions (child_id) where ended_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'by_sessions_child_family_fk' and conrelid = 'public.by_sessions'::regclass
  ) then
    alter table public.by_sessions add constraint by_sessions_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.by_sessions enable row level security;
revoke all on public.by_sessions from anon, authenticated;
grant all on public.by_sessions to service_role;

-- ---------------------------------------------------------------------------
-- 4. by_signals — content-free signals to the parents (§3, R3)
-- ---------------------------------------------------------------------------
-- kind: 'want_talk' now, 'needs_care' in S-BY2. Values are checked by the server route
-- (spec §2.2: no fixed enum, so adding a kind never needs a constraint change). The CHECK
-- below is only a FORMAT guard (short lowercase key) so no free text can ever land here.
-- to_parent_id: null = both parents; else the one parent the child chose (§6).
create table if not exists public.by_signals (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  child_id      uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind ~ '^[a-z_]{1,32}$'),
  to_parent_id  uuid,
  created_at    timestamptz not null default now(),
  seen_at       timestamptz,
  seen_by       uuid,
  escalated_at  timestamptz
);
create index if not exists by_signals_child_idx on public.by_signals (child_id, created_at desc);
create index if not exists by_signals_unseen_idx on public.by_signals (family_id, created_at) where seen_at is null;

-- Integrity: the child, the chosen parent and the parent who saw it all belong to the
-- SAME family as the row. Deleting a parent keeps the signal (only that column is cleared).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'by_signals_child_family_fk' and conrelid = 'public.by_signals'::regclass
  ) then
    alter table public.by_signals add constraint by_signals_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'by_signals_to_parent_family_fk' and conrelid = 'public.by_signals'::regclass
  ) then
    alter table public.by_signals add constraint by_signals_to_parent_family_fk
      foreign key (to_parent_id, family_id) references public.profiles (id, family_id) on delete set null (to_parent_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'by_signals_seen_by_family_fk' and conrelid = 'public.by_signals'::regclass
  ) then
    alter table public.by_signals add constraint by_signals_seen_by_family_fk
      foreign key (seen_by, family_id) references public.profiles (id, family_id) on delete set null (seen_by);
  end if;
end $$;

alter table public.by_signals enable row level security;
revoke all on public.by_signals from anon, authenticated;
grant all on public.by_signals to service_role;
-- Browsers: read (policies below decide which rows) and set ONLY seen_at / seen_by.
-- No insert, no delete: a child creates a signal through POST /api/by/signal (service_role).
grant select on public.by_signals to authenticated;
grant update (seen_at, seen_by) on public.by_signals to authenticated;

-- A parent sees the family's signals sent to both parents or to them. A signal the child
-- sent to the OTHER parent only is not shown (the child chose who to tell, §6).
drop policy if exists parent_select on public.by_signals;
create policy parent_select on public.by_signals
  for select to authenticated
  using (
    public.auth_role() = 'parent'
    and family_id = public.auth_family_id()
    and (to_parent_id is null or to_parent_id = auth.uid())
  );

-- "Đã thấy": a parent marks a visible signal as seen, always in their OWN name.
drop policy if exists parent_mark_seen on public.by_signals;
create policy parent_mark_seen on public.by_signals
  for update to authenticated
  using (
    public.auth_role() = 'parent'
    and family_id = public.auth_family_id()
    and (to_parent_id is null or to_parent_id = auth.uid())
  )
  with check (
    public.auth_role() = 'parent'
    and family_id = public.auth_family_id()
    and seen_by = auth.uid()
    and seen_at is not null
  );

-- A child reads only their own signals ("đã gửi" / "bố mẹ đã thấy"); never a sibling's.
drop policy if exists child_select_own on public.by_signals;
create policy child_select_own on public.by_signals
  for select to authenticated
  using (public.auth_role() = 'child' and child_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Server-only functions (service_role)
-- ---------------------------------------------------------------------------

-- One Góc bình yên PIN try, counted ATOMICALLY before the comparison (same rule as the
-- login PIN, 0005): the 5th wrong try in a row locks it for 15 minutes; a lock that has
-- ended starts the count again at 1. Returns the try number (1..5), or no row when the
-- PIN is locked or not set.
create or replace function public.by_pin_try(p_child uuid)
returns integer
language sql
security invoker
set search_path = public
as $$
  update public.profiles
     set by_pin_failed_count = case when by_pin_locked_until <= now() then 1 else by_pin_failed_count + 1 end,
         by_pin_locked_until = case
           when (case when by_pin_locked_until <= now() then 1 else by_pin_failed_count + 1 end) >= 5 then now() + interval '15 minutes'
           else null
         end
   where id = p_child
     and role = 'child'
     and by_pin_hash is not null
     and (by_pin_locked_until is null or by_pin_locked_until <= now())
  returning by_pin_failed_count;
$$;
revoke all on function public.by_pin_try(uuid) from public, anon, authenticated;
grant execute on function public.by_pin_try(uuid) to service_role;

-- Creates a signal unless the same child sent the same kind less than p_gap_seconds ago
-- (rate limit, serialised per child so two quick taps cannot both pass). Returns the new
-- row, or no row when rate limited. The chosen parent must be a parent of the family.
create or replace function public.by_signal_create(p_child uuid, p_kind text, p_to uuid, p_gap_seconds integer)
returns setof public.by_signals
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_family uuid;
begin
  select family_id into v_family from public.profiles where id = p_child and role = 'child';
  if v_family is null then
    raise exception 'not a child' using errcode = '22023';
  end if;
  if p_to is not null and not exists (
    select 1 from public.profiles where id = p_to and family_id = v_family and role = 'parent'
  ) then
    raise exception 'not a parent of the family' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('by_signal:' || p_child::text, 0));
  if exists (
    select 1 from public.by_signals
     where child_id = p_child and kind = p_kind
       and created_at > now() - make_interval(secs => greatest(p_gap_seconds, 0))
  ) then
    return;
  end if;
  return query
    insert into public.by_signals (family_id, child_id, kind, to_parent_id)
    values (v_family, p_child, p_kind, p_to)
    returning *;
end
$$;
revoke all on function public.by_signal_create(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.by_signal_create(uuid, text, uuid, integer) to service_role;
