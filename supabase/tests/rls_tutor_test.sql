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
-- G2 (0018): new columns exist with their defaults, and their CHECK constraints are in place.
do $$
begin
  perform 1 from information_schema.columns
    where table_schema = 'tutor' and table_name = 'model_calls' and column_name = 'route_reason';
  if not found then raise exception 'FAIL: model_calls.route_reason missing'; end if;
  perform 1 from information_schema.columns
    where table_schema = 'tutor' and table_name = 'messages' and column_name = 'input_kind' and column_default like '''text''%';
  if not found then raise exception 'FAIL: messages.input_kind missing or wrong default'; end if;
  perform 1 from information_schema.columns
    where table_schema = 'tutor' and table_name = 'problems' and column_name = 'offtopic_count' and column_default = '0';
  if not found then raise exception 'FAIL: problems.offtopic_count missing or wrong default'; end if;
  perform 1 from pg_constraint
    where conname in ('model_calls_route_reason_check', 'messages_input_kind_check', 'problems_offtopic_count_check')
    having count(*) = 3;
  if not found then raise exception 'FAIL: G2 check constraints missing'; end if;
  raise notice 'ok: tutor: G2 columns';
end $$;
-- A child still cannot write the new column.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
do $$
begin
  begin
    update tutor.problems set offtopic_count = 1;
    raise exception 'FAIL: child updated tutor.problems';
  exception when insufficient_privilege then raise notice 'ok: tutor: child cannot write offtopic_count';
  end;
end $$;

reset role;

-- G3 (0019): private photo bucket with no browser policy; attachments.message_id.
do $$
begin
  perform 1 from storage.buckets
    where id = 'tutor-images' and public = false and file_size_limit = 3145728 and allowed_mime_types = array['image/jpeg'];
  if not found then raise exception 'FAIL: tutor-images bucket missing or not private / 3 MB / jpeg'; end if;
  perform 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and (coalesce(qual, '') ilike '%tutor-images%' or coalesce(with_check, '') ilike '%tutor-images%');
  if found then raise exception 'FAIL: a storage policy opens tutor-images to browsers'; end if;
  perform 1 from information_schema.columns
    where table_schema = 'tutor' and table_name = 'attachments' and column_name = 'message_id';
  if not found then raise exception 'FAIL: attachments.message_id missing'; end if;
  raise notice 'ok: tutor: G3 bucket and column';
end $$;
insert into storage.objects (bucket_id, name) values
  ('tutor-images', '00000000-0000-0000-0000-0000000000c1/31000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000001.jpg');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select test_helpers.expect_count('tutor: child1 cannot list own photo files directly (server-only bucket)',
  (select count(*) from storage.objects where bucket_id = 'tutor-images'), 0);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select test_helpers.expect_count('tutor: parent cannot list photo files directly either',
  (select count(*) from storage.objects where bucket_id = 'tutor-images'), 0);
reset role;
-- L-3 (0021): learning cards (view over tutor rows), pending rules, "cần chú ý" lines (parents only).
insert into tutor.teaching_rules (family_id, child_id, text, status, source) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Gợi ý ngắn hơn', 'proposed', 'parent_feedback'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Đã duyệt', 'approved', 'manual'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'Nhà B', 'proposed', 'manual');
insert into public.learning_attention (family_id, child_id, local_date, source, slot, body) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, 'tutor:toan', 1, 'An thấy bài này dài, khó hiểu'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', current_date, 'tutor:toan', 1, 'Nhà B');
do $$
begin
  perform 1 from information_schema.columns
    where table_schema = 'tutor' and table_name = 'study_sessions' and column_name = 'subject' and column_default like '''toan''%';
  if not found then raise exception 'FAIL: study_sessions.subject missing or wrong default'; end if;
  -- A third line for the same child / day / source cannot exist (slot 1 or 2 only, one row each).
  begin
    insert into public.learning_attention (family_id, child_id, local_date, source, slot, body)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, 'tutor:toan', 3, 'x');
    raise exception 'FAIL: slot 3 accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.learning_attention (family_id, child_id, local_date, source, slot, body)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, 'tutor:toan', 1, 'again');
    raise exception 'FAIL: two rows in one slot';
  exception when unique_violation then null;
  end;
  -- The child must belong to the row's family.
  begin
    insert into public.learning_attention (family_id, child_id, local_date, source, slot, body)
      values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c1', current_date, 'tutor:toan', 2, 'x');
    raise exception 'FAIL: cross-family attention row accepted';
  exception when foreign_key_violation then null;
  end;
  raise notice 'ok: L-3 column and attention constraints';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test_helpers.expect_count('L-3: child1 sees own learning card', (select count(*) from public.learning_cards), 1);
