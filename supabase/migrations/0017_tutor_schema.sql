-- 0017_tutor_schema.sql — schema `tutor` for the AI math tutor (repo gia-su-ai).
-- Decisions: T2 (shared Supabase project, own schema + RLS), D21 (tutor SQL lives in this repo),
-- D22 (schema exposed to the Data API; children read through RLS, every write goes through the
-- gia-su-ai server with service_role). Rules: gia-su-ai docs/DOMAIN.md (hub DOMAIN_v0.4.md) §1–§3.
-- ADDITIVE and idempotent: nothing is dropped, no existing row is changed.
-- Children: SELECT only (except one rating per ended session). Parents: their family.
-- No child name is stored here; the AI only ever sees a child code (HS-9A, HS-6A).

create schema if not exists tutor;
revoke all on schema tutor from public, anon;
grant usage on schema tutor to authenticated, service_role;

-- Helper: "this row belongs to the signed-in child" / "to the signed-in parent's family".
-- security definer, like public.auth_role(): reads only auth.uid() and the caller's own profile.
create or replace function tutor.is_own_child(p_child uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.auth_role() = 'child' and p_child = auth.uid()
$$;
create or replace function tutor.is_family_parent(p_family uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.auth_role() = 'parent' and p_family = public.auth_family_id()
$$;
revoke all on function tutor.is_own_child(uuid) from public, anon;
revoke all on function tutor.is_family_parent(uuid) from public, anon;
grant execute on function tutor.is_own_child(uuid) to authenticated, service_role;
grant execute on function tutor.is_family_parent(uuid) to authenticated, service_role;

-- 1. Teaching profiles and rules (parents only) -------------------------------------------
create table if not exists tutor.teaching_profiles (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null,
  child_id        uuid not null,
  child_code      text not null check (child_code ~ '^HS-[0-9]{1,2}[A-Z]$'),
  grade           smallint not null check (grade in (6, 9)),
  textbook        text not null default 'KNTT',
  current_chapter text,
  max_lines       smallint not null check (max_lines between 2 and 10),
  answer_mode     text not null check (answer_mode in ('buttons_first', 'mixed')),
  profile_text    text not null,
  exam_checklist  jsonb not null default '[]'::jsonb,
  version         integer not null check (version >= 1),
  is_current      boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  deleted_at      timestamptz,
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade,
  unique (child_id, version)
);
create unique index if not exists teaching_profiles_one_current_uidx
  on tutor.teaching_profiles (child_id) where is_current and deleted_at is null;

create table if not exists tutor.teaching_rules (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null,
  child_id     uuid not null,
  text         text not null,
  status       text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'superseded')),
  version      integer not null default 1,
  source       text not null check (source in ('parent_feedback', 'child_rating', 'manual')),
  approved_by  uuid,
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  deleted_at   timestamptz,
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);

