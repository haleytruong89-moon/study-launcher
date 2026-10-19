-- 0006_parent_confirm.sql — "Nhờ bố mẹ xem trực tiếp" (parent decision 19/10/2026):
-- when the child cannot send a photo, they ask; a parent who looked at the notebook
-- confirms on their phone and the homework counts as done (and "Đạt").
-- ADDITIVE and idempotent: 3 new nullable columns, nothing dropped or changed.
--
-- Child: reads them (existing table grant + child_select_own policy); writes only through
-- the server route (service_role), like every other child action.
-- Parent: writes them with their own session (existing parent_all policy, own family).

alter table public.task_runs add column if not exists confirm_requested_at timestamptz;
alter table public.task_runs add column if not exists confirmed_by uuid references public.profiles (id) on delete set null;
alter table public.task_runs add column if not exists confirmed_at timestamptz;

-- The parent's "Cần bố mẹ làm" list looks up open requests of today.
create index if not exists task_runs_confirm_open_idx on public.task_runs (family_id, local_date) where confirm_requested_at is not null and done_at is null;
