-- 0013 (R4a, docs/MAN_CHINH_MOI.md §4, parent decisions 07/11/2026): An's world of the month.
-- Each area finished in a day (Cảm xúc / Học tập / Kỹ năng / Vui chơi) grows ONE thing in that
-- month's world (rừng, biển, vũ trụ…). What grew is STORED, never recomputed: deleting a
-- Góc bình yên check-in must not take a plant away or change later ones (BINH_YEN D2).
--
-- ADDITIVE and idempotent: two new tables, constraints, grants. Nothing is dropped, no existing
-- row is changed. Both tables are server-only (like by_checkins): browsers get NO grant at all;
-- the child reads through GET /api/world (child session only). Parents do not read them: the
-- "feel" rows belong to Góc bình yên.
--
-- world_items: one row per (child, day, area). No feeling column — a "feel" plant is the same
--   whatever the child felt. item_key / variant come from lib/world/ and are kept as they were
--   when planted, so adding things to a world later never changes old plants or the album.
-- world_months: the world the child picked for a month (R4b, An chooses at the start of the
--   month). Without a pick the server follows a fixed order. Once a month has plants its world
--   no longer changes (the server writes world_key on every plant).

create table if not exists public.world_items (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  child_id    uuid not null references public.profiles (id) on delete cascade,
  local_date  date not null,
  pillar      text not null check (pillar in ('feel', 'study', 'skill', 'play')),
  world_key   text not null check (world_key ~ '^[a-z][a-z0-9_]{1,31}$'),
  item_key    text not null check (item_key ~ '^[a-z][a-z0-9_]{1,47}$'),
  variant     smallint not null default 0 check (variant between 0 and 99),
  created_at  timestamptz not null default now(),
  unique (child_id, local_date, pillar)
);
create index if not exists world_items_child_month_idx on public.world_items (child_id, local_date);

create table if not exists public.world_months (
  family_id   uuid not null references public.families (id) on delete cascade,
  child_id    uuid not null references public.profiles (id) on delete cascade,
  month       date not null check (extract(day from month) = 1),
  world_key   text not null check (world_key ~ '^[a-z][a-z0-9_]{1,31}$'),
  chosen_at   timestamptz not null default now(),
  primary key (child_id, month)
);

-- Integrity: the child belongs to the SAME family as the row (same pattern as 0008–0010).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'world_items_child_family_fk' and conrelid = 'public.world_items'::regclass) then
    alter table public.world_items add constraint world_items_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'world_months_child_family_fk' and conrelid = 'public.world_months'::regclass) then
    alter table public.world_months add constraint world_months_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.world_items enable row level security;
alter table public.world_months enable row level security;
-- Server only: no policy, no grant for browsers.
revoke all on public.world_items from public, anon, authenticated;
revoke all on public.world_months from public, anon, authenticated;
grant all on public.world_items to service_role;
grant all on public.world_months to service_role;
