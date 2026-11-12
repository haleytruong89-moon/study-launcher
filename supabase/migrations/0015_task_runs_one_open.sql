-- 0015 (Đợt 3, B1): the database refuses a second UNFINISHED run of the same item for the same
-- child on the same day. POST /api/tasks/start reads, then inserts; a double tap or two devices
-- could insert two open task_runs. The app already ignores the extra one (lib/dayState.ts
-- interpretation 10); this index makes it impossible. The route treats the refusal (23505) as
-- "already running". R8a "Làm thêm" keeps working: one unfinished extra run at a time is already
-- the rule, and finished runs are not covered by the index.
--
-- ADDITIVE and idempotent: one partial unique index, created only if it does not exist yet.
-- Nothing is dropped, no existing row is changed or deleted.
--
-- WHY THE DATE IN THE INDEX PREDICATE: production may already hold such duplicates (stale double
-- starts from before this file). A unique index cannot be built over them, and this migration must
-- never fail on real data nor change it. So the index only covers days from a cutoff on:
--   cutoff = the day this migration runs (Asia/Ho_Chi_Minh), or the day after the newest day that
--   already has a duplicate, whichever is later.
-- Older days keep their rows as they are (the app ignores the extra run, as before). The cutoff
-- must be a literal: an index predicate must be immutable, so it cannot call now(). This is why
-- the index is built with `execute format(...)`. Inspect it with:
--   select indexdef from pg_indexes where indexname = 'task_runs_one_open_idx';
-- Items are keyed by coalesce(template_id, homework_item_id): a run has one or the other (uuids,
-- never shared between the two tables). A run whose item was deleted (both null) is not covered.

do $$
declare
  cutoff date;
  newest_dup date;
begin
  if to_regclass('public.task_runs_one_open_idx') is not null then
    return;
  end if;

  -- Block writes to task_runs until the end of this transaction, so no new duplicate can appear
  -- between the check below and the index build (create index takes this lock anyway).
  lock table public.task_runs in share mode;

  cutoff := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  select max(d.local_date) into newest_dup
  from (
    select child_id, local_date, coalesce(template_id, homework_item_id) as item_id
    from public.task_runs
    where done_at is null and coalesce(template_id, homework_item_id) is not null
    group by 1, 2, 3
    having count(*) > 1
  ) d;
  if newest_dup is not null and newest_dup >= cutoff then
    cutoff := newest_dup + 1;
  end if;

  execute format(
    'create unique index task_runs_one_open_idx on public.task_runs
       (child_id, local_date, (coalesce(template_id, homework_item_id)))
       where done_at is null and local_date >= %L::date',
    cutoff
  );
  raise notice 'task_runs_one_open_idx created for local_date >= %', cutoff;
end
$$;
