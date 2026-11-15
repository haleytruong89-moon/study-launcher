-- 0020 "Con quên bấm Bắt đầu?" (parent decision 15/11/2026): a child who studied a supplementary
-- task or skill without pressing Bắt đầu tells the parents when ("từ 15:10 đến 15:40"). A report
-- counts for NOTHING (not a run, no change to the day state, the lock or free time) until a parent
-- presses Đồng ý: then the SERVER inserts a normal finished task_runs row and links it here.
--
-- ADDITIVE and idempotent: ONE new table, two indexes, constraints, grants and policies. Nothing
-- is dropped and no existing row is changed or read.
--
-- task_run_reports: written ONLY by the server (service_role): POST /api/tasks/report (child:
--   the server checks today, the times on the server clock, at most 2 per child per day, one
--   pending per task) and POST /api/admin/run-reports/[id] (parent of the same family: approve /
--   reject a pending one). Browsers may only read: a child its own rows, a parent the family's.

create table if not exists public.task_run_reports (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  child_id      uuid not null references public.profiles (id) on delete cascade,
  local_date    date not null,
  template_id   uuid not null references public.task_templates (id) on delete cascade,
  started_at    timestamptz not null,
  ended_at      timestamptz not null,
  status        text not null default 'pending',
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.profiles (id) on delete set null,
  run_id        uuid references public.task_runs (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint task_run_reports_times check (ended_at > started_at),
  constraint task_run_reports_status check (status in ('pending', 'approved', 'rejected'))
);
create index if not exists task_run_reports_child_date_idx on public.task_run_reports (child_id, local_date);
-- At most ONE pending report per child / day / task (a double tap cannot store two).
create unique index if not exists task_run_reports_one_pending_idx
  on public.task_run_reports (child_id, local_date, template_id) where status = 'pending';

-- Integrity: the child belongs to the SAME family as the row (same pattern as 0001 / 0014).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_run_reports_child_family_fk' and conrelid = 'public.task_run_reports'::regclass) then
    alter table public.task_run_reports add constraint task_run_reports_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.task_run_reports enable row level security;

-- Browsers read only; the server writes (service_role).
revoke all on public.task_run_reports from public, anon, authenticated;
grant select on public.task_run_reports to authenticated;
grant all on public.task_run_reports to service_role;

-- Same read pattern as task_runs / day_breaks: a child sees its own rows, a parent the family's.
drop policy if exists child_select_own on public.task_run_reports;
create policy child_select_own on public.task_run_reports
  for select to authenticated
  using (public.auth_role() = 'child' and child_id = auth.uid());

drop policy if exists parent_select on public.task_run_reports;
create policy parent_select on public.task_run_reports
  for select to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id());
