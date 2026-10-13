-- 0001_init.sql — Study Launcher schema, RLS, grants, storage buckets.
-- See docs/DESIGN.md sections 4, 9 and 11.
--
-- Rules for this file (CLAUDE.md):
--   * Idempotent: safe to run twice (create ... if not exists, create or replace, drop policy if exists).
--   * Additive only: never drops tables or data.
--   * Runs inside one transaction when applied by the Supabase GitHub integration, so no
--     "create index concurrently" or other statements that cannot run in a transaction.
--   * "Automatically expose new tables" is OFF on this project, so every GRANT is explicit.
--   * Children have SELECT-only access. All child actions go through server routes that write with service_role.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  timezone    text not null default 'Asia/Ho_Chi_Minh',
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  family_id         uuid not null references public.families (id) on delete cascade,
  role              text not null check (role in ('parent', 'child')),
  display_name      text not null,
  grade             smallint,
  color             text,
  pin_hash          text,
  pin_failed_count  integer not null default 0,
  pin_locked_until  timestamptz,
  bedtime           time not null default '21:30',
  created_at        timestamptz not null default now()
);
create index if not exists profiles_family_id_idx on public.profiles (family_id);

-- All "family rules" live here, never hard-coded (CLAUDE.md).
create table if not exists public.family_settings (
  family_id                uuid primary key references public.families (id) on delete cascade,
  break_minutes            integer not null default 10  check (break_minutes >= 0),
  free_minutes             integer not null default 45  check (free_minutes >= 0),
  extra_min_minutes        integer not null default 20  check (extra_min_minutes >= 0),
  skill_min_minutes        integer not null default 20  check (skill_min_minutes >= 0),
  passes_per_week          integer not null default 1   check (passes_per_week >= 0),
  trust_up_pct             integer not null default 90  check (trust_up_pct between 0 and 100),
  trust_up_weeks           integer not null default 3   check (trust_up_weeks >= 1),
  trust_down_pct           integer not null default 70  check (trust_down_pct between 0 and 100),
  homework_lookahead_days  integer not null default 1   check (homework_lookahead_days >= 0),
  photo_retention_days     integer not null default 120 check (photo_retention_days >= 1),
  created_at               timestamptz not null default now()
);

create table if not exists public.app_slots (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families (id) on delete cascade,
  child_id       uuid references public.profiles (id) on delete cascade, -- null = whole family
  subject        text not null,
  kind           text not null check (kind in ('internal', 'external', 'placeholder')),
  label          text not null,
  url            text,
  allow_domains  text[] not null default '{}',
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists app_slots_family_id_idx on public.app_slots (family_id);

create table if not exists public.task_templates (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  child_id     uuid not null references public.profiles (id) on delete cascade,
  part         text not null check (part in ('extra', 'skill')),
  title        text not null,
  subject      text,
  app_slot_id  uuid references public.app_slots (id) on delete set null,
  weekdays     smallint[] not null default '{}'
               check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]), -- 1 = Monday ... 7 = Sunday
  min_minutes  integer check (min_minutes is null or min_minutes >= 0),
  deep_link    text,
  pillar       text,
  sort         integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists task_templates_child_id_idx on public.task_templates (child_id);