select test_helpers.expect_count('L-3: child1 card is tutor:toan', (select count(*) from public.learning_cards where source = 'tutor:toan' and child_id = '00000000-0000-0000-0000-0000000000c1'), 1);
select test_helpers.expect_count('L-3: child1 reads NO attention line (Q5)', (select count(*) from public.learning_attention), 0);
select test_helpers.expect_count('L-3: child1 sees no pending rules', (select count(*) from public.learning_pending_rules), 0);
do $$
begin
  begin
    insert into public.learning_attention (family_id, child_id, local_date, source, slot, body)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, 'tutor:toan', 2, 'tự viết');
    raise exception 'FAIL: child wrote learning_attention';
  exception when insufficient_privilege then raise notice 'ok: L-3: child cannot write attention';
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select test_helpers.expect_count('L-3: parentA sees both children cards', (select count(*) from public.learning_cards), 2);
select test_helpers.expect_count('L-3: parentA reads own family attention', (select count(*) from public.learning_attention), 1);
select test_helpers.expect_count('L-3: parentA pending rules = 1 (proposed only)', (select coalesce(sum(pending), 0) from public.learning_pending_rules), 1);
do $$
begin
  begin
    update public.learning_attention set body = 'sửa';
    raise exception 'FAIL: parent updated learning_attention';
  exception when insufficient_privilege then raise notice 'ok: L-3: parent cannot write attention (server only)';
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select test_helpers.expect_count('L-3: parentB sees only family B card', (select count(*) from public.learning_cards), 1);
select test_helpers.expect_count('L-3: parentB attention only family B', (select count(*) from public.learning_attention where family_id = '10000000-0000-0000-0000-00000000000a'), 0);
select test_helpers.expect_count('L-3: parentB pending rules only family B', (select coalesce(sum(pending), 0) from public.learning_pending_rules), 1);

reset role;
set role anon;
do $$
begin
  begin
    perform 1 from public.learning_cards;
    raise exception 'FAIL: anon read learning_cards';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.learning_attention;
    raise exception 'FAIL: anon read learning_attention';
  exception when insufficient_privilege then raise notice 'ok: L-3: anon has no access';
  end;
end $$;
reset role;
-- G7 (0023): report link, rule sources, console alert column, purpose 'reference', atomic add_usage (server only).
do $$
declare v numeric;
begin
  perform 1 from public.learning_cards
    where child_id = '00000000-0000-0000-0000-0000000000c1'
      and report_path = '/gia-su/bo-me/bao-cao?ngay=' || local_date::text;
  if not found then raise exception 'FAIL: learning_cards.report_path not set'; end if;
  insert into tutor.teaching_rules (family_id, child_id, text, status, source, source_key, source_ids) values
    ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Mỗi lượt chỉ hỏi con một câu.', 'proposed',
     'child_rating', 'rating:too_many_questions', array['30000000-0000-0000-0000-000000000001']::uuid[]);
  begin
    insert into tutor.teaching_rules (family_id, child_id, text, status, source)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', repeat('x', 301), 'proposed', 'manual');
    raise exception 'FAIL: rule longer than 300 accepted';
  exception when check_violation then null;
  end;
  insert into tutor.model_calls (family_id, child_id, problem_id, purpose, model, prompt_version)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '31000000-0000-0000-0000-000000000001', 'reference', 'sonnet', 'p0.7');
  update tutor.usage_monthly set console_alert_sent_at = now() where family_id = '10000000-0000-0000-0000-00000000000a';
  v := tutor.add_usage('10000000-0000-0000-0000-00000000000a', date_trunc('month', now())::date, 0.25);
  if v <> 1.75 then raise exception 'FAIL: add_usage total % (expected 1.75)', v; end if;
  v := tutor.add_usage('10000000-0000-0000-0000-00000000000b', date '2026-01-01', 0.5);
  if v <> 0.5 then raise exception 'FAIL: add_usage new row %', v; end if;
  raise notice 'ok: G7 report path, rule sources, reference purpose, add_usage';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$
