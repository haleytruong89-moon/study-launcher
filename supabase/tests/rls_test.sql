-- RLS smoke test for DESIGN section 11. Run after 0001_init.sql (applied twice to prove idempotency).
-- Raises an exception on the first violated expectation; prints "RLS OK" at the end.
-- Run with:  psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql

\set ON_ERROR_STOP on

-- Fixtures (as superuser, bypassing RLS) -------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- parent A
  ('00000000-0000-0000-0000-0000000000c1'),  -- child 1 (family A)
  ('00000000-0000-0000-0000-0000000000c2'),  -- child 2 (family A)
  ('00000000-0000-0000-0000-0000000000b1'),  -- parent B
  ('00000000-0000-0000-0000-0000000000d1')   -- child of family B
on conflict do nothing;

insert into public.families (id, name) values ('10000000-0000-0000-0000-00000000000a', 'Family A')
on conflict do nothing;

-- v1 allows only one family: a second one must be rejected ...
do $$
begin
  begin
    insert into public.families (id, name) values ('10000000-0000-0000-0000-00000000000b', 'Family B');
    raise exception 'FAIL: second family accepted';
  exception when unique_violation then raise notice 'ok: only one family allowed';
  end;
end $$;

-- ... but the cross-family tests below need two, so lift the singleton rule for this throwaway DB only.
drop index public.families_singleton_idx;
insert into public.families (id, name) values ('10000000-0000-0000-0000-00000000000b', 'Family B')
on conflict do nothing;

insert into public.profiles (id, family_id, role, display_name, pin_hash) values
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'parent', 'Parent A', 'secret-a'),
  ('00000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a', 'child',  'Child 1',  'secret-c1'),
  ('00000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-00000000000a', 'child',  'Child 2',  'secret-c2'),
  ('00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'parent', 'Parent B', 'secret-b'),
  ('00000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000b', 'child',  'Child B',  'secret-d')
on conflict do nothing;

select public.seed_family_defaults('10000000-0000-0000-0000-00000000000a', 'launcher.example.com');
select public.seed_family_defaults('10000000-0000-0000-0000-00000000000a', 'launcher.example.com'); -- twice: idempotent
select public.seed_family_defaults('10000000-0000-0000-0000-00000000000b', 'launcher.example.com');

insert into public.homework_items (id, family_id, child_id, subject, due_date) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Toán', current_date),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', 'Văn',  current_date),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'Anh',  current_date)
on conflict do nothing;

insert into public.day_sessions (child_id, local_date, family_id) values
  ('00000000-0000-0000-0000-0000000000c1', current_date, '10000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c2', current_date, '10000000-0000-0000-0000-00000000000a')
on conflict do nothing;

insert into public.app_slots (family_id, child_id, subject, kind, label) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Toán', 'external', 'slot of child 1'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', 'Văn',  'external', 'slot of child 2');

insert into public.extension_devices (family_id, child_id, token_hash) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'hash-1');

insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-0000000000c1', 'https://push.example/1', 'k', 'a')
on conflict do nothing;

insert into storage.buckets (id, name, public) values ('homework', 'homework', false), ('proofs', 'proofs', false)
on conflict do nothing;
insert into storage.objects (bucket_id, name) values
  ('homework', '10000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/2026-10-14/a.jpg'),
  ('homework', '10000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c2/2026-10-14/b.jpg'),
  ('proofs',   '10000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/2026-10-14/p.jpg'),
  ('homework', '10000000-0000-0000-0000-00000000000b/00000000-0000-0000-0000-0000000000d1/2026-10-14/c.jpg');

-- 0003 fixtures: plans + weekly reviews for child 1, child 2 and family B
insert into public.day_plans (child_id, family_id, local_date, item_keys) values
  ('00000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a', '2026-10-17', '{homework:a}'),
  ('00000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-00000000000a', '2026-10-17', '{homework:b}'),
  ('00000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000b', '2026-10-17', '{homework:c}');
insert into public.weekly_reviews (child_id, family_id, week_start, went_well) values
  ('00000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a', '2026-10-12', 'làm sớm'),
  ('00000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-00000000000a', '2026-10-12', 'đọc sách'),
  ('00000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000b', '2026-10-12', 'x');

-- Test helpers ---------------------------------------------------------------
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

-- Child 1 --------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);

