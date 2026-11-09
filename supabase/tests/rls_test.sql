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

-- 0004 (S4b): pairing codes are server-only ------------------------------------------
reset role;
insert into public.device_pair_codes (family_id, child_id, code_hash, expires_at)
values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'h', now() + interval '10 minutes');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$
begin
  begin
    perform 1 from public.device_pair_codes;
    raise exception 'FAIL: parent read device_pair_codes';
  exception when insufficient_privilege then raise notice 'ok: parent cannot read device_pair_codes';
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$
begin
  begin
    insert into public.device_pair_codes (family_id, child_id, code_hash, expires_at)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'x', now());
    raise exception 'FAIL: child wrote device_pair_codes';
  exception when insufficient_privilege then raise notice 'ok: child cannot write device_pair_codes';
  end;
  begin
    perform token_hash from public.extension_devices;
    raise exception 'FAIL: child read token_hash';
  exception when insufficient_privilege then raise notice 'ok: child cannot read device token hashes';
  end;
end $$;
reset role;
set role service_role;
select test_helpers.expect_count('service_role sees pairing codes', (select count(*) from public.device_pair_codes), 1);
select test_helpers.expect_count('pair_code_try counts 1..5 then refuses',
  (select count(*) from generate_series(1, 7) g where public.pair_code_try((select id from public.device_pair_codes limit 1)) is not null), 5);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$
begin
  begin
    perform public.pair_code_try(gen_random_uuid());
    raise exception 'FAIL: child called pair_code_try';
  exception when insufficient_privilege then raise notice 'ok: child cannot call pair_code_try';
  end;
end $$;
reset role;

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
-- 0011 (R3a): the character is read like the icon; never written by a browser.
do $$
begin
  begin
    update public.profiles set avatar = '{"hair":"den"}'::jsonb where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL: child updated own avatar directly';
  exception when insufficient_privilege then raise notice 'ok: child cannot write profiles.avatar';
  end;
