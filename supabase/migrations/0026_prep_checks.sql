-- 0026 "Chuẩn bị cho ngày mai" (parent decision 21/11/2026: "Con tích, bố mẹ thấy 'đã chuẩn bị'").
-- One row per child and school day being prepared: which rows of the checklist the child ticked
-- (books, bring, uniform, extras) and when every row was ticked. Display only: it never changes
-- what is done, locked or open. The child has SELECT only; ticks go through the server
-- (/api/prep, service_role after the session check), which keeps only real row keys.
--
-- ADDITIVE and idempotent: one new table. Nothing else changes.
create table if not exists public.prep_checks (
  child_id   uuid not null references public.profiles (id) on delete cascade,
  family_id  uuid not null references public.families (id) on delete cascade,
  for_date   date not null,
  ticked     text[] not null default '{}',
  done_at    timestamptz,
  updated_at timestamptz not null default now(),
  primary key (child_id, for_date),
  constraint prep_checks_ticked_len check (cardinality(ticked) <= 20)
);

-- Integrity: the child belongs to the SAME family as the row (same pattern as 0025).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prep_checks_child_family_fk' and conrelid = 'public.prep_checks'::regclass) then
    alter table public.prep_checks add constraint prep_checks_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.prep_checks enable row level security;

revoke all on public.prep_checks from public, anon, authenticated;
grant select on public.prep_checks to authenticated;
grant all on public.prep_checks to service_role;

drop policy if exists parent_select on public.prep_checks;
create policy parent_select on public.prep_checks for select to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id());
drop policy if exists child_select_own on public.prep_checks;
create policy child_select_own on public.prep_checks for select to authenticated
  using (public.auth_role() = 'child' and child_id = auth.uid());