select test_helpers.expect_count('child1 sees only own homework',        (select count(*) from public.homework_items), 1);
select test_helpers.expect_count('child1 cannot see sibling day_session', (select count(*) from public.day_sessions where child_id = '00000000-0000-0000-0000-0000000000c2'), 0);
select test_helpers.expect_count('child1 sees only own profile',          (select count(*) from public.profiles), 1);
select test_helpers.expect_count('child1 sees only own app slot',         (select count(*) from public.app_slots), 1);
select test_helpers.expect_count('child1 sees family allowlist (6)',      (select count(*) from public.allowlist_entries), 6);
select test_helpers.expect_count('child1 sees family_settings',           (select count(*) from public.family_settings), 1);
select test_helpers.expect_count('child1 sees no extension devices',      (select count(*) from public.extension_devices), 0);
select test_helpers.expect_count('child1 sees no audit log',              (select count(*) from public.audit_log), 0);
select test_helpers.expect_count('child1 sees own storage only (2 objs: homework + proofs)', (select count(*) from storage.objects), 2);

do $$
begin
  begin
    insert into public.day_sessions (child_id, local_date, family_id)
    values ('00000000-0000-0000-0000-0000000000c1', current_date + 1, '10000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: child inserted into day_sessions';
  exception when insufficient_privilege then raise notice 'ok: child cannot insert day_sessions';
  end;

  update public.homework_items set done_at = now();
  if found then raise exception 'FAIL: child updated homework_items'; end if;
  raise notice 'ok: child cannot update homework_items (0 rows)';

  update public.family_settings set homework_min_upcoming = 0;
  if found then raise exception 'FAIL: child updated family_settings'; end if;
  raise notice 'ok: child cannot update family_settings (0 rows)';

  delete from public.allowlist_entries;
  if found then raise exception 'FAIL: child deleted allowlist_entries'; end if;
  raise notice 'ok: child cannot delete allowlist_entries (0 rows)';

  begin
    perform pin_hash from public.profiles;
    raise exception 'FAIL: child read pin_hash';
  exception when insufficient_privilege then raise notice 'ok: child cannot read pin_hash';
  end;

  begin
    perform 1 from public.push_subscriptions;
    raise exception 'FAIL: child read push_subscriptions';
  exception when insufficient_privilege then raise notice 'ok: child cannot read push_subscriptions';
  end;

  begin
    update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-0000000000c1';
    if found then raise exception 'FAIL: child updated own profile'; end if;
    raise notice 'ok: child cannot update own profile (0 rows)';
  end;
end $$;

-- Child 1 must not be able to write another child's proof folder
do $$
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('proofs', '10000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c2/2026-10-14/x.jpg');
    raise exception 'FAIL: child wrote into sibling proof folder';
  exception when insufficient_privilege or check_violation then raise notice 'ok: child cannot write sibling proof folder';
  end;
  insert into storage.objects (bucket_id, name)
  values ('proofs', '10000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/2026-10-14/mine.jpg');
  raise notice 'ok: child can write own proof folder';
  begin
    insert into storage.objects (bucket_id, name)
    values ('homework', '10000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/2026-10-14/z.jpg');
    raise exception 'FAIL: child wrote into homework bucket';
  exception when insufficient_privilege or check_violation then raise notice 'ok: child cannot write homework bucket';
  end;
end $$;

-- Anonymous ------------------------------------------------------------------
reset role;
set role anon;
do $$
begin
  begin
    perform 1 from public.families;
    raise exception 'FAIL: anon read families';
  exception when insufficient_privilege then raise notice 'ok: anon cannot read families';
  end;
  perform public.ping();
  raise notice 'ok: anon can call ping()';
end $$;

-- Parent A -------------------------------------------------------------------
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);

select test_helpers.expect_count('parentA sees family A profiles (3)',   (select count(*) from public.profiles), 3);
select test_helpers.expect_count('parentA sees family A homework (2)',   (select count(*) from public.homework_items), 2);
select test_helpers.expect_count('parentA sees family A devices (1)',    (select count(*) from public.extension_devices), 1);
select test_helpers.expect_count('parentA sees no family B homework',    (select count(*) from public.homework_items where family_id = '10000000-0000-0000-0000-00000000000b'), 0);
select test_helpers.expect_count('parentA sees family A storage (4 incl. new proof of child 1)', (select count(*) from storage.objects), 4);

do $$
begin
  update public.homework_items set note = 'edited by parent' where family_id = '10000000-0000-0000-0000-00000000000a';
  if not found then raise exception 'FAIL: parent could not update own family homework'; end if;
  raise notice 'ok: parent can update own family homework';

  update public.homework_items set note = 'cross-family' where family_id = '10000000-0000-0000-0000-00000000000b';
  if found then raise exception 'FAIL: parent updated other family'; end if;
  raise notice 'ok: parent cannot update other family homework';

  begin
    insert into public.homework_items (family_id, child_id, subject, due_date)
    values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'x', current_date);
    raise exception 'FAIL: parent inserted into other family';
  exception when insufficient_privilege then raise notice 'ok: parent cannot insert into other family';
  end;

  begin
    perform pin_hash from public.profiles;
    raise exception 'FAIL: parent read pin_hash';
  exception when insufficient_privilege then raise notice 'ok: parent cannot read pin_hash';
  end;

  begin
    perform token_hash from public.extension_devices;
    raise exception 'FAIL: parent read token_hash';
  exception when insufficient_privilege then raise notice 'ok: parent cannot read token_hash';
  end;

  begin
    perform public.seed_family_defaults('10000000-0000-0000-0000-00000000000a', 'x.example.com');
    raise exception 'FAIL: parent called seed_family_defaults';
  exception when insufficient_privilege then raise notice 'ok: parent cannot call seed_family_defaults';
  end;
