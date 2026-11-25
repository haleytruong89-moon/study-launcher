-- 0029 "Ôn tập trong Launcher" (parent decision 25/11/2026): the review apps made in Xưởng ôn tập
-- (one self-contained .html file each) run at /on-tap/<slug> on the Launcher's own address, so a
-- child opens them on the iPad and on the locked laptop without claude.ai and without a login
-- other than the Launcher's. The files are copyrighted study material for the family only, so they
-- live in a PRIVATE bucket, never in the (public) repository.
--
-- study_apps: one row per app of the family. A parent adds / replaces / turns off an app with their
--   OWN session (parent_all, like task_templates). A child may only READ the active apps meant for
--   them (child_id = them) or for the whole family (child_id null).
-- bucket study-apps: {family_id}/{slug}-{random}.html. Parents of the family write; every member of
--   the family reads (the page streams the file with the viewer's session, like /api/files/avatar).
--
-- ADDITIVE and idempotent: one new table, one new bucket, their grants and policies. Nothing is
-- dropped and no existing row is changed.

create table if not exists public.study_apps (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  child_id    uuid references public.profiles (id) on delete cascade, -- null = whole family
  slug        text not null,
  title       text not null,
  file_path   text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint study_apps_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  constraint study_apps_title_len check (char_length(btrim(title)) between 1 and 80),
  constraint study_apps_path_format check (file_path ~ '^[0-9a-f-]{36}/[a-z0-9-]+\.html$')
);
create unique index if not exists study_apps_family_slug_idx on public.study_apps (family_id, slug);

-- Integrity: a named child belongs to the SAME family as the row (same pattern as 0025 / 0026).
-- A null child_id (whole family) skips the check, as foreign keys do.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'study_apps_child_family_fk' and conrelid = 'public.study_apps'::regclass) then
    alter table public.study_apps add constraint study_apps_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.study_apps enable row level security;

revoke all on public.study_apps from public, anon, authenticated;
grant select, insert, update, delete on public.study_apps to authenticated;
grant all on public.study_apps to service_role;

drop policy if exists parent_all on public.study_apps;
create policy parent_all on public.study_apps for all to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id())
  with check (public.auth_role() = 'parent' and family_id = public.auth_family_id());

drop policy if exists child_select_own on public.study_apps;
create policy child_select_own on public.study_apps for select to authenticated
  using (
    public.auth_role() = 'child'
    and family_id = public.auth_family_id()
    and active
    and (child_id is null or child_id = auth.uid())
  );

-- Private bucket: HTML only, at most 5 MB a file (the biggest app today is about 250 KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-apps', 'study-apps', false, 5242880, array['text/html'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists study_apps_parent_all on storage.objects;
create policy study_apps_parent_all on storage.objects
  for all to authenticated
  using (
    bucket_id = 'study-apps'
    and public.auth_role() = 'parent'
    and (storage.foldername(name))[1] = public.auth_family_id()::text
  )
  with check (
    bucket_id = 'study-apps'
    and public.auth_role() = 'parent'
    and (storage.foldername(name))[1] = public.auth_family_id()::text
  );

drop policy if exists study_apps_member_select on storage.objects;
create policy study_apps_member_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'study-apps'
    and (storage.foldername(name))[1] = public.auth_family_id()::text
  );