end $$;
select test_helpers.expect_count('child1 can read own avatar column', (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1' and avatar is null), 1);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$
begin
  begin
    update public.profiles set avatar = '{"hair":"den"}'::jsonb where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL: parent updated a child avatar directly';
  exception when insufficient_privilege then raise notice 'ok: parent cannot write profiles.avatar (the child makes it)';
  end;
end $$;
select test_helpers.expect_count('parentA can read the child avatar column', (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1' and avatar is null), 1);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select test_helpers.expect_count('parentB cannot read a family A avatar', (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), 0);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);

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

-- 0005: PIN login (server-only table + atomic tries) -----------------------------
reset role;
insert into public.pin_devices (family_id, child_id, token_hash)
values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'hash-c1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$
begin
  begin
    perform 1 from public.pin_devices;
    raise exception 'FAIL: child read pin_devices';
  exception when insufficient_privilege then raise notice 'ok: child cannot read pin_devices';
  end;
  begin
    perform public.child_pin_try('00000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL: child called child_pin_try';
  exception when insufficient_privilege then raise notice 'ok: child cannot call child_pin_try';
  end;
end $$;
reset role;
set role anon;
do $$
begin
  begin
    perform 1 from public.pin_devices;
    raise exception 'FAIL: anon read pin_devices';
  exception when insufficient_privilege then raise notice 'ok: anon cannot read pin_devices';
  end;
end $$;
reset role;
update public.profiles set pin_hash = 'scrypt$x$y', pin_failed_count = 0, pin_locked_until = null
 where id = '00000000-0000-0000-0000-0000000000c1';
set role service_role;
select test_helpers.expect_count('PIN try 1', (select public.child_pin_try('00000000-0000-0000-0000-0000000000c1')), 1);
select public.child_pin_try('00000000-0000-0000-0000-0000000000c1');
select public.child_pin_try('00000000-0000-0000-0000-0000000000c1');
select public.child_pin_try('00000000-0000-0000-0000-0000000000c1');
select test_helpers.expect_count('PIN try 5 still allowed', (select public.child_pin_try('00000000-0000-0000-0000-0000000000c1')), 5);
select test_helpers.expect_count('PIN locked after 5 tries', (select count(*) from public.child_pin_try('00000000-0000-0000-0000-0000000000c1') t where t is not null), 0);
select test_helpers.expect_count('PIN lock lasts ~15 minutes',
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1' and pin_locked_until > now() + interval '14 minutes'), 1);
select test_helpers.expect_count('a parent profile never gets PIN tries', (select count(*) from public.child_pin_try('00000000-0000-0000-0000-0000000000a1') t where t is not null), 0);
reset role;
update public.profiles set pin_locked_until = now() - interval '1 second' where id = '00000000-0000-0000-0000-0000000000c1';
set role service_role;
select test_helpers.expect_count('lock over: count starts again', (select public.child_pin_try('00000000-0000-0000-0000-0000000000c1')), 1);

-- 0006: parent confirmation columns: the child can read but never set them ----------
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test_helpers.expect_count('child can read confirm columns', (select count(*) from (select confirm_requested_at, confirmed_by, confirmed_at from public.task_runs limit 1) t) * 0 + 1, 1);
do $$
begin
  update public.task_runs set confirmed_at = now(), done_at = now();
  if found then raise exception 'FAIL: child confirmed own run'; end if;
  raise notice 'ok: child cannot confirm own run (0 rows)';
end $$;
reset role;

-- 0007: saved-files setting, off by default; the child can read but not change it -----
reset role;
select test_helpers.expect_count('allow_local_files defaults to off',
  (select count(*) from public.family_settings where allow_local_files = false and family_id = '10000000-0000-0000-0000-00000000000a'), 1);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$
begin
  update public.family_settings set allow_local_files = true;
  if found then raise exception 'FAIL: child changed allow_local_files'; end if;
  raise notice 'ok: child cannot turn on saved files (0 rows)';
end $$;
reset role;

-- 0008: Góc bình yên base (S-BY0) ------------------------------------------------
reset role;
-- A second parent in family A (the child may send a signal to ONE parent only).
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a2') on conflict do nothing;
insert into public.profiles (id, family_id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'parent', 'Parent A2')
on conflict do nothing;
update public.profiles set by_pin_hash = 'scrypt$by$c1', by_pin_reset_at = now() where id = '00000000-0000-0000-0000-0000000000c1';
insert into public.by_sessions (family_id, child_id, token_hash) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'by-hash-c1');
insert into public.by_signals (id, family_id, child_id, kind, to_parent_id) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'want_talk', null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'want_talk', '00000000-0000-0000-0000-0000000000a2'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', 'want_talk', null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'want_talk', null);

select test_helpers.expect_count('by_enabled defaults to off',
  (select count(*) from public.family_settings where by_enabled = false and by_study_minutes = 10 and by_idle_lock_minutes = 5 and by_daily_rewards = 1), 2);
do $$
begin
  begin
    update public.family_settings set by_idle_lock_minutes = 1;
    raise exception 'FAIL: by_idle_lock_minutes = 1 accepted';
  exception when check_violation then raise notice 'ok: by_idle_lock_minutes limited to 2..15';
  end;
  begin
    update public.family_settings set by_study_minutes = 4;
    raise exception 'FAIL: by_study_minutes = 4 accepted';
  exception when check_violation then raise notice 'ok: by_study_minutes >= 5';
  end;
  begin
    insert into public.by_signals (family_id, child_id, kind) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Con buồn lắm');
    raise exception 'FAIL: free text accepted as a signal kind';
  exception when check_violation then raise notice 'ok: signal kind is a short key, never free text';
  end;
  begin
    insert into public.by_signals (family_id, child_id, kind, to_parent_id) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'want_talk', '00000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL: signal addressed to another family parent accepted';
  exception when foreign_key_violation then raise notice 'ok: a signal goes only to a parent of the same family';
  end;
end $$;

-- Child 1: own signals only, no sessions, no PIN columns, no writes.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test_helpers.expect_count('child1 sees only own signals (2)', (select count(*) from public.by_signals), 2);
select test_helpers.expect_count('child1 cannot see sibling signals', (select count(*) from public.by_signals where child_id = '00000000-0000-0000-0000-0000000000c2'), 0);
do $$
begin
  begin
    perform 1 from public.by_sessions;
    raise exception 'FAIL: child read by_sessions';
  exception when insufficient_privilege then raise notice 'ok: child cannot read by_sessions';
  end;
  begin
    insert into public.by_signals (family_id, child_id, kind) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'want_talk');
    raise exception 'FAIL: child inserted a signal directly';
  exception when insufficient_privilege then raise notice 'ok: child cannot insert signals directly';
  end;
  update public.by_signals set seen_at = now(), seen_by = '00000000-0000-0000-0000-0000000000c1';
  if found then raise exception 'FAIL: child marked a signal as seen'; end if;
  raise notice 'ok: child cannot mark signals seen (0 rows)';
  begin
    delete from public.by_signals;
    raise exception 'FAIL: child deleted signals';
  exception when insufficient_privilege then raise notice 'ok: child cannot delete signals';
  end;
  begin
    perform by_pin_hash from public.profiles;
    raise exception 'FAIL: child read by_pin_hash';
  exception when insufficient_privilege then raise notice 'ok: child cannot read by_pin_hash';
  end;
  begin
    perform by_pin_reset_at from public.profiles;
    raise exception 'FAIL: child read by_pin_reset_at';
  exception when insufficient_privilege then raise notice 'ok: child cannot read by_pin_reset_at';
  end;
  begin
    update public.profiles set by_pin_hash = null where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL: child wrote by_pin_hash';
  exception when insufficient_privilege then raise notice 'ok: child cannot write by_pin_hash';
  end;
  update public.family_settings set by_enabled = true;
  if found then raise exception 'FAIL: child turned on Góc bình yên'; end if;
  raise notice 'ok: child cannot turn on Góc bình yên (0 rows)';
  begin
    perform public.by_pin_try('00000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL: child called by_pin_try';
  exception when insufficient_privilege then raise notice 'ok: child cannot call by_pin_try';
  end;
  begin
    perform public.by_signal_create('00000000-0000-0000-0000-0000000000c1', 'want_talk', null, 0);
    raise exception 'FAIL: child called by_signal_create';
  exception when insufficient_privilege then raise notice 'ok: child cannot call by_signal_create';
  end;
end $$;
select test_helpers.expect_count('child1 still reads by_enabled', (select count(*) from public.family_settings where by_enabled = false), 1);

-- Parent A1: family signals (not the one sent only to A2); may set ONLY seen_at / seen_by = self.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select test_helpers.expect_count('parentA1 sees family signals for both parents (2)', (select count(*) from public.by_signals), 2);
select test_helpers.expect_count('parentA1 does not see the signal sent only to A2', (select count(*) from public.by_signals where to_parent_id = '00000000-0000-0000-0000-0000000000a2'), 0);
do $$
begin
  begin
    perform 1 from public.by_sessions;
    raise exception 'FAIL: parent read by_sessions';
  exception when insufficient_privilege then raise notice 'ok: parent cannot read by_sessions';
  end;
  begin
    perform by_pin_hash from public.profiles;
    raise exception 'FAIL: parent read by_pin_hash';
  exception when insufficient_privilege then raise notice 'ok: parent cannot read by_pin_hash';
  end;
  begin
    perform by_pin_failed_count from public.profiles;
    raise exception 'FAIL: parent read by_pin_failed_count';
  exception when insufficient_privilege then raise notice 'ok: parent cannot read by_pin_failed_count';
  end;
  begin
    update public.profiles set by_pin_hash = null where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL: parent wrote by_pin_hash';
  exception when insufficient_privilege then raise notice 'ok: parent cannot write by_pin_hash';
  end;
  begin
    insert into public.by_signals (family_id, child_id, kind) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'want_talk');
    raise exception 'FAIL: parent inserted a signal';
  exception when insufficient_privilege then raise notice 'ok: parent cannot insert signals';
  end;
  begin
    delete from public.by_signals;
    raise exception 'FAIL: parent deleted signals';
  exception when insufficient_privilege then raise notice 'ok: parent cannot delete signals';
  end;
  begin
    update public.by_signals set kind = 'x';
    raise exception 'FAIL: parent changed a signal kind';
  exception when insufficient_privilege then raise notice 'ok: parent can only set seen_at / seen_by';
  end;
  begin
    update public.by_signals set escalated_at = now();
    raise exception 'FAIL: parent changed escalated_at';
  exception when insufficient_privilege then raise notice 'ok: parent cannot change escalated_at';
  end;
  begin
    update public.by_signals set seen_at = now(), seen_by = '00000000-0000-0000-0000-0000000000a2' where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: parent marked seen in the other parent''s name';
  exception when insufficient_privilege then raise notice 'ok: seen_by must be the parent themself';
  end;
  update public.by_signals set seen_at = now(), seen_by = '00000000-0000-0000-0000-0000000000a1' where id = '30000000-0000-0000-0000-000000000002';
  if found then raise exception 'FAIL: parent marked a signal sent only to the other parent'; end if;
  raise notice 'ok: parent cannot touch a signal sent only to the other parent';
  update public.by_signals set seen_at = now(), seen_by = '00000000-0000-0000-0000-0000000000a1' where id = '30000000-0000-0000-0000-000000000001';
  if not found then raise exception 'FAIL: parent could not mark a signal seen'; end if;
  raise notice 'ok: parent marks a signal seen in their own name';
  update public.by_signals set seen_at = now(), seen_by = '00000000-0000-0000-0000-0000000000a1' where id = '30000000-0000-0000-0000-000000000004';
  if found then raise exception 'FAIL: parent marked another family signal'; end if;
  raise notice 'ok: parent cannot mark another family signal';
end $$;

-- Parent A2 sees the one addressed to them too; parent B sees only family B.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select test_helpers.expect_count('parentA2 sees both-parent + own signals (3)', (select count(*) from public.by_signals), 3);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select test_helpers.expect_count('parentB sees only family B signals (1)', (select count(*) from public.by_signals), 1);
reset role;
set role anon;
do $$
begin
  begin
    perform 1 from public.by_signals;
    raise exception 'FAIL: anon read by_signals';
  exception when insufficient_privilege then raise notice 'ok: anon cannot read by_signals';
  end;
end $$;

-- service_role: atomic PIN tries and the rate-limited signal insert.
reset role;
set role service_role;
select test_helpers.expect_count('BY PIN try 1', (select public.by_pin_try('00000000-0000-0000-0000-0000000000c1')), 1);
select public.by_pin_try('00000000-0000-0000-0000-0000000000c1');
select public.by_pin_try('00000000-0000-0000-0000-0000000000c1');
select public.by_pin_try('00000000-0000-0000-0000-0000000000c1');
select test_helpers.expect_count('BY PIN try 5 still allowed', (select public.by_pin_try('00000000-0000-0000-0000-0000000000c1')), 5);
select test_helpers.expect_count('BY PIN locked after 5 tries', (select count(*) from public.by_pin_try('00000000-0000-0000-0000-0000000000c1') t where t is not null), 0);
select test_helpers.expect_count('BY PIN lock lasts ~15 minutes',
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1' and by_pin_locked_until > now() + interval '14 minutes'), 1);
select test_helpers.expect_count('no BY PIN set = no tries', (select count(*) from public.by_pin_try('00000000-0000-0000-0000-0000000000c2') t where t is not null), 0);
select test_helpers.expect_count('BY PIN tries leave the login PIN alone',
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c2' and pin_locked_until is null and by_pin_failed_count = 0), 1);
select test_helpers.expect_count('rate limit: child2 sent want_talk less than 2 minutes ago', (select count(*) from public.by_signal_create('00000000-0000-0000-0000-0000000000c2', 'want_talk', '00000000-0000-0000-0000-0000000000a2', 120)), 0);
select test_helpers.expect_count('first signal of another kind passes', (select count(*) from public.by_signal_create('00000000-0000-0000-0000-0000000000c2', 'needs_care', null, 120)), 1);
select test_helpers.expect_count('second one within the gap is refused', (select count(*) from public.by_signal_create('00000000-0000-0000-0000-0000000000c2', 'needs_care', null, 120)), 0);
select test_helpers.expect_count('no gap = allowed again', (select count(*) from public.by_signal_create('00000000-0000-0000-0000-0000000000c2', 'needs_care', '00000000-0000-0000-0000-0000000000a1', 0)), 1);
do $$
begin
  begin
    perform public.by_signal_create('00000000-0000-0000-0000-0000000000c2', 'want_talk', '00000000-0000-0000-0000-0000000000b1', 0);
    raise exception 'FAIL: by_signal_create sent to another family parent';
  exception when invalid_parameter_value then raise notice 'ok: by_signal_create refuses a parent of another family';
  end;
  begin
    perform public.by_signal_create('00000000-0000-0000-0000-0000000000a1', 'want_talk', null, 0);
    raise exception 'FAIL: by_signal_create for a parent';
  exception when invalid_parameter_value then raise notice 'ok: by_signal_create only for a child';
  end;
end $$;

-- 0009: Góc bình yên check-ins (S-BY1) — server only (BINH_YEN.md §3) -------------
reset role;
insert into public.by_checkins (family_id, child_id, local_date, quad, word_key, intensity, activity_key, client_run_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, 'red', 'lo_lang', 5, 'breath', '40000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', current_date, 'yellow', 'vui', null, null, '40000000-0000-0000-0000-000000000002');

-- The required tests of §3: no policy at all (so none mentions parent), no browser grant.
select test_helpers.expect_count('by_checkins has no policy at all',
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'by_checkins'), 0);
select test_helpers.expect_count('no by_checkins policy mentions parent',
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'by_checkins'
     and (coalesce(qual, '') ilike '%parent%' or coalesce(with_check, '') ilike '%parent%')), 0);
select test_helpers.expect_count('by_checkins has RLS on',
  (select count(*) from pg_class where oid = 'public.by_checkins'::regclass and relrowsecurity), 1);
select test_helpers.expect_count('authenticated has no privilege on by_checkins / by_sessions',
  (select count(*) from (values ('public.by_checkins'), ('public.by_sessions')) t(tbl), (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
    where has_table_privilege('authenticated', t.tbl, p.priv)), 0);
select test_helpers.expect_count('anon has no privilege on by_checkins',
  (select count(*) from (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv) where has_table_privilege('anon', 'public.by_checkins', p.priv)), 0);
select test_helpers.expect_count('authenticated has no column privilege on by_checkins',
  (select count(*) from information_schema.column_privileges where table_schema = 'public' and table_name = 'by_checkins' and grantee in ('authenticated', 'anon', 'PUBLIC')), 0);
-- D1: only fixed-key columns exist (no column for anything the child types).
select test_helpers.expect_count('by_checkins columns are exactly the fixed-key ones',
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'by_checkins'
     and column_name not in ('id', 'family_id', 'child_id', 'local_date', 'quad', 'word_key', 'intensity', 'activity_key', 'cause_key', 'understood_at', 'client_run_id', 'created_at')), 0);

do $$
begin
  begin
    insert into public.by_checkins (family_id, child_id, local_date, quad, word_key, client_run_id)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, 'red', 'Con buồn lắm vì bạn', gen_random_uuid());
    raise exception 'FAIL: free text accepted as a word key';
  exception when check_violation then raise notice 'ok: word_key is a short key, never free text';
  end;
  begin
    insert into public.by_checkins (family_id, child_id, local_date, quad, word_key, activity_key, client_run_id)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, 'red', 'lo_lang', 'Viết rồi buông: hôm nay', gen_random_uuid());
    raise exception 'FAIL: free text accepted as an activity key';
  exception when check_violation then raise notice 'ok: activity_key is a short key, never free text';
  end;
  begin
    insert into public.by_checkins (family_id, child_id, local_date, quad, word_key, intensity, client_run_id)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, 'red', 'lo_lang', 6, gen_random_uuid());
    raise exception 'FAIL: intensity 6 accepted';
  exception when check_violation then raise notice 'ok: intensity is 1..5';
  end;
  begin
    insert into public.by_checkins (family_id, child_id, local_date, quad, word_key, client_run_id)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, 'red', 'lo_lang', '40000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: the same client_run_id stored twice';
  exception when unique_violation then raise notice 'ok: one row per client_run_id (double tap on Xong)';
  end;
  begin
    insert into public.by_checkins (family_id, child_id, local_date, quad, word_key, client_run_id)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', current_date, 'red', 'lo_lang', gen_random_uuid());
    raise exception 'FAIL: check-in of another family child accepted';
  exception when foreign_key_violation then raise notice 'ok: a check-in belongs to a child of the same family';
  end;
end $$;

-- Child 1, the sibling and a parent, straight through the browser API: nothing at all.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$
begin
  begin
    perform 1 from public.by_checkins;
    raise exception 'FAIL: child read by_checkins directly';
  exception when insufficient_privilege then raise notice 'ok: child cannot read by_checkins directly (only via /api/by)';
  end;
  begin
    insert into public.by_checkins (family_id, child_id, local_date, quad, word_key, client_run_id)
      values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, 'red', 'lo_lang', gen_random_uuid());
    raise exception 'FAIL: child inserted into by_checkins directly';
  exception when insufficient_privilege then raise notice 'ok: child cannot write by_checkins directly';
  end;
  begin
    delete from public.by_checkins;
    raise exception 'FAIL: child deleted by_checkins directly';
  exception when insufficient_privilege then raise notice 'ok: child cannot delete by_checkins directly';
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
do $$
begin
  perform 1 from public.by_checkins;
  raise exception 'FAIL: sibling read by_checkins';