-- 2. Sessions (buổi), problems (bài), messages -------------------------------------------
create table if not exists tutor.study_sessions (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null,
  child_id          uuid not null,
  device            text not null check (device in ('ipad', 'boox', 'laptop')),
  status            text not null default 'active' check (status in ('active', 'ended', 'abandoned')),
  date_vn           date not null,
  started_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  ended_at          timestamptz,
  profile_version   integer,
  rules_version     integer,
  prompt_version    text not null,
  knowledge_version text,
  model_main        text not null,
  model_mode        text not null default 'normal' check (model_mode in ('normal', 'economy')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  deleted_at        timestamptz,
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);
-- At most one open session per child (DOMAIN §5: a second device sees "đang mở ở máy khác").
create unique index if not exists study_sessions_one_active_uidx
  on tutor.study_sessions (child_id) where status = 'active';
create index if not exists study_sessions_child_date_idx on tutor.study_sessions (child_id, date_vn);

create table if not exists tutor.problems (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null,
  child_id             uuid not null,
  session_id           uuid not null references tutor.study_sessions (id) on delete cascade,
  status               text not null default 'in_progress' check (status in
                         ('in_progress', 'self_solved', 'pending_review', 'saved_for_later',
                          'closed_offtopic', 'abandoned', 'timed_out')),
  stuck_kind           text check (stuck_kind in ('chua_hieu_de', 'khong_biet_bat_dau', 'lam_do_thi_tac',
                         'ra_ket_qua_sai', 'khong_hieu_buoc')),
  hint_level           smallint not null default 0 check (hint_level between 0 and 5),
  hint_level_max       smallint not null default 0 check (hint_level_max between 0 and 5),
  wrong_count          integer not null default 0,
  turn_count           integer not null default 0 check (turn_count between 0 and 20),
  nan_jumps            integer not null default 0,
  u_level              smallint not null default 0 check (u_level between 0 and 3),
  ku_code              text check (ku_code ~ '^(T6|T9|N7|N8|TH)\.[0-9]{1,2}$'),
  exam_slot            text check (exam_slot ~ '^HN10-[1-5][a-c]?(-y[12])?$'),
  prereq_gaps          text[] not null default '{}',
  knowledge_version    text,
  confirmed_statement  text,
  statement_confirmed  boolean not null default false,
  is_geometry_proof    boolean not null default false,
  continues_problem_id uuid references tutor.problems (id),
  pack_id              uuid,
  item_ref             text,
  closed_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid,
  deleted_at           timestamptz,
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);
create index if not exists problems_session_idx on tutor.problems (session_id);
create index if not exists problems_child_created_idx on tutor.problems (child_id, created_at);

create table if not exists tutor.messages (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null,
  child_id       uuid not null,
  problem_id     uuid not null references tutor.problems (id) on delete cascade,
  role           text not null check (role in ('child', 'tutor', 'system')),
  content        text not null,
  buttons        jsonb not null default '[]'::jsonb,
  hint_level     smallint check (hint_level between 0 and 5),
  client_msg_id  uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  deleted_at     timestamptz,
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);
-- Idempotency (DOMAIN §5): the same child message id is stored once.
create unique index if not exists messages_client_msg_uidx on tutor.messages (child_id, client_msg_id)
  where client_msg_id is not null;
create index if not exists messages_problem_idx on tutor.messages (problem_id, created_at);

-- 3. Server/parent-only logs -----------------------------------------------------------
create table if not exists tutor.model_calls (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null,
  child_id        uuid not null,
  message_id      uuid references tutor.messages (id) on delete cascade,
  problem_id      uuid references tutor.problems (id) on delete cascade,
  purpose         text not null check (purpose in ('tutor', 'guard', 'classify', 'sibling', 'report', 'rules')),
  model           text not null,
  prompt_version  text not null,
  raw_output      text,
  guard_result    text check (guard_result in ('pass', 'rewritten', 'blocked')),
  guard_reasons   text[] not null default '{}',
  tokens_in       integer not null default 0,
  tokens_cached   integer not null default 0,
  tokens_out      integer not null default 0,
  cost_usd        numeric(10,6) not null default 0,
  created_at      timestamptz not null default now(),
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);
create index if not exists model_calls_created_idx on tutor.model_calls (created_at);

create table if not exists tutor.tool_calls (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null,
  child_id       uuid not null,
  model_call_id  uuid references tutor.model_calls (id) on delete cascade,
  problem_id     uuid references tutor.problems (id) on delete cascade,
  tool           text not null check (tool in ('math_check', 'lookup', 'make_sibling', 'draw_figure')),
  input          jsonb not null,
  output         jsonb,
  ok             boolean not null,
  ms             integer,
  created_at     timestamptz not null default now(),
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);
create index if not exists tool_calls_problem_idx on tutor.tool_calls (problem_id);

create table if not exists tutor.reference_solutions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null,
  child_id    uuid not null,
  problem_id  uuid not null unique references tutor.problems (id) on delete cascade,
  content     text not null,
  final_answer text,
  created_at  timestamptz not null default now(),
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);

-- 4. Attachments, diagnoses, ratings, parent feedback ----------------------------------
create table if not exists tutor.attachments (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null,
  child_id       uuid not null,
  problem_id     uuid not null references tutor.problems (id) on delete cascade,
  storage_path   text not null check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  width          integer,
  height         integer,
  bytes          integer check (bytes <= 10485760),
  source_device  text check (source_device in ('ipad', 'boox', 'laptop')),
  delete_after   date not null,
  file_deleted_at timestamptz,
  created_at     timestamptz not null default now(),
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);

create table if not exists tutor.diagnoses (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null,
  child_id    uuid not null,
  problem_id  uuid not null references tutor.problems (id) on delete cascade,
  root        text not null check (root in ('read', 'concept', 'strategy', 'calc', 'careful', 'unknown')),
  source      text not null check (source in ('self_reported', 'verified')),
  ku_code     text,
  note        text,
  created_at  timestamptz not null default now(),
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);

