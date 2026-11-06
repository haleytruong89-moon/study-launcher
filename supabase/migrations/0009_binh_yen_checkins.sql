-- 0009_binh_yen_checkins.sql — Góc bình yên, slice S-BY1 (docs/BINH_YEN.md §2.2, §3, §4, R1, R5).
-- ADDITIVE and idempotent: ONE new table, two indexes, a few constraints. Nothing is dropped,
-- no existing row is changed, and the feature stays OFF (family_settings.by_enabled = false,
-- from 0008) until a parent turns it on in "Luật trong nhà".
--
-- by_checkins: one row per visit the child finished ("Xong" or "Vậy là đủ cho hôm nay").
--   * ONLY fixed keys — quadrant, word, intensity 1–5, activity (+ cause / understood_at for
--     S-BY3). There is NO column for anything the child types (D1).
--   * NO browser grant at all (§3): not the child, not the parents, not anon. The child reads,
--     writes and deletes their own rows only through /api/by/* (server, service_role) behind
--     the Góc bình yên session. There is no page and no policy for parents.
--   * client_run_id UNIQUE: tapping "Xong" twice stores one row.
--   * Deleting is a real delete (Q7). Auto-delete after 12 months: later (cron), not here.
--   * The A9 backup already leaves out the DATA of every public.by_* table (D6, backup.yml).
-- The fixed lists themselves (words, activities, weights) stay in lib/binhYen/catalog.ts in
-- this slice; a by_catalog table comes with the parent editor (S-BY3).

create table if not exists public.by_checkins (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families (id) on delete cascade,
  child_id       uuid not null references public.profiles (id) on delete cascade,
  local_date     date not null,
  -- Values are checked by the server against the catalog (spec §2.2: no fixed enum, so a new
  -- word or activity never needs a constraint change). These CHECKs are only FORMAT guards
  -- (short lowercase keys), so no free text can ever be stored here.
  quad           text not null check (quad ~ '^[a-z_]{1,16}$'),
  word_key       text not null check (word_key ~ '^[a-z0-9_]{1,40}$'),
  intensity      smallint check (intensity between 1 and 5),
  activity_key   text check (activity_key ~ '^[a-z0-9_]{1,40}$'),
  cause_key      text check (cause_key ~ '^[a-z0-9_]{1,40}$'),
  understood_at  timestamptz,
  client_run_id  uuid not null unique,
  created_at     timestamptz not null default now()
);
create index if not exists by_checkins_child_idx on public.by_checkins (child_id, created_at desc);
-- For the later 12-month auto-delete (Q7).
create index if not exists by_checkins_created_idx on public.by_checkins (created_at);

-- Integrity: the child belongs to the SAME family as the row (same pattern as 0008).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'by_checkins_child_family_fk' and conrelid = 'public.by_checkins'::regclass
  ) then
    alter table public.by_checkins add constraint by_checkins_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

-- Server only: RLS on, NO policy, no grant for browsers (§3: "không grant, không policy").
alter table public.by_checkins enable row level security;
revoke all on public.by_checkins from public, anon, authenticated;
grant all on public.by_checkins to service_role;