exception when insufficient_privilege then raise notice 'ok: sibling cannot read by_checkins';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$
begin
  begin
    perform 1 from public.by_checkins;
    raise exception 'FAIL: parent read by_checkins';
  exception when insufficient_privilege then raise notice 'ok: parent cannot read by_checkins';
  end;
  begin
    update public.by_checkins set intensity = 1;
    raise exception 'FAIL: parent updated by_checkins';
  exception when insufficient_privilege then raise notice 'ok: parent cannot change by_checkins';
  end;
  begin
    delete from public.by_checkins;
    raise exception 'FAIL: parent deleted by_checkins';
  exception when insufficient_privilege then raise notice 'ok: parent cannot delete by_checkins (only the child can, via the corner)';
  end;
end $$;
reset role;
set role anon;
do $$
begin
  perform 1 from public.by_checkins;
  raise exception 'FAIL: anon read by_checkins';
exception when insufficient_privilege then raise notice 'ok: anon cannot read by_checkins';
end $$;
reset role;
set role service_role;
select test_helpers.expect_count('service_role (server routes) reads the check-ins', (select count(*) from public.by_checkins), 2);
reset role;

-- 0010: app_feedback ("Góp ý", 07/11/2026) — inserts only via the server route -------
reset role;
insert into public.app_feedback (id, family_id, child_id, kind, body) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'like', 'Con thích nút mới'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', 'idea', 'Thêm màu tối'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'dislike', 'Chậm quá');
select test_helpers.expect_count('app_feedback has RLS on',
  (select count(*) from pg_class where oid = 'public.app_feedback'::regclass and relrowsecurity), 1);
