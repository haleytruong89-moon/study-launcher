-- 0031_always_block.sql — "Luôn chặn": sites blocked even while the laptop is open (V1).
--
-- Parent decisions 27/11/2026 (docs/superpowers/specs/2026-11-27-vi-gio-choi-design.md D11, D16):
-- AI character chat sites (Character.ai, JanitorAI), Grok and AO3 are blocked for good, never
-- opened with play time. Extension 0.4 installs this list as a block rule in the OPEN state too
-- (free time, Tin tưởng, sick day, parent opened); while locked it already wins over the allowlist.
-- The list is family data: a parent adds or removes rows in "Trang học".
--
-- ADDITIVE and idempotent; one transaction:
--   1. Table always_block_entries (family-wide rows), RLS: parents of the family only. Children
--      never read it; /api/ext/state reads it with service_role.
--   2. The six default rows for every existing family (skips rows already there).
--   3. seed_family_defaults (new families) also adds them. Body = 0016's, plus step 2's insert.
--   4. extension_devices.ext_version: the version the extension reports on each poll, so the
--      parent's Thiết bị page can warn about laptops on an extension older than 0.4.

-- 1. Table ------------------------------------------------------------------------------------
create table if not exists public.always_block_entries (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  domain      text not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint always_block_domain_format check (domain ~ '^[a-z0-9.-]{1,253}$'),
  constraint always_block_family_domain_key unique (family_id, domain)
);

alter table public.always_block_entries enable row level security;

revoke all on public.always_block_entries from public, anon, authenticated;
grant select, insert, delete on public.always_block_entries to authenticated;
grant all on public.always_block_entries to service_role;

drop policy if exists parent_all on public.always_block_entries;
create policy parent_all on public.always_block_entries for all to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id())
  with check (public.auth_role() = 'parent' and family_id = public.auth_family_id());

-- 2. Existing families ------------------------------------------------------------------------
insert into public.always_block_entries (family_id, domain)
select f.id, v.domain
from public.families f
cross join (values ('character.ai'), ('c.ai'), ('janitorai.com'), ('grok.com'), ('archiveofourown.org'), ('ao3.org')) as v(domain)
on conflict (family_id, domain) do nothing;

-- 3. New families -----------------------------------------------------------------------------
create or replace function public.seed_family_defaults(p_family_id uuid, p_launcher_domain text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  d record;
begin
  insert into public.family_settings (family_id, allow_local_files)
  values (p_family_id, true)
  on conflict (family_id) do nothing;

  for d in
    select * from (values
      (p_launcher_domain,              'system'),
      ('math-app-gules.vercel.app',    'internal'),
      ('translate.google.com',         'dictionary'),
      ('dictionary.cambridge.org',     'dictionary'),
      ('tratu.soha.vn',                'dictionary'),
      ('accounts.google.com',          'system'),
      -- 12/11/2026: study sites open by default
      ('meet.google.com',              'external'),
      ('ogs.google.com',               'external'),
      ('apis.google.com',              'external'),
      ('contacts.google.com',          'external'),
      ('notebooklm.google.com',        'external'),
      ('notebooklm.google',            'external'),
      ('docs.google.com',              'external'),
      ('drive.google.com',             'external'),
      ('drive.usercontent.google.com', 'external'),
      ('forms.gle',                    'external'),
      ('zalo.me',                      'external')
    ) as v(domain, grp)
    where v.domain is not null and v.domain <> ''
  loop
    insert into public.allowlist_entries (family_id, child_id, domain, grp)
    select p_family_id, null, d.domain, d.grp
    where not exists (
      select 1 from public.allowlist_entries a
      where a.family_id = p_family_id and a.child_id is null and a.domain = d.domain
    );
  end loop;

  -- 0031 (27/11/2026): sites that stay blocked even while the laptop is open.
  insert into public.always_block_entries (family_id, domain)
  select p_family_id, v.domain
  from (values ('character.ai'), ('c.ai'), ('janitorai.com'), ('grok.com'), ('archiveofourown.org'), ('ao3.org')) as v(domain)
  on conflict (family_id, domain) do nothing;
end
$$;

revoke all on function public.seed_family_defaults(uuid, text) from public, anon, authenticated;
grant execute on function public.seed_family_defaults(uuid, text) to service_role;

-- 4. Extension version per device ------------------------------------------------------------
alter table public.extension_devices add column if not exists ext_version text;
grant select (ext_version) on public.extension_devices to authenticated;
