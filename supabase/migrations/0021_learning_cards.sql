-- 0021 L-3 "Học với app" (parent decisions 15/11/2026, deliverables/study-launcher/
-- BAO_CAO_PHU_HUYNH_DESIGN_v1.md §5, Q2/Q4/Q5): one summary card per child / VN day / source
-- (source = 'tutor:toan', later 'tutor:anh' ...) that the Launcher only READS; each learning app
-- keeps its own detail. The Launcher computes nothing: the tutor card comes from the tutor's own
-- rows through a view.
--
-- ADDITIVE and idempotent: one new column with a default (old sessions become Toán), two new
-- views, one new table with grants and policies. Nothing is dropped; 0017 is not edited.
--
-- 1. tutor.study_sessions.subject: which tutor (toan, anh, van, khtn). Default 'toan' because every
--    existing session is the maths tutor. The tutor app sets it when a second subject exists (T-b).
-- 2. tutor.daily_summary_by_subject: tutor.daily_summary (0017) split by subject. Same rights
--    (security_invoker: the caller's RLS on tutor.problems / study_sessions decides the rows).
-- 3. public.learning_cards: the one place the Launcher reads cards from (view over 2.).
-- 4. public.learning_pending_rules: teaching rules waiting for the parents (Q4: approved in the
--    tutor app; the Launcher only counts and links). tutor.teaching_rules is parent-only, so a
--    child gets no row.
-- 5. public.learning_attention: at most 2 short "cần chú ý" lines per child / day / source.
--    PARENTS ONLY read it (Q5: the child never sees these lines, not even through the API).
--    Written only by servers (service_role): the tutor app after a session (slice T-a). Never
--    fed from Góc bình yên.

-- 1 ------------------------------------------------------------------------------------------
alter table tutor.study_sessions add column if not exists subject text not null default 'toan';
alter table tutor.study_sessions drop constraint if exists study_sessions_subject_check;
alter table tutor.study_sessions add constraint study_sessions_subject_check check (subject ~ '^[a-z]{2,12}$');

-- 2 ------------------------------------------------------------------------------------------
create or replace view tutor.daily_summary_by_subject with (security_invoker = true) as
select
  p.family_id,
  p.child_id,
  s.date_vn,
  s.subject,
  count(distinct s.id)                                              as sessions,
  coalesce(sum(extract(epoch from (coalesce(s.ended_at, s.last_seen_at) - s.started_at)) / 60)
           filter (where p.id = first_p.id), 0)::integer            as minutes,
  count(*) filter (where p.status = 'self_solved')                  as self_solved,
  count(*) filter (where p.status = 'saved_for_later')              as saved_for_later,
  count(*) filter (where p.status = 'pending_review')               as pending_review,
  count(*) filter (where p.status = 'abandoned')                    as abandoned
from tutor.problems p
join tutor.study_sessions s on s.id = p.session_id
left join lateral (
  select p2.id from tutor.problems p2 where p2.session_id = s.id order by p2.created_at limit 1
) first_p on true
where p.deleted_at is null and s.deleted_at is null
group by p.family_id, p.child_id, s.date_vn, s.subject;
revoke all on tutor.daily_summary_by_subject from public, anon;
grant select on tutor.daily_summary_by_subject to authenticated, service_role;

-- 3 ------------------------------------------------------------------------------------------
create or replace view public.learning_cards with (security_invoker = true) as
select
  family_id,
  child_id,
  date_vn                      as local_date,
  'tutor:' || subject          as source,
  sessions::integer            as sessions,
  minutes,
  self_solved::integer         as self_solved,
  saved_for_later::integer     as saved_for_later,
  abandoned::integer           as abandoned,
  pending_review::integer      as pending_review
from tutor.daily_summary_by_subject;
revoke all on public.learning_cards from public, anon, authenticated;
grant select on public.learning_cards to authenticated, service_role;

-- 4 ------------------------------------------------------------------------------------------
create or replace view public.learning_pending_rules with (security_invoker = true) as
select family_id, child_id, 'tutor'::text as app, count(*)::integer as pending
from tutor.teaching_rules
where status = 'proposed' and deleted_at is null
group by family_id, child_id;
revoke all on public.learning_pending_rules from public, anon, authenticated;
grant select on public.learning_pending_rules to authenticated, service_role;

-- 5 ------------------------------------------------------------------------------------------
create table if not exists public.learning_attention (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  child_id    uuid not null references public.profiles (id) on delete cascade,
  local_date  date not null,
  source      text not null,
  slot        smallint not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint learning_attention_source check (source ~ '^[a-z]+:[a-z0-9-]{2,24}$'),
  constraint learning_attention_slot check (slot in (1, 2)),
  constraint learning_attention_body check (char_length(btrim(body)) between 1 and 160),
  -- At most 2 lines per child / day / source: one row per slot (the app upserts on it).
  constraint learning_attention_one_per_slot unique (child_id, local_date, source, slot)
);
create index if not exists learning_attention_family_date_idx on public.learning_attention (family_id, local_date);

-- Integrity: the child belongs to the SAME family as the row (same pattern as 0014 / 0020).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'learning_attention_child_family_fk' and conrelid = 'public.learning_attention'::regclass) then
    alter table public.learning_attention add constraint learning_attention_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.learning_attention enable row level security;

revoke all on public.learning_attention from public, anon, authenticated;
grant select on public.learning_attention to authenticated;
grant all on public.learning_attention to service_role;

-- Parents of the family read; children have NO policy (Q5), so they read nothing.
drop policy if exists parent_select on public.learning_attention;
create policy parent_select on public.learning_attention
  for select to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id());