select test_helpers.expect_count('browsers have no insert / delete on app_feedback',
  (select count(*) from (values ('authenticated'), ('anon')) r(role), (values ('INSERT'), ('DELETE'), ('TRUNCATE')) p(priv)
    where has_table_privilege(r.role, 'public.app_feedback', p.priv)), 0);
select test_helpers.expect_count('anon has no privilege on app_feedback',
  (select count(*) from (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv) where has_table_privilege('anon', 'public.app_feedback', p.priv)), 0);
select test_helpers.expect_count('the only column browsers may update is seen_at',
  (select count(*) from information_schema.column_privileges where table_schema = 'public' and table_name = 'app_feedback'
     and grantee = 'authenticated' and privilege_type = 'UPDATE' and column_name <> 'seen_at'), 0);
do $$
begin
  begin
    insert into public.app_feedback (family_id, child_id, kind, body) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'angry', 'x');
    raise exception 'FAIL: unknown feedback kind accepted';
  exception when check_violation then raise notice 'ok: feedback kind is like / dislike / idea';
  end;
  begin
    insert into public.app_feedback (family_id, child_id, kind, body) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'idea', '');
    raise exception 'FAIL: empty feedback accepted';
  exception when check_violation then raise notice 'ok: feedback text is not empty';
  end;
  begin
    insert into public.app_feedback (family_id, child_id, kind, body) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'idea', repeat('x', 501));
    raise exception 'FAIL: 501-character feedback accepted';
  exception when check_violation then raise notice 'ok: feedback text is at most 500 characters';
  end;
  begin
    insert into public.app_feedback (family_id, child_id, kind, body) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'idea', 'x');
    raise exception 'FAIL: feedback of another family child accepted';
  exception when foreign_key_violation then raise notice 'ok: feedback belongs to a child of the same family';
  end;
