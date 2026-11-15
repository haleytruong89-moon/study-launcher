-- 0018_tutor_g2.sql — Gia sư AI Toán, lát G2 (gia-su-ai-math DOMAIN v0.5 §4.2, §4.14, §5).
-- Additive and idempotent. Children keep read-only access: the table-level grants of 0017 cover
-- the new columns, and every write still goes through the tutor server (service role).

-- Why a tutor turn ran on the stronger model (Opus), shown in the evening report (D28, D29).
alter table tutor.model_calls add column if not exists route_reason text;
alter table tutor.model_calls drop constraint if exists model_calls_route_reason_check;
alter table tutor.model_calls add constraint model_calls_route_reason_check check (route_reason is null or route_reason in
  ('guard_blocked', 'nan', 'hint_h3', 'tutor_unsure', 'sticky', 'geometry_proof', 'exam_slot_hard', 'opus_paused'));

-- How the child sent a message: typed, a button, or "nộp bài" (final answer). The nản rule needs it (§4.2).
alter table tutor.messages add column if not exists input_kind text not null default 'text';
alter table tutor.messages drop constraint if exists messages_input_kind_check;
alter table tutor.messages add constraint messages_input_kind_check check (input_kind in ('text', 'button', 'submit'));

-- Off-topic turns in a problem: the third one closes it as closed_offtopic (§5).
alter table tutor.problems add column if not exists offtopic_count integer not null default 0;
alter table tutor.problems drop constraint if exists problems_offtopic_count_check;
alter table tutor.problems add constraint problems_offtopic_count_check check (offtopic_count >= 0);