create table if not exists public.homework_items (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  child_id      uuid not null references public.profiles (id) on delete cascade,
  subject       text not null,
  due_date      date not null,
  note          text,
  photo_paths   text[] not null default '{}',
  created_by    uuid references public.profiles (id) on delete set null,
  done_at       timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists homework_items_child_due_idx on public.homework_items (child_id, due_date);

create table if not exists public.task_runs (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families (id) on delete cascade,
  child_id          uuid not null references public.profiles (id) on delete cascade,
  local_date        date not null,
  source            text not null check (source in ('homework', 'template')),
  homework_item_id  uuid references public.homework_items (id) on delete set null,
  template_id       uuid references public.task_templates (id) on delete set null,
  started_at        timestamptz,
  done_at           timestamptz,
  proof_paths       text[] not null default '{}',
  parent_verdict    text check (parent_verdict in ('ok', 'not_ok')),
  verdict_at        timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists task_runs_child_date_idx on public.task_runs (child_id, local_date);

create table if not exists public.day_sessions (
  child_id               uuid not null references public.profiles (id) on delete cascade,
  local_date             date not null,
  family_id              uuid not null references public.families (id) on delete cascade,
  day_type               text not null default 'normal' check (day_type in ('normal', 'sick', 'exam', 'holiday')),
  disabled_template_ids  uuid[] not null default '{}',
  break_started_at       timestamptz,
  break_ended_at         timestamptz,
  break_skipped          boolean not null default false,
  part1_done_at          timestamptz,
  part2_done_at          timestamptz,
  free_started_at        timestamptz,
  pass_used_at           timestamptz,
  created_at             timestamptz not null default now(),
  primary key (child_id, local_date)
);
create index if not exists day_sessions_family_id_idx on public.day_sessions (family_id);

create table if not exists public.overrides (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  child_id    uuid not null references public.profiles (id) on delete cascade,
  local_date  date not null,
  kind        text not null check (kind in ('open_until', 'lock_until')),
  until       timestamptz not null, -- clipped to 00:00 by the server
  created_by  uuid references public.profiles (id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists overrides_child_date_idx on public.overrides (child_id, local_date, created_at desc);

create table if not exists public.allowlist_entries (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  child_id    uuid references public.profiles (id) on delete cascade, -- null = whole family
  domain      text not null,
  grp         text not null check (grp in ('system', 'internal', 'external', 'dictionary', 'child_pick', 'request')),
  expires_at  timestamptz,                                              -- null = permanent
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists allowlist_entries_family_idx on public.allowlist_entries (family_id, child_id);

create table if not exists public.unlock_requests (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  child_id    uuid not null references public.profiles (id) on delete cascade,
  url         text not null,
  domain      text not null,
  reason      text,
  status      text not null default 'pending'
              check (status in ('pending', 'approved_15m', 'approved_day', 'approved_permanent', 'denied')),
  decided_at  timestamptz,
  decided_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
-- Only one pending request per child + domain (SPEC 2.6, "Xin mở trang").
create unique index if not exists unlock_requests_one_pending_idx
  on public.unlock_requests (child_id, domain) where status = 'pending';

create table if not exists public.extension_devices (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  child_id      uuid not null references public.profiles (id) on delete cascade,
  token_hash    text not null,
  label         text,
  last_seen_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists extension_devices_child_idx on public.extension_devices (child_id);

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.trust_state (
  child_id    uuid primary key references public.profiles (id) on delete cascade,
  family_id   uuid not null references public.families (id) on delete cascade,
  mode        text not null default 'lock' check (mode in ('lock', 'trust')),
  since       timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_family_idx on public.audit_log (family_id, created_at desc);

-- Integrity: a row's child_id must belong to the SAME family as the row's family_id.
-- Without this a parent could write rows (overrides, trust_state, ...) for another family's child.
create unique index if not exists profiles_id_family_uidx on public.profiles (id, family_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'app_slots', 'task_templates', 'homework_items', 'task_runs', 'day_sessions', 'overrides',
    'allowlist_entries', 'unlock_requests', 'extension_devices', 'trust_state'
  ]
  loop
    if not exists (
      select 1 from pg_constraint
      where conname = t || '_child_family_fk' and conrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (child_id, family_id)
           references public.profiles (id, family_id) on delete cascade',
        t, t || '_child_family_fk'
      );
    end if;
  end loop;
end
$$;

-- v1 is a single-family app: at most one row in `families` (also makes first-run setup race-proof).
create unique index if not exists families_singleton_idx on public.families ((true));

-- ---------------------------------------------------------------------------
-- 2. Helper functions (security definer so policies on `profiles` do not recurse)
-- ---------------------------------------------------------------------------

create or replace function public.auth_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Lightweight query for the keep-alive GitHub Action (the Free plan pauses idle projects).
create or replace function public.ping()
returns timestamptz
language sql
stable
as $$
  select now()
$$;

revoke all on function public.auth_family_id() from public, anon;
revoke all on function public.auth_role() from public, anon;
grant execute on function public.auth_family_id() to authenticated, service_role;
grant execute on function public.auth_role() to authenticated, service_role;
grant execute on function public.ping() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Row Level Security: enabled on EVERY table
-- ---------------------------------------------------------------------------

alter table public.families           enable row level security;
alter table public.profiles           enable row level security;
alter table public.family_settings    enable row level security;
alter table public.app_slots          enable row level security;
alter table public.task_templates     enable row level security;
alter table public.homework_items     enable row level security;
alter table public.task_runs          enable row level security;
alter table public.day_sessions       enable row level security;
alter table public.overrides          enable row level security;
alter table public.allowlist_entries  enable row level security;
alter table public.unlock_requests    enable row level security;
alter table public.extension_devices  enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.trust_state        enable row level security;
alter table public.audit_log          enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Grants (explicit; nothing is exposed automatically)
-- ---------------------------------------------------------------------------

-- Start from a clean slate so re-running this file always ends in the same state.
revoke all on all tables in schema public from anon, authenticated;

-- service_role (server routes only) gets everything.
grant all on all tables in schema public to service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Tables where RLS decides what a parent may do and a child may read (select only by policy).
grant select, insert, update, delete on
  public.family_settings,
  public.app_slots,
  public.task_templates,
  public.homework_items,
  public.task_runs,
  public.day_sessions,
  public.overrides,
  public.allowlist_entries,
  public.unlock_requests,
  public.trust_state
to authenticated;

-- families: members read; parents rename.
grant select on public.families to authenticated;
grant update (name) on public.families to authenticated;

-- profiles: PIN columns are never readable or writable by browsers (server only, service_role).
grant select (id, family_id, role, display_name, grade, color, bedtime, created_at)
  on public.profiles to authenticated;
grant update (display_name, grade, color, bedtime) on public.profiles to authenticated;

-- extension_devices: token_hash is never readable; parents may rename or revoke.
grant select (id, family_id, child_id, label, last_seen_at, revoked_at, created_at)
  on public.extension_devices to authenticated;
grant update (label, revoked_at) on public.extension_devices to authenticated;

-- audit_log: parents read only (server writes).
grant select on public.audit_log to authenticated;

-- push_subscriptions: no grant to authenticated at all (server only).

-- ---------------------------------------------------------------------------
-- 5. Policies
-- ---------------------------------------------------------------------------

-- families
drop policy if exists families_member_select on public.families;
create policy families_member_select on public.families
  for select to authenticated
  using (id = public.auth_family_id());

drop policy if exists families_parent_update on public.families;
create policy families_parent_update on public.families
  for update to authenticated
  using (id = public.auth_family_id() and public.auth_role() = 'parent')
  with check (id = public.auth_family_id() and public.auth_role() = 'parent');

-- profiles: a child sees only themselves; a parent sees the whole family.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (public.auth_role() = 'parent' and family_id = public.auth_family_id())
  );

drop policy if exists profiles_parent_update on public.profiles;
create policy profiles_parent_update on public.profiles
  for update to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id())
  with check (public.auth_role() = 'parent' and family_id = public.auth_family_id());

-- Parents: full access to every row of their own family, on every family-scoped table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'family_settings', 'app_slots', 'task_templates', 'homework_items', 'task_runs',
    'day_sessions', 'overrides', 'allowlist_entries', 'unlock_requests', 'trust_state'
  ]
  loop
    execute format('drop policy if exists parent_all on public.%I', t);
    execute format(
      'create policy parent_all on public.%I for all to authenticated
         using (public.auth_role() = ''parent'' and family_id = public.auth_family_id())
         with check (public.auth_role() = ''parent'' and family_id = public.auth_family_id())',
      t
    );
  end loop;
end
$$;

-- Children: SELECT only, and only their own rows.
do $$
declare
  t text;
begin
  foreach t in array array[
    'task_templates', 'homework_items', 'task_runs', 'day_sessions',
    'overrides', 'unlock_requests', 'trust_state'
  ]
  loop
    execute format('drop policy if exists child_select_own on public.%I', t);
    execute format(
      'create policy child_select_own on public.%I for select to authenticated
         using (public.auth_role() = ''child'' and child_id = auth.uid())',
      t
    );
  end loop;
end
$$;

-- Children read family-wide settings and the slots / allowlist that apply to them
-- (their own, or the whole family's). Never a sibling's.
drop policy if exists child_select_family on public.family_settings;
create policy child_select_family on public.family_settings
  for select to authenticated
  using (public.auth_role() = 'child' and family_id = public.auth_family_id());

drop policy if exists child_select_applicable on public.app_slots;
create policy child_select_applicable on public.app_slots
  for select to authenticated
  using (
    public.auth_role() = 'child'
    and family_id = public.auth_family_id()
    and (child_id is null or child_id = auth.uid())
  );

drop policy if exists child_select_applicable on public.allowlist_entries;
create policy child_select_applicable on public.allowlist_entries
  for select to authenticated
  using (
    public.auth_role() = 'child'
    and family_id = public.auth_family_id()
    and (child_id is null or child_id = auth.uid())
  );

-- extension_devices: parents only (children never see device rows).
drop policy if exists parent_select on public.extension_devices;
create policy parent_select on public.extension_devices
  for select to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id());

drop policy if exists parent_update on public.extension_devices;
create policy parent_update on public.extension_devices
  for update to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id())
  with check (public.auth_role() = 'parent' and family_id = public.auth_family_id());

-- audit_log: parents read only.
drop policy if exists parent_select on public.audit_log;
create policy parent_select on public.audit_log
  for select to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id());

-- push_subscriptions: RLS on, no policy for browsers => deny all. Server (service_role) bypasses RLS.

-- ---------------------------------------------------------------------------
-- 6. Storage buckets + policies (DESIGN section 9)
--    homework/{family_id}/{child_id}/{due_date}/{uuid}.jpg   parent writes, child of that item reads
--    proofs/{family_id}/{child_id}/{local_date}/{uuid}.jpg   child writes own folder, parent reads
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('homework', 'homework', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('proofs',   'proofs',   false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- homework
drop policy if exists homework_parent_all on storage.objects;
create policy homework_parent_all on storage.objects
  for all to authenticated
  using (
    bucket_id = 'homework'
    and public.auth_role() = 'parent'
    and (storage.foldername(name))[1] = public.auth_family_id()::text
  )
  with check (
    bucket_id = 'homework'
    and public.auth_role() = 'parent'
    and (storage.foldername(name))[1] = public.auth_family_id()::text
  );

drop policy if exists homework_child_select on storage.objects;
create policy homework_child_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'homework'
    and public.auth_role() = 'child'
    and (storage.foldername(name))[1] = public.auth_family_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- proofs
drop policy if exists proofs_child_insert on storage.objects;
create policy proofs_child_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'proofs'
    and public.auth_role() = 'child'
    and (storage.foldername(name))[1] = public.auth_family_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists proofs_child_select on storage.objects;
create policy proofs_child_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'proofs'
    and public.auth_role() = 'child'
    and (storage.foldername(name))[1] = public.auth_family_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists proofs_parent_all on storage.objects;
create policy proofs_parent_all on storage.objects
  for all to authenticated
  using (
    bucket_id = 'proofs'
    and public.auth_role() = 'parent'
    and (storage.foldername(name))[1] = public.auth_family_id()::text
  )
  with check (
    bucket_id = 'proofs'
    and public.auth_role() = 'parent'
    and (storage.foldername(name))[1] = public.auth_family_id()::text
  );

-- ---------------------------------------------------------------------------
-- 7. Seed helper (DESIGN section 4, "Seed")
--    Called by the server (service_role) right after a family is created. Idempotent.
--    Default allowlist = Launcher + App Toan + dictionary / translate. NOT Google Search, NOT YouTube.
-- ---------------------------------------------------------------------------

create or replace function public.seed_family_defaults(p_family_id uuid, p_launcher_domain text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  d record;
begin
  insert into public.family_settings (family_id)
  values (p_family_id)
  on conflict (family_id) do nothing;

  for d in
    select * from (values
      (p_launcher_domain,          'system'),
      ('math-app-gules.vercel.app', 'internal'),
      ('translate.google.com',     'dictionary'),
      ('dictionary.cambridge.org', 'dictionary'),
      ('tratu.soha.vn',            'dictionary'),
      ('accounts.google.com',      'system')
    ) as v(domain, grp)
    where v.domain is not null and v.domain <> ''
  loop
    insert into public.allowlist_entries (family_id, child_id, domain, grp)
    select p_family_id, null, d.domain, d.grp
    where not exists (
      select 1 from public.allowlist_entries a
      where a.family_id = p_family_id and a.child_id is null and a.domain = d.domain
    );
  end loop;
end
$$;

revoke all on function public.seed_family_defaults(uuid, text) from public, anon, authenticated;
grant execute on function public.seed_family_defaults(uuid, text) to service_role;
