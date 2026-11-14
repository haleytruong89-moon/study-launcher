-- RLS test for schema `tutor` (0017_tutor_schema.sql; gia-su-ai docs/DOMAIN.md §2 rule 7).
-- Runs after rls_test.sql in the same throwaway database (reuses its families, profiles and
-- test_helpers.expect_count). Prints "TUTOR RLS OK" at the end.

\set ON_ERROR_STOP on
reset role;

create schema if not exists test_helpers;
grant usage on schema test_helpers to public;
create or replace function test_helpers.expect_count(label text, actual bigint, expected bigint) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (expected %, got %)', label, expected, actual;
  end if;
  raise notice 'ok: %', label;
end $$;
grant execute on function test_helpers.expect_count(text, bigint, bigint) to public;

-- Fixtures (superuser) ---------------------------------------------------------------
insert into tutor.study_sessions (id, family_id, child_id, device, status, date_vn, prompt_version, model_main) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'ipad',   'ended',  current_date, 'p0.2', 'sonnet'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', 'laptop', 'active', current_date, 'p0.2', 'sonnet'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'ipad',   'ended',  current_date, 'p0.2', 'sonnet')
on conflict do nothing;

insert into tutor.problems (id, family_id, child_id, session_id, ku_code, exam_slot) values
  ('31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-000000000001', 'T9.9', 'HN10-2c'),
  ('31000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', '30000000-0000-0000-0000-000000000002', 'T6.12', null),
  ('31000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-000000000003', null, null)
on conflict do nothing;

insert into tutor.messages (family_id, child_id, problem_id, role, content) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '31000000-0000-0000-0000-000000000001', 'tutor', 'm1'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', '31000000-0000-0000-0000-000000000002', 'tutor', 'm2');

insert into tutor.model_calls (family_id, child_id, problem_id, purpose, model, prompt_version, raw_output) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '31000000-0000-0000-0000-000000000001', 'tutor', 'sonnet', 'p0.2', 'raw');
insert into tutor.tool_calls (family_id, child_id, problem_id, tool, input, ok) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '31000000-0000-0000-0000-000000000001', 'math_check', '{}', true);
insert into tutor.reference_solutions (family_id, child_id, problem_id, content) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '31000000-0000-0000-0000-000000000001', 'secret solution')
on conflict do nothing;
insert into tutor.review_items (family_id, child_id, ku_code, kind, prompt, answer, answer_check, due_date_vn, source) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'N8.02', 'formula', 'a² − b² = ?', '(a-b)*(a+b)', 'math_check', current_date, 'seed');
insert into tutor.usage_monthly (family_id, month, cost_usd) values
  ('10000000-0000-0000-0000-00000000000a', date_trunc('month', now())::date, 1.5)
on conflict do nothing;

-- Child 1 ------------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);

select test_helpers.expect_count('tutor: child1 sees only own session',  (select count(*) from tutor.study_sessions), 1);
select test_helpers.expect_count('tutor: child1 sees only own problem',  (select count(*) from tutor.problems), 1);
select test_helpers.expect_count('tutor: child1 sees only own messages', (select count(*) from tutor.messages), 1);
select test_helpers.expect_count('tutor: child1 sees no model_calls',    (select count(*) from tutor.model_calls), 0);
select test_helpers.expect_count('tutor: child1 sees no tool_calls',     (select count(*) from tutor.tool_calls), 0);
select test_helpers.expect_count('tutor: child1 sees no usage',          (select count(*) from tutor.usage_monthly), 0);
select test_helpers.expect_count('tutor: child1 sees no teaching profile', (select count(*) from tutor.teaching_profiles), 0);
select test_helpers.expect_count('tutor: child1 sees own review item prompt', (select count(*) from tutor.review_items where prompt is not null), 1);
select test_helpers.expect_count('tutor: daily_summary child1 own row only', (select count(*) from tutor.daily_summary), 1);