end $$;

-- Child 1: reads only their own; cannot insert, update or delete directly.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test_helpers.expect_count('child1 sees only own feedback (1)', (select count(*) from public.app_feedback), 1);
select test_helpers.expect_count('child1 cannot see the sibling feedback', (select count(*) from public.app_feedback where child_id = '00000000-0000-0000-0000-0000000000c2'), 0);
do $$
begin
  begin
    insert into public.app_feedback (family_id, child_id, kind, body) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'like', 'x');
    raise exception 'FAIL: child inserted feedback directly';
  exception when insufficient_privilege then raise notice 'ok: child cannot insert feedback directly (only via /api/feedback)';
  end;
  begin
    update public.app_feedback set body = 'changed';
    raise exception 'FAIL: child changed feedback text';
  exception when insufficient_privilege then raise notice 'ok: child cannot change feedback text';
  end;
  update public.app_feedback set seen_at = now();
  if found then raise exception 'FAIL: child marked feedback as read'; end if;
  raise notice 'ok: child cannot mark feedback as read (0 rows)';
  begin
    delete from public.app_feedback;
    raise exception 'FAIL: child deleted feedback';
  exception when insufficient_privilege then raise notice 'ok: child cannot delete feedback';
  end;
end $$;

-- Parent A1: reads the family's feedback (both children), marks read, changes nothing else.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select test_helpers.expect_count('parentA1 reads the family feedback (2)', (select count(*) from public.app_feedback), 2);
select test_helpers.expect_count('parentA1 does not read another family feedback', (select count(*) from public.app_feedback where family_id = '10000000-0000-0000-0000-00000000000b'), 0);
do $$
begin
  update public.app_feedback set seen_at = now() where id = '50000000-0000-0000-0000-000000000001';
  if not found then raise exception 'FAIL: parent could not mark feedback as read'; end if;
  raise notice 'ok: parent marks feedback as read';
  update public.app_feedback set seen_at = now() where id = '50000000-0000-0000-0000-000000000003';
  if found then raise exception 'FAIL: parent marked another family feedback'; end if;
  raise notice 'ok: parent cannot touch another family feedback (0 rows)';
  begin
    update public.app_feedback set body = 'changed' where id = '50000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: parent changed feedback text';
  exception when insufficient_privilege then raise notice 'ok: parent cannot change feedback text';
  end;
  begin
    delete from public.app_feedback;
    raise exception 'FAIL: parent deleted feedback';
  exception when insufficient_privilege then raise notice 'ok: parent cannot delete feedback';
  end;
  begin
    insert into public.app_feedback (family_id, child_id, kind, body) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'like', 'x');
    raise exception 'FAIL: parent inserted feedback';
  exception when insufficient_privilege then raise notice 'ok: parent cannot insert feedback';
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select test_helpers.expect_count('parentB reads only family B feedback (1)', (select count(*) from public.app_feedback), 1);
reset role;
set role anon;
do $$
begin
  perform 1 from public.app_feedback;
  raise exception 'FAIL: anon read app_feedback';