create table if not exists tutor.ratings (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null,
  child_id    uuid not null,
  session_id  uuid not null unique references tutor.study_sessions (id) on delete cascade,
  face        text not null check (face in ('easy', 'ok', 'hard')),
  reasons     text[] not null default '{}' check (reasons <@ array['too_long', 'hard_words', 'answer_too_early',
                'too_many_questions', 'good_example', 'clear']::text[]),
  comment     text check (char_length(comment) <= 500),
  created_at  timestamptz not null default now(),
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);

create table if not exists tutor.parent_feedback (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null,
  child_id    uuid not null,
  problem_id  uuid not null references tutor.problems (id) on delete cascade,
  message_id  uuid references tutor.messages (id) on delete cascade,
  thumb       text not null check (thumb in ('up', 'down')),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);

-- 5. Money (per family, month in UTC like the Console) ---------------------------------
create table if not exists tutor.usage_monthly (
  family_id              uuid not null references public.families (id) on delete cascade,
  month                  date not null check (extract(day from month) = 1),
  cost_usd               numeric(10,6) not null default 0,
  model_mode             text not null default 'normal' check (model_mode in ('normal', 'economy')),
  burn_alert_sent_at     timestamptz,
  economy_alert_sent_at  timestamptz,
  updated_at             timestamptz not null default now(),
  primary key (family_id, month)
);

-- 6. Topic packs, spaced review ---------------------------------------------------------
create table if not exists tutor.topic_packs (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null,
  child_id      uuid not null,
  title         text not null,
  version       integer not null default 1,
  status        text not null default 'draft' check (status in ('draft', 'approved', 'assigned', 'archived')),
  source_docs   text[] not null default '{}',
  content_path  text,
  approved_by   uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  deleted_at    timestamptz,
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);

