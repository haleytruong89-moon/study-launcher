-- 0003_plans_icons_weekly.sql — S2e (parent decisions 17/10/2026).
-- ADDITIVE and idempotent. Nothing is dropped, no row is deleted or changed.
--
-- 1. profiles.icon: the child picks one icon from a fixed set (checked by the server).
-- 2. day_plans: the child's optional "Kế hoạch hôm nay" (ordered task keys). Display only:
--    it never changes what locks or opens the laptop.
-- 3. weekly_reviews: the Sunday "Tổng kết tuần" — two short answers the parents can read.
-- Children never write these tables directly: their routes write with service_role on the
-- server. Browsers get SELECT only (RLS: a child their own rows, a parent the family).

-- 1. profiles.icon --------------------------------------------------------------
alter table public.profiles add column if not exists icon text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_icon_len_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_icon_len_check check (icon is null or char_length(icon) <= 16);
  end if;
end $$;

grant select (icon) on public.profiles to authenticated;

-- 2. day_plans ------------------------------------------------------------------
create table if not exists public.day_plans (
  child_id    uuid not null references public.profiles (id) on delete cascade,
  family_id   uuid not null references public.families (id) on delete cascade,
  local_date  date not null,
  item_keys   text[] not null default '{}' check (cardinality(item_keys) <= 40),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (child_id, local_date)
);

-- 3. weekly_reviews -------------------------------------------------------------
create table if not exists public.weekly_reviews (
  child_id     uuid not null references public.profiles (id) on delete cascade,
  family_id    uuid not null references public.families (id) on delete cascade,
  week_start   date not null check (extract(isodow from week_start) = 1),
  went_well    text check (went_well is null or char_length(went_well) <= 500),
  change_next  text check (change_next is null or char_length(change_next) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (child_id, week_start)
);

-- A child row must belong to the same family (same composite key as the 0001 tables).
do $$
declare
  t text;
begin
  foreach t in array array['day_plans', 'weekly_reviews']
  loop
    if not exists (
      select 1 from pg_constraint where conname = t || '_child_family_fk' and conrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (child_id, family_id)
           references public.profiles (id, family_id) on delete cascade',
        t, t || '_child_family_fk'
      );
    end if;
  end loop;
end $$;

alter table public.day_plans      enable row level security;
alter table public.weekly_reviews enable row level security;

-- Explicit grants (the project does not expose new tables automatically).
grant select on public.day_plans, public.weekly_reviews to authenticated;
grant all on public.day_plans, public.weekly_reviews to service_role;

do $$
declare
  t text;
begin
  foreach t in array array['day_plans', 'weekly_reviews']
  loop
    execute format('drop policy if exists child_select_own on public.%I', t);
    execute format(
      'create policy child_select_own on public.%I for select to authenticated
         using (public.auth_role() = ''child'' and child_id = auth.uid())',
      t
    );
    execute format('drop policy if exists parent_select on public.%I', t);
    execute format(
      'create policy parent_select on public.%I for select to authenticated
         using (public.auth_role() = ''parent'' and family_id = public.auth_family_id())',
      t
    );
  end loop;
end $$;
