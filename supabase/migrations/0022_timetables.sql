-- 0022 Thời khóa biểu (parent decisions 18/11/2026): each child's school timetable, in VERSIONS.
-- A version applies from `valid_from` until the next version of the same child; when the school
-- changes the timetable the parents add a new version, the old one stays for the record.
--
-- ADDITIVE and idempotent: one new table with grants and policies. Nothing else changes.
--
-- periods: [{ "day": 1..6 (Thứ 2..Thứ 7), "session": "am" | "pm", "n": 1..6, "subject": text }]
-- times:   { "am": { "1": "07:30-08:15", ... }, "pm": { ... } }   (optional per period)
-- uniform: { "1": "Áo polo đỏ, quần thể thao…", ... }              (optional per weekday)
-- The server validates the shapes (lib/timetable/rules.ts); the database keeps them as jsonb.
--
-- Rights: parents of the family read and write (with their own session, like task_templates);
-- a child only READS their own timetables (never writes: CLAUDE.md "con không có quyền ghi").

create table if not exists public.timetables (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  child_id    uuid not null references public.profiles (id) on delete cascade,
  valid_from  date not null,
  label       text not null default '',
  note        text not null default '',
  periods     jsonb not null default '[]'::jsonb,
  times       jsonb not null default '{}'::jsonb,
  uniform     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint timetables_label_len check (char_length(label) <= 40),
  constraint timetables_note_len check (char_length(note) <= 200),
  constraint timetables_periods_array check (jsonb_typeof(periods) = 'array'),
  constraint timetables_times_object check (jsonb_typeof(times) = 'object'),
  constraint timetables_uniform_object check (jsonb_typeof(uniform) = 'object'),
  constraint timetables_one_per_start unique (child_id, valid_from)
);
create index if not exists timetables_child_from_idx on public.timetables (child_id, valid_from desc);

-- Integrity: the child belongs to the SAME family as the row (same pattern as 0014 / 0020 / 0021).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'timetables_child_family_fk' and conrelid = 'public.timetables'::regclass) then
    alter table public.timetables add constraint timetables_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.timetables enable row level security;

revoke all on public.timetables from public, anon, authenticated;
grant select, insert, update, delete on public.timetables to authenticated;
grant all on public.timetables to service_role;

drop policy if exists parent_all on public.timetables;
create policy parent_all on public.timetables for all to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id())
  with check (public.auth_role() = 'parent' and family_id = public.auth_family_id());

drop policy if exists child_select_own on public.timetables;
create policy child_select_own on public.timetables for select to authenticated
  using (public.auth_role() = 'child' and child_id = auth.uid());