begin
  begin
    perform tutor.add_usage('10000000-0000-0000-0000-00000000000a', date '2026-01-01', 1);
    raise exception 'FAIL: child called add_usage';
  exception when insufficient_privilege then raise notice 'ok: G7: child cannot call add_usage';
  end;
end $$;
reset role;
set role service_role;
select test_helpers.expect_count('G7: service_role adds usage (1.75 + 0.25 = 2)',
  (select (tutor.add_usage('10000000-0000-0000-0000-00000000000a', date_trunc('month', now())::date, 0.25) * 100)::bigint), 200);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$
begin
  begin
    perform tutor.add_usage('10000000-0000-0000-0000-00000000000a', date '2026-01-01', 1);
    raise exception 'FAIL: parent called add_usage';
  exception when insufficient_privilege then raise notice 'ok: G7: parent cannot call add_usage';
  end;
end $$;
reset role;
-- G6 (0024): card reference on messages; review questions from approved teaching cards.
do $$
declare m uuid;
begin
  select id into m from tutor.messages limit 1;
  if m is null then raise exception 'FAIL: test data has no message'; end if;
  update tutor.messages set card_ref = 'T6.12#1' where id = m;
  update tutor.messages set card_ref = 'D9.1#2' where id = m;
  begin
    update tutor.messages set card_ref = 'T6.12#3' where id = m;
    raise exception 'FAIL: bad card_ref accepted';
  exception when check_violation then null;
  end;
  insert into tutor.review_items (family_id, child_id, ku_code, kind, prompt, answer, answer_check, buttons, due_date_vn, source, card_code, item_key)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'T6.12', 'why',
          'Vì sao BCNN lấy mũ cao nhất?', 'b', 'exact', '["a","b","c"]', current_date, 'card', 'T6.12', 'why1');
  insert into tutor.review_items (family_id, child_id, ku_code, kind, prompt, answer, answer_check, due_date_vn, source, card_code, item_key)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'T6.11', 'recognize',
          'Dùng kiến thức nào?', 'ƯCLN', 'exact', current_date, 'card', 'D6.1', 'rec1');
  begin
    insert into tutor.review_items (family_id, child_id, ku_code, kind, prompt, answer, answer_check, due_date_vn, source, card_code, item_key)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'T6.12', 'recognize',
            'x', 'y', 'exact', current_date, 'card', 'T6.12', 'why1');
    raise exception 'FAIL: duplicate card review item accepted';
  exception when unique_violation then null;
  end;
  raise notice 'ok: G6 card_ref, review kinds why/recognize, source card, one item per (child, card, key)';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$
begin
  perform card_code, item_key, kind from tutor.review_items limit 1;
  begin
    perform answer from tutor.review_items limit 1;
    raise exception 'FAIL: child reads review answers';
  exception when insufficient_privilege then raise notice 'ok: G6: child reads card_code but never the answer';
  end;
end $$;
reset role;
-- D32 (0027): the child flags a tutor message; server writes, browsers only read.
insert into tutor.message_feedback (family_id, child_id, problem_id, message_id, kind, comment)
  select family_id, child_id, problem_id, id, 'gave_answer', 'cô nói luôn đáp số'
  from tutor.messages where child_id = '00000000-0000-0000-0000-0000000000c1' limit 1;
do $$
begin
  begin
    insert into tutor.message_feedback (family_id, child_id, problem_id, message_id, kind)
      select family_id, child_id, problem_id, id, 'bad' from tutor.messages limit 1;
    raise exception 'FAIL: bad feedback kind accepted';
  exception when check_violation then null;
  end;
  raise notice 'ok: D32 message_feedback kinds';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test_helpers.expect_count('D32: child1 sees own message feedback', (select count(*) from tutor.message_feedback), 1);
do $$
begin
  begin
    insert into tutor.message_feedback (family_id, child_id, problem_id, message_id, kind)
      select family_id, child_id, problem_id, id, 'wrong' from tutor.messages limit 1;
    raise exception 'FAIL: child inserted feedback directly';
  exception when insufficient_privilege then raise notice 'ok: D32: child writes feedback only through the server';
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select test_helpers.expect_count('D32: child2 cannot see sibling feedback', (select count(*) from tutor.message_feedback), 0);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select test_helpers.expect_count('D32: parent sees family feedback', (select count(*) from tutor.message_feedback), 1);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select test_helpers.expect_count('D32: other family sees nothing', (select count(*) from tutor.message_feedback), 0);
reset role;
do $$ begin raise notice 'TUTOR RLS OK'; end $$;