exception when insufficient_privilege then raise notice 'ok: anon cannot read app_feedback';
end $$;
reset role;

-- 0011 (R3a): only a small JSON object fits in profiles.avatar.
reset role;
do $$
begin
  begin
    update public.profiles set avatar = '"x"'::jsonb where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL: a non-object avatar was stored';
  exception when check_violation then raise notice 'ok: avatar must be a JSON object';
  end;
  begin
    update public.profiles set avatar = jsonb_build_object('name', repeat('x', 2000)) where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL: an oversized avatar was stored';
  exception when check_violation then raise notice 'ok: avatar is size-limited';
  end;
end $$;

-- 0012 (R3b): Picrew pictures. The whole family looks; no browser writes; other families see nothing.
reset role;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false) on conflict do nothing;
insert into storage.objects (bucket_id, name) values
  ('avatars', '10000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/11111111-1111-4111-8111-111111111111.png');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test_helpers.expect_count('child1 sees own avatar picture', (select count(*) from storage.objects where bucket_id = 'avatars'), 1);
select test_helpers.expect_count('child1 can read avatar_pics column', (select count(*) from public.profiles where avatar_pics is null), 1);
do $$
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('avatars', '10000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/22222222-2222-4222-8222-222222222222.png');
    raise exception 'FAIL: child wrote an avatar picture directly';
  exception when insufficient_privilege or check_violation then raise notice 'ok: child cannot upload avatar pictures directly';
  end;
  delete from storage.objects where bucket_id = 'avatars';
  if found then raise exception 'FAIL: child deleted an avatar picture directly'; end if;
  raise notice 'ok: child cannot delete avatar pictures directly';
  begin
    update public.profiles set avatar_pics = '{}'::jsonb where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL: child updated avatar_pics directly';
  exception when insufficient_privilege then raise notice 'ok: child cannot write profiles.avatar_pics';
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select test_helpers.expect_count('sibling sees the family avatar picture', (select count(*) from storage.objects where bucket_id = 'avatars'), 1);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select test_helpers.expect_count('parentA sees the family avatar picture', (select count(*) from storage.objects where bucket_id = 'avatars'), 1);
do $$
begin
  begin
    update public.profiles set avatar_pics = '{}'::jsonb where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL: parent updated avatar_pics directly';
  exception when insufficient_privilege then raise notice 'ok: parent cannot write profiles.avatar_pics (server removes)';
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select test_helpers.expect_count('parentB sees no family A avatar picture', (select count(*) from storage.objects where bucket_id = 'avatars'), 0);
reset role;
do $$
begin
  begin
    update public.profiles set avatar_pics = '"x"'::jsonb where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL: a non-object avatar_pics was stored';
  exception when check_violation then raise notice 'ok: avatar_pics must be a JSON object';
  end;
