-- 0027 Maths tutor: the child flags one tutor message ("Cô sai ở đây").
-- Repo gia-su-ai-math, parent decision 22/11/2026 (D32): during the early pilot (D31) the child can say
-- exactly which tutor message was wrong, what kind of mistake it was, and why. Parents read it in the
-- evening report; the tutor model never sees it.
--
-- ADDITIVE and idempotent: one new table, read-only for browsers. The child writes through the tutor
-- server (service_role), which checks that the message is a tutor message of the child's own problem.
-- No data is dropped.

create table if not exists tutor.message_feedback (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null,
  child_id       uuid not null,
  problem_id     uuid not null references tutor.problems (id) on delete cascade,
  message_id     uuid not null references tutor.messages (id) on delete cascade,
  -- wrong = cô nói sai · gave_answer = cô đưa đáp số / lời giải · unclear = khó hiểu · other = khác
  kind           text not null check (kind in ('wrong', 'gave_answer', 'unclear', 'other')),
  comment        text check (comment is null or char_length(comment) <= 500),
  client_msg_id  uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  deleted_at     timestamptz,
  foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade
);
-- A double tap stores one report.
create unique index if not exists message_feedback_client_msg_uidx on tutor.message_feedback (child_id, client_msg_id)
  where client_msg_id is not null;
create index if not exists message_feedback_family_created_idx on tutor.message_feedback (family_id, created_at);
create index if not exists message_feedback_message_idx on tutor.message_feedback (message_id);

-- Browsers read only; the server does everything.
revoke all on tutor.message_feedback from public, anon, authenticated;
grant all on tutor.message_feedback to service_role;
grant select on tutor.message_feedback to authenticated;

alter table tutor.message_feedback enable row level security;
drop policy if exists message_feedback_child_read on tutor.message_feedback;
create policy message_feedback_child_read on tutor.message_feedback for select to authenticated
  using (tutor.is_own_child(child_id));
drop policy if exists message_feedback_parent_read on tutor.message_feedback;
create policy message_feedback_parent_read on tutor.message_feedback for select to authenticated
  using (tutor.is_family_parent(family_id));
