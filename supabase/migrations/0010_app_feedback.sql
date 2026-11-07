-- 0010_app_feedback.sql — "Góp ý": the children's feedback about the APP (parent decision 07/11/2026).
-- ADDITIVE and idempotent: ONE new table, one index, constraints, grants and policies.
-- Nothing is dropped and no existing row is changed.
--
-- app_feedback: one row per feedback a child sends ("Thích" / "Chưa thích" / "Ý tưởng" + text).
--   * NOT private (unlike Góc bình yên): the child is told "Bố mẹ sẽ đọc góp ý này."
--   * Inserts ONLY through POST /api/feedback (server, service_role): it takes the family and
--     the child from the session, validates the text and allows at most 10 per child per day.
--     Browsers have NO insert / delete grant.
--   * Parents of the family read every row and may change ONLY seen_at ("Đã đọc").
--   * A child reads only their own rows (never a sibling's); a child never updates.

create table if not exists public.app_feedback (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  child_id    uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('like', 'dislike', 'idea')),
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now(),
  seen_at     timestamptz
);
create index if not exists app_feedback_family_idx on public.app_feedback (family_id, created_at desc);
create index if not exists app_feedback_child_idx on public.app_feedback (child_id, created_at desc);

-- Integrity: the child belongs to the SAME family as the row (same pattern as 0008 / 0009).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_feedback_child_family_fk' and conrelid = 'public.app_feedback'::regclass
  ) then
    alter table public.app_feedback add constraint app_feedback_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from public, anon, authenticated;
grant all on public.app_feedback to service_role;
-- Browsers: read (policies below decide which rows) and set ONLY seen_at (parents, by policy).
grant select on public.app_feedback to authenticated;
grant update (seen_at) on public.app_feedback to authenticated;

drop policy if exists parent_select on public.app_feedback;
create policy parent_select on public.app_feedback
  for select to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id());

drop policy if exists parent_mark_seen on public.app_feedback;
create policy parent_mark_seen on public.app_feedback
  for update to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id())
  with check (public.auth_role() = 'parent' and family_id = public.auth_family_id());

drop policy if exists child_select_own on public.app_feedback;
create policy child_select_own on public.app_feedback
  for select to authenticated
  using (public.auth_role() = 'child' and child_id = auth.uid());