end $$;
delete from storage.objects where bucket_id = 'avatars';

-- 0013 (R4a): world of the month — server only, like by_checkins. No feeling column.
reset role;
select test_helpers.expect_count('world tables have RLS on and no policy',
  (select count(*) from pg_class c where c.oid in ('public.world_items'::regclass, 'public.world_months'::regclass) and c.relrowsecurity
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)), 2);
select test_helpers.expect_count('browsers have no privilege on world tables',
  (select count(*) from (values ('public.world_items'), ('public.world_months')) t(tbl), (values ('authenticated'), ('anon')) r(rl), (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
    where has_table_privilege(r.rl, t.tbl, p.priv)), 0);
select test_helpers.expect_count('world_items has no feeling column',
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'world_items'
     and column_name not in ('id', 'family_id', 'child_id', 'local_date', 'pillar', 'world_key', 'item_key', 'variant', 'created_at')), 0);
insert into public.world_items (family_id, child_id, local_date, pillar, world_key, item_key) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '2026-11-05', 'study', 'rung', 'cho_ngan_nam');
do $$
begin
  begin
    insert into public.world_items (family_id, child_id, local_date, pillar, world_key, item_key) values
      ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '2026-11-05', 'study', 'rung', 'cay_da');
    raise exception 'FAIL: two plants for one area on one day';
  exception when unique_violation then raise notice 'ok: one plant per area per day';
  end;
  begin
    insert into public.world_items (family_id, child_id, local_date, pillar, world_key, item_key) values
      ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c1', '2026-11-05', 'feel', 'rung', 'lan_hai');
    raise exception 'FAIL: world row with a child of another family';
  exception when foreign_key_violation then raise notice 'ok: world row must match the child family';
  end;
  begin
    insert into public.world_items (family_id, child_id, local_date, pillar, world_key, item_key) values
      ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '2026-11-06', 'feel', 'rung', 'Con buồn');
    raise exception 'FAIL: free text accepted as item_key';
  exception when check_violation then raise notice 'ok: item_key is a short key, never free text';
  end;
  begin
    insert into public.world_months (family_id, child_id, month, world_key) values
      ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '2026-11-05', 'rung');
    raise exception 'FAIL: world_months month not the 1st';
  exception when check_violation then raise notice 'ok: world_months.month is the first of a month';
  end;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$
begin
  begin
    perform 1 from public.world_items;
    raise exception 'FAIL: parent read world_items';
  exception when insufficient_privilege then raise notice 'ok: parent cannot read world_items';
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$
begin
  begin
    perform 1 from public.world_items;
    raise exception 'FAIL: child read world_items directly';
  exception when insufficient_privilege then raise notice 'ok: child reads the world only through the server';
  end;
