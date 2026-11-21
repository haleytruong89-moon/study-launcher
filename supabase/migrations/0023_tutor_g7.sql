-- 0023 G7 of the maths tutor (repo gia-su-ai-math, plan docs/superpowers/plans/2026-11-18-g7-reports.md;
-- parent decisions 18/11/2026: D23 money-only pushes, X1–X5).
--
-- ADDITIVE and idempotent. No data is dropped. Two CHECK constraints are (re)created: one new
-- (rule text length) and one widened (model_calls.purpose gains 'reference').
--
-- 1. public.learning_cards.report_path: the tutor now has a parents' evening report page, so the
--    Launcher's "Học với app" card shows "Xem báo cáo ›". Same columns, same order as 0021.
-- 2. tutor.teaching_rules.source_key / source_ids: where a PROPOSED rule came from (a parent note,
--    or two 😕 ratings with the same reason) so the tutor never proposes the same rule twice.
--    Rule text 1–300 characters (X3).
-- 3. tutor.usage_monthly.console_alert_sent_at: "Console out of money" push at most once a day (D23).
-- 4. tutor.model_calls.purpose += 'reference' (reference solution after self_solved, P4/X5).
-- 5. tutor.add_usage(family, month, cost): atomic monthly spend, replaces the tutor app's
--    read-then-write (lost a cent when both children answered at the same instant).
--    EXECUTE for service_role only: children and parents cannot call it.

-- 1 ------------------------------------------------------------------------------------------
create or replace view public.learning_cards with (security_invoker = true) as
select
  family_id,
  child_id,
  date_vn                      as local_date,
  'tutor:' || subject          as source,
  sessions::integer            as sessions,
  minutes,
  problems::integer            as problems,
  self_solved::integer         as self_solved,
  saved_for_later::integer     as saved_for_later,
  abandoned::integer           as abandoned,
  pending_review::integer      as pending_review,
  -- The tutor's evening report for that day (both children on one page; parents only).
  '/gia-su/bo-me/bao-cao?ngay=' || date_vn::text as report_path
from tutor.daily_summary_by_subject;
revoke all on public.learning_cards from public, anon, authenticated;
grant select on public.learning_cards to authenticated, service_role;

-- 2 ------------------------------------------------------------------------------------------
alter table tutor.teaching_rules add column if not exists source_key text;
alter table tutor.teaching_rules add column if not exists source_ids uuid[] not null default '{}';
alter table tutor.teaching_rules drop constraint if exists teaching_rules_text_len;
alter table tutor.teaching_rules add constraint teaching_rules_text_len check (char_length(text) between 1 and 300);
create index if not exists teaching_rules_child_status_idx on tutor.teaching_rules (child_id, status);

-- 3 ------------------------------------------------------------------------------------------
alter table tutor.usage_monthly add column if not exists console_alert_sent_at timestamptz;

-- 4 ------------------------------------------------------------------------------------------
alter table tutor.model_calls drop constraint if exists model_calls_purpose_check;
alter table tutor.model_calls add constraint model_calls_purpose_check
  check (purpose in ('tutor', 'guard', 'classify', 'sibling', 'report', 'rules', 'reference'));

-- 5 ------------------------------------------------------------------------------------------
create or replace function tutor.add_usage(p_family uuid, p_month date, p_cost numeric)
returns numeric
language sql
set search_path = ''
as $$
  insert into tutor.usage_monthly as u (family_id, month, cost_usd, updated_at)
  values (p_family, p_month, p_cost, now())
  on conflict (family_id, month) do update
    set cost_usd = u.cost_usd + excluded.cost_usd, updated_at = now()
  returning u.cost_usd;
$$;
revoke all on function tutor.add_usage(uuid, date, numeric) from public, anon, authenticated;
grant execute on function tutor.add_usage(uuid, date, numeric) to service_role;