do $$
begin
  begin
    perform content from tutor.reference_solutions;
    raise exception 'FAIL: child read reference_solutions';
  exception when insufficient_privilege then raise notice 'ok: tutor: child cannot read reference_solutions';
  end;
  begin
    perform answer from tutor.review_items;
    raise exception 'FAIL: child read review_items.answer';
  exception when insufficient_privilege then raise notice 'ok: tutor: child cannot read review answer';
  end;
  begin
    update tutor.problems set hint_level = 5;
    raise exception 'FAIL: child updated hint_level';
  exception when insufficient_privilege then raise notice 'ok: tutor: child cannot write hint_level';
  end;
  begin
    update tutor.problems set status = 'self_solved';
    raise exception 'FAIL: child updated status';
  exception when insufficient_privilege then raise notice 'ok: tutor: child cannot write status';
  end;
  begin
    insert into tutor.messages (family_id, child_id, problem_id, role, content)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '31000000-0000-0000-0000-000000000001', 'child', 'x');
    raise exception 'FAIL: child inserted a message directly';
  exception when insufficient_privilege then raise notice 'ok: tutor: child cannot insert messages';
  end;
end $$;

-- Rating: own ended session once; never a sibling's or an active one.
insert into tutor.ratings (family_id, child_id, session_id, face)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-000000000001', 'easy');
select test_helpers.expect_count('tutor: child1 rated own ended session', (select count(*) from tutor.ratings), 1);
do $$
begin
  begin
    insert into tutor.ratings (family_id, child_id, session_id, face)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-000000000001', 'hard');
    raise exception 'FAIL: second rating accepted';
  exception when unique_violation then raise notice 'ok: tutor: one rating per session';
  end;
  begin
    insert into tutor.ratings (family_id, child_id, session_id, face)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', '30000000-0000-0000-0000-000000000002', 'ok');
    raise exception 'FAIL: child rated sibling session';
  exception when insufficient_privilege then raise notice 'ok: tutor: child cannot rate sibling session';
  end;
end $$;

-- Child 2 (active session; cannot rate it) ---------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select test_helpers.expect_count('tutor: child2 cannot see child1 problem', (select count(*) from tutor.problems where child_id = '00000000-0000-0000-0000-0000000000c1'), 0);
select test_helpers.expect_count('tutor: child2 cannot see child1 rating', (select count(*) from tutor.ratings), 0);
do $$
begin
  begin
    insert into tutor.ratings (family_id, child_id, session_id, face)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', '30000000-0000-0000-0000-000000000002', 'ok');
    raise exception 'FAIL: child rated an active session';
  exception when insufficient_privilege then raise notice 'ok: tutor: no rating while session active';
  end;
end $$;

-- Parent A ------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select test_helpers.expect_count('tutor: parentA sees both children problems', (select count(*) from tutor.problems), 2);
select test_helpers.expect_count('tutor: parentA sees model_calls',            (select count(*) from tutor.model_calls), 1);
select test_helpers.expect_count('tutor: parentA sees usage',                  (select count(*) from tutor.usage_monthly), 1);
select test_helpers.expect_count('tutor: parentA daily_summary 2 rows',        (select count(*) from tutor.daily_summary), 2);
select test_helpers.expect_count('tutor: parentA cannot see family B',         (select count(*) from tutor.problems where family_id = '10000000-0000-0000-0000-00000000000b'), 0);
insert into tutor.parent_feedback (family_id, child_id, problem_id, thumb, note)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '31000000-0000-0000-0000-000000000001', 'up', 'tốt');
select test_helpers.expect_count('tutor: parentA wrote feedback', (select count(*) from tutor.parent_feedback), 1);

-- Parent B cannot see family A ----------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select test_helpers.expect_count('tutor: parentB sees only family B problems', (select count(*) from tutor.problems), 1);
select test_helpers.expect_count('tutor: parentB sees no family A feedback',   (select count(*) from tutor.parent_feedback), 0);

-- Anonymous: nothing -------------------------------------------------------------------
reset role;
set role anon;
do $$
begin
  begin
    perform 1 from tutor.problems;
    raise exception 'FAIL: anon read tutor.problems';
  exception when insufficient_privilege then raise notice 'ok: tutor: anon has no access';
  end;
end $$;

reset role;
do $$ begin raise notice 'TUTOR RLS OK'; end $$;