end $$;
reset role;
delete from public.world_items;

-- 0014 (R8b): day_breaks — browsers read only (child own rows, parent own family); server writes.
reset role;
insert into public.day_breaks (family_id, child_id, local_date, started_at, planned_minutes) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, now(), 10),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', current_date, now(), 30),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', current_date, now(), 45);
select test_helpers.expect_count('family_settings break defaults (tiers + 6 per day)',
  (select count(*) from public.family_settings
     where break_tiers = '[[45,10],[90,30],[120,45],[180,60]]'::jsonb and break_max_per_day = 6), 2);
do $$
begin
  begin
    insert into public.day_breaks (family_id, child_id, local_date, started_at, planned_minutes)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, now(), 0);
    raise exception 'FAIL: a break of 0 minutes was stored';
  exception when check_violation then raise notice 'ok: day_breaks.planned_minutes > 0';
  end;
  begin
    insert into public.day_breaks (family_id, child_id, local_date, started_at, planned_minutes)
    values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c1', current_date, now(), 10);
    raise exception 'FAIL: day_breaks row with a child of another family';
  exception when foreign_key_violation then raise notice 'ok: day_breaks row must match the child family';
  end;
  begin
    update public.family_settings set break_tiers = '{"a": 1}'::jsonb where family_id = '10000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: non-array break_tiers stored';
  exception when check_violation then raise notice 'ok: break_tiers must be a JSON array';
  end;
  begin
    update public.family_settings set break_max_per_day = 13 where family_id = '10000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: break_max_per_day 13 stored';
  exception when check_violation then raise notice 'ok: break_max_per_day between 0 and 12';
  end;
end $$;
select test_helpers.expect_count('day_breaks has RLS on',
  (select count(*) from pg_class where oid = 'public.day_breaks'::regclass and relrowsecurity), 1);
select test_helpers.expect_count('browsers may only select day_breaks',
  (select count(*) from (values ('authenticated'), ('anon')) r(rl), (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(priv)
    where has_table_privilege(r.rl, 'public.day_breaks', p.priv)), 0);
select test_helpers.expect_count('anon cannot select day_breaks', (select case when has_table_privilege('anon', 'public.day_breaks', 'SELECT') then 1 else 0 end), 0);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test_helpers.expect_count('child1 sees own day_breaks only', (select count(*) from public.day_breaks), 1);
select test_helpers.expect_count('child1 day_break is its own', (select count(*) from public.day_breaks where child_id = '00000000-0000-0000-0000-0000000000c1'), 1);
do $$
begin
  begin
    insert into public.day_breaks (family_id, child_id, local_date, started_at, planned_minutes)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, now(), 60);
    raise exception 'FAIL: child inserted into day_breaks';
  exception when insufficient_privilege then raise notice 'ok: child cannot insert day_breaks';
  end;
  begin
    update public.day_breaks set planned_minutes = 120;
    raise exception 'FAIL: child updated day_breaks';
  exception when insufficient_privilege then raise notice 'ok: child cannot update day_breaks';
  end;
  begin
    delete from public.day_breaks;
    raise exception 'FAIL: child deleted day_breaks';
  exception when insufficient_privilege then raise notice 'ok: child cannot delete day_breaks';
  end;
  begin
    update public.family_settings set break_max_per_day = 12;
    if found then raise exception 'FAIL: child changed break_max_per_day'; end if;
    raise notice 'ok: child cannot change the break rules';
  exception when insufficient_privilege then raise notice 'ok: child cannot change the break rules';
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select test_helpers.expect_count('parentA sees the family day_breaks (2)', (select count(*) from public.day_breaks), 2);
do $$
begin
  begin
    insert into public.day_breaks (family_id, child_id, local_date, started_at, planned_minutes)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date, now(), 60);
    raise exception 'FAIL: parent inserted into day_breaks';
  exception when insufficient_privilege then raise notice 'ok: parent cannot insert day_breaks (server only)';
  end;
  begin
    update public.day_breaks set ended_at = now();
    raise exception 'FAIL: parent updated day_breaks';
  exception when insufficient_privilege then raise notice 'ok: parent cannot update day_breaks';
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select test_helpers.expect_count('parentB sees no family A day_breaks', (select count(*) from public.day_breaks where family_id = '10000000-0000-0000-0000-00000000000a'), 0);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select test_helpers.expect_count('child of family B sees only its own day_break', (select count(*) from public.day_breaks), 1);
reset role;
delete from public.day_breaks;

-- Service role bypasses RLS ----------------------------------------------------
reset role;
set role service_role;
select test_helpers.expect_count('service_role sees all homework (3)', (select count(*) from public.homework_items), 3);

reset role;
drop schema test_helpers cascade;
\echo RLS OK
