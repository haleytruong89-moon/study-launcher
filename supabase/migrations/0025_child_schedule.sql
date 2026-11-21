-- 0025 Lịch học con tự quản (parent decisions 21/11/2026): the child keeps their own timetable,
-- extra classes (học thêm / gia sư) and subject list. "Con tự sửa, áp dụng ngay; bố mẹ được báo và
-- khôi phục được bản trước." The child still has SELECT only: every write goes through the
-- server (/api/schedule/*, service_role after the session check) and logs audit_log with a
-- `before` snapshot that the parents can restore.
--
-- ADDITIVE and idempotent: two new tables, one nullable column. Nothing else changes.
--
-- extra_classes.sessions: [{ "day": 1..7 (Thứ 2..Chủ nhật), "start": "HH:MM", "end": "HH:MM" }]
-- (validated by the server, lib/schedule/rules.ts).

create table if not exists public.extra_classes (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  child_id     uuid not null references public.profiles (id) on delete cascade,
  subject      text not null,
  sessions     jsonb not null default '[]'::jsonb,
  place        text not null default 'home',
  bring        text not null default '',
  note         text not null default '',
  app_slot_id  uuid references public.app_slots (id) on delete set null,
  active       boolean not null default true,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint extra_classes_subject_len check (char_length(subject) between 1 and 30),
  constraint extra_classes_sessions_array check (jsonb_typeof(sessions) = 'array'),
  constraint extra_classes_place check (place in ('home', 'center', 'online')),
  constraint extra_classes_bring_len check (char_length(bring) <= 120),
  constraint extra_classes_note_len check (char_length(note) <= 120)
);
create index if not exists extra_classes_child_idx on public.extra_classes (child_id) where active;

create table if not exists public.subject_prefs (
  child_id     uuid not null references public.profiles (id) on delete cascade,
  family_id    uuid not null references public.families (id) on delete cascade,
  subject_key  text not null,
  label        text not null default '',
  color        text not null default '',
  bring        text not null default '',
  updated_at   timestamptz not null default now(),
  primary key (child_id, subject_key),
  constraint subject_prefs_key_len check (char_length(subject_key) between 1 and 40),
  constraint subject_prefs_label_len check (char_length(label) <= 30),
  constraint subject_prefs_color check (color = '' or color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint subject_prefs_bring_len check (char_length(bring) <= 120)
);

-- Who saved a version last (a parent or, since 21/11/2026, the child through the server).
alter table public.timetables add column if not exists updated_by uuid references public.profiles (id) on delete set null;

-- Integrity: the child belongs to the SAME family as the row (same pattern as 0014 / 0020 / 0022).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'extra_classes_child_family_fk' and conrelid = 'public.extra_classes'::regclass) then
    alter table public.extra_classes add constraint extra_classes_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subject_prefs_child_family_fk' and conrelid = 'public.subject_prefs'::regclass) then
    alter table public.subject_prefs add constraint subject_prefs_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.extra_classes enable row level security;
alter table public.subject_prefs enable row level security;

revoke all on public.extra_classes from public, anon, authenticated;
revoke all on public.subject_prefs from public, anon, authenticated;
grant select on public.extra_classes to authenticated;
grant select on public.subject_prefs to authenticated;
grant all on public.extra_classes to service_role;
grant all on public.subject_prefs to service_role;

drop policy if exists parent_select on public.extra_classes;
create policy parent_select on public.extra_classes for select to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id());
drop policy if exists child_select_own on public.extra_classes;
create policy child_select_own on public.extra_classes for select to authenticated
  using (public.auth_role() = 'child' and child_id = auth.uid());

drop policy if exists parent_select on public.subject_prefs;
create policy parent_select on public.subject_prefs for select to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id());
drop policy if exists child_select_own on public.subject_prefs;
create policy child_select_own on public.subject_prefs for select to authenticated
  using (public.auth_role() = 'child' and child_id = auth.uid());