end $$;

-- Cross-family integrity: parent A must not be able to write rows for a child of family B
do $$
begin
  begin
    insert into public.overrides (family_id, child_id, local_date, kind, until)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', current_date, 'open_until', now() + interval '5 hours');
    raise exception 'FAIL: row for another family child accepted';
  exception when foreign_key_violation then raise notice 'ok: parent cannot write overrides for another family child';
  end;
  begin
    insert into public.trust_state (child_id, family_id, mode)
    values ('00000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000a', 'trust');
    raise exception 'FAIL: trust_state for another family child accepted';
  exception when foreign_key_violation then raise notice 'ok: parent cannot write trust_state for another family child';
  end;
end $$;

-- 0003 (S2e): plans, weekly reviews, icon ------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test_helpers.expect_count('child1 sees only own day plan',      (select count(*) from public.day_plans), 1);
select test_helpers.expect_count('child1 sees only own weekly review', (select count(*) from public.weekly_reviews), 1);
do $$
begin
  begin
    insert into public.day_plans (child_id, family_id, local_date) values ('00000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a', '2026-10-18');
    raise exception 'FAIL: child inserted a day plan';
  exception when insufficient_privilege then raise notice 'ok: child cannot write day_plans';
  end;
  begin
    update public.weekly_reviews set went_well = 'x';
    raise exception 'FAIL: child updated weekly_reviews';
  exception when insufficient_privilege then raise notice 'ok: child cannot write weekly_reviews';
  end;
  begin
    update public.profiles set icon = 'x' where id = auth.uid();
    raise exception 'FAIL: child updated own icon directly';
  exception when insufficient_privilege then raise notice 'ok: child cannot write profiles.icon';
  end;
end $$;
select test_helpers.expect_count('child1 can read own icon column', (select count(*) from public.profiles where icon is null), 1);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select test_helpers.expect_count('parentA sees family day plans (2)',      (select count(*) from public.day_plans), 2);
select test_helpers.expect_count('parentA sees family weekly reviews (2)', (select count(*) from public.weekly_reviews), 2);
do $$
begin
  begin
    delete from public.weekly_reviews;
    raise exception 'FAIL: parent deleted weekly_reviews';
  exception when insufficient_privilege then raise notice 'ok: parent cannot delete weekly_reviews (read only)';
  end;
end $$;
reset role;
do $$
begin
  begin
    insert into public.weekly_reviews (child_id, family_id, week_start) values ('00000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a', '2026-10-14');
    raise exception 'FAIL: week_start on a Wednesday accepted';
  exception when check_violation then raise notice 'ok: week_start must be a Monday';
  end;
  begin
    insert into public.day_plans (child_id, family_id, local_date) values ('00000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000a', '2026-10-19');
    raise exception 'FAIL: plan for another family child accepted';
  exception when foreign_key_violation then raise notice 'ok: plan child must be in the same family';
  end;
end $$;

-- 0002 (S2c): new setting + homework bucket file types --------------------------
reset role;
select test_helpers.expect_count('homework_min_upcoming defaults to 1',
  (select homework_min_upcoming from public.family_settings where family_id = '10000000-0000-0000-0000-00000000000a'), 1);
do $$
begin
  begin
    update public.family_settings set homework_min_upcoming = 9;
    raise exception 'FAIL: homework_min_upcoming = 9 accepted';
  exception when check_violation then raise notice 'ok: homework_min_upcoming limited to 0..5';
  end;
end $$;
select test_helpers.expect_count('homework bucket accepts PDF/Word/Excel',
  (select count(*) from storage.buckets
   where id = 'homework'
     and 'application/pdf' = any(allowed_mime_types)
     and 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' = any(allowed_mime_types)
     and 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' = any(allowed_mime_types)
     and file_size_limit = 5242880), 1);
select test_helpers.expect_count('proofs bucket stays photos only',
  (select count(*) from storage.buckets where id = 'proofs' and 'application/pdf' = any(allowed_mime_types)), 0);

-- Service role bypasses RLS ----------------------------------------------------
reset role;
set role service_role;
select test_helpers.expect_count('service_role sees all homework (3)', (select count(*) from public.homework_items), 3);

reset role;
drop schema test_helpers cascade;
\echo RLS OK