create table if not exists tutor.review_items (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null,
  child_id        uuid not null,
  ku_code         text not null,
  kind            text not null check (kind in ('formula', 'mini_problem')),
  prompt          text not null,
  answer          text not null,
  answer_check    text not null check (answer_check in ('exact', 'math_check')),
  buttons         jsonb not null default '[]'::jsonb,
  box             smallint not null default 1 check (box between 1 and 4),
  due_date_vn     date not null,
  correct_streak  smallint not null default 0 check (correct_streak between 0 and 3),
  status          text not null default 'active' check (status in ('active', 'paused', 'retired')),
  source          text not null check (source in ('seed', 'diagnosis', 'parent')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  deleted_at      timestamptz,
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);
create index if not exists review_items_due_idx on tutor.review_items (child_id, status, due_date_vn);

create table if not exists tutor.review_attempts (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null,
  child_id        uuid not null,
  review_item_id  uuid not null references tutor.review_items (id) on delete cascade,
  session_id      uuid references tutor.study_sessions (id) on delete set null,
  answer          text,
  result          text not null check (result in ('correct', 'wrong', 'skipped')),
  client_msg_id   uuid,
  created_at      timestamptz not null default now(),
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);
create unique index if not exists review_attempts_client_msg_uidx on tutor.review_attempts (child_id, client_msg_id)
  where client_msg_id is not null;

-- 7. Grants: browsers read only; the server (service_role) does everything ------------------
grant all on all tables in schema tutor to service_role;
grant select on
  tutor.study_sessions, tutor.problems, tutor.messages, tutor.attachments, tutor.diagnoses,
  tutor.ratings, tutor.topic_packs, tutor.review_attempts,
  tutor.teaching_profiles, tutor.teaching_rules, tutor.model_calls, tutor.tool_calls,
  tutor.parent_feedback, tutor.usage_monthly
  to authenticated;
-- review_items: never the `answer` column to any browser (the server grades).
grant select (id, family_id, child_id, ku_code, kind, prompt, buttons, box, due_date_vn, correct_streak,
              status, source, created_at, updated_at, deleted_at)
  on tutor.review_items to authenticated;
-- reference_solutions: no browser grant at all (server sends it after self_solved).
-- The one browser write: a child rates their own ended session once.
grant insert (family_id, child_id, session_id, face, reasons, comment) on tutor.ratings to authenticated;
-- Parents write feedback and approve rules from the browser.
grant insert, update (thumb, note, updated_at) on tutor.parent_feedback to authenticated;
grant update (status, approved_by, approved_at, updated_at) on tutor.teaching_rules to authenticated;

-- 8. RLS: on everywhere, deny by default -----------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['teaching_profiles', 'teaching_rules', 'study_sessions', 'problems', 'messages',
    'model_calls', 'tool_calls', 'reference_solutions', 'attachments', 'diagnoses', 'ratings',
    'parent_feedback', 'usage_monthly', 'topic_packs', 'review_items', 'review_attempts']
  loop
    execute format('alter table tutor.%I enable row level security', t);
  end loop;
end $$;

-- Child reads own rows; parent reads family rows.
do $$
declare t text;
begin
  foreach t in array array['study_sessions', 'problems', 'messages', 'attachments', 'diagnoses', 'ratings',
    'review_items', 'review_attempts']
  loop
    execute format('drop policy if exists %I on tutor.%I', t || '_child_read', t);
    execute format('create policy %I on tutor.%I for select to authenticated using (tutor.is_own_child(child_id))',
                   t || '_child_read', t);
    execute format('drop policy if exists %I on tutor.%I', t || '_parent_read', t);
    execute format('create policy %I on tutor.%I for select to authenticated using (tutor.is_family_parent(family_id))',
                   t || '_parent_read', t);
  end loop;
end $$;

-- Parent-only reads.
do $$
declare t text;
begin
  foreach t in array array['teaching_profiles', 'teaching_rules', 'model_calls', 'tool_calls', 'parent_feedback',
    'usage_monthly']
  loop
    execute format('drop policy if exists %I on tutor.%I', t || '_parent_read', t);
    execute format('create policy %I on tutor.%I for select to authenticated using (tutor.is_family_parent(family_id))',
                   t || '_parent_read', t);
  end loop;
end $$;

-- Topic packs: child sees only assigned packs; parent sees all of the family.
drop policy if exists topic_packs_child_read on tutor.topic_packs;
create policy topic_packs_child_read on tutor.topic_packs for select to authenticated
  using (tutor.is_own_child(child_id) and status = 'assigned' and deleted_at is null);
drop policy if exists topic_packs_parent_read on tutor.topic_packs;
create policy topic_packs_parent_read on tutor.topic_packs for select to authenticated
  using (tutor.is_family_parent(family_id));

-- Ratings: a child inserts one rating for their own ENDED session (unique session_id stops a second).
drop policy if exists ratings_child_insert on tutor.ratings;
create policy ratings_child_insert on tutor.ratings for insert to authenticated
  with check (
    tutor.is_own_child(child_id)
    and family_id = public.auth_family_id()
    and exists (select 1 from tutor.study_sessions s
                where s.id = session_id and s.child_id = auth.uid() and s.status in ('ended', 'abandoned'))
  );

-- Parent feedback and rule approval.
drop policy if exists parent_feedback_parent_insert on tutor.parent_feedback;
create policy parent_feedback_parent_insert on tutor.parent_feedback for insert to authenticated
  with check (tutor.is_family_parent(family_id));
drop policy if exists parent_feedback_parent_update on tutor.parent_feedback;
create policy parent_feedback_parent_update on tutor.parent_feedback for update to authenticated
  using (tutor.is_family_parent(family_id)) with check (tutor.is_family_parent(family_id));
drop policy if exists teaching_rules_parent_update on tutor.teaching_rules;
create policy teaching_rules_parent_update on tutor.teaching_rules for update to authenticated
  using (tutor.is_family_parent(family_id)) with check (tutor.is_family_parent(family_id));

-- 9. Daily summary for the Launcher's evening view (runs with the caller's rights) ---------
create or replace view tutor.daily_summary with (security_invoker = true) as
select
  p.family_id,
  p.child_id,
  s.date_vn,
  count(distinct s.id)                                              as sessions,
  coalesce(sum(extract(epoch from (coalesce(s.ended_at, s.last_seen_at) - s.started_at)) / 60)
           filter (where p.id = first_p.id), 0)::integer            as minutes,
  count(*) filter (where p.status = 'self_solved')                  as self_solved,
  count(*) filter (where p.status = 'saved_for_later')              as saved_for_later,
  count(*) filter (where p.status = 'pending_review')               as pending_review,
  count(*) filter (where p.status = 'abandoned')                    as abandoned,
  count(*) filter (where p.hint_level_max >= 4)                     as reached_h4,
  coalesce(sum(p.nan_jumps), 0)::integer                            as nan_jumps
from tutor.problems p
join tutor.study_sessions s on s.id = p.session_id
left join lateral (
  select p2.id from tutor.problems p2 where p2.session_id = s.id order by p2.created_at limit 1
) first_p on true
where p.deleted_at is null and s.deleted_at is null
group by p.family_id, p.child_id, s.date_vn;
grant select on tutor.daily_summary to authenticated, service_role;
