-- 0016_default_study_sites.sql — study sites open by default (parent decision 12/11/2026).
--
-- The parent wants these on for good, without tapping "Thêm nhanh" in every new setup:
--   Google Meet, NotebookLM, Google Docs / Drive / Forms, Zalo (zalo.me covers chat.zalo.me),
--   and saved .html / .htm / .pdf files on the laptop during study time.
-- The domain lists match lib/admin/presets.ts (tests/defaultStudySites.test.ts checks this).
--
-- ADDITIVE and idempotent; one transaction:
--   1. seed_family_defaults (new families) also adds these sites and turns local files on.
--   2. Every existing family gets the family-wide rows it does not have yet (nothing is
--      changed or removed; a parent can still remove any of them in "Trang được mở").
--   3. allow_local_files: the column default becomes true, and existing families are turned
--      on once. Re-running is harmless (it only sets true where it is false — a parent who
--      later turns it off again would be turned back on ONLY if this file ran again, which
--      Supabase never does for an applied migration).
-- Google Search, YouTube and *.translate.goog stay blocked (the extension enforces that).

-- 1. New families -----------------------------------------------------------------------------
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
end
$$;

revoke all on function public.seed_family_defaults(uuid, text) from public, anon, authenticated;
grant execute on function public.seed_family_defaults(uuid, text) to service_role;

-- 2. Existing families: add the missing family-wide, permanent rows ---------------------------
insert into public.allowlist_entries (family_id, child_id, domain, grp)
select f.id, null, v.domain, 'external'
from public.families f
cross join (values
  ('meet.google.com'), ('ogs.google.com'), ('apis.google.com'), ('contacts.google.com'),
  ('notebooklm.google.com'), ('notebooklm.google'),
  ('docs.google.com'), ('drive.google.com'), ('drive.usercontent.google.com'), ('forms.gle'),
  ('zalo.me')
) as v(domain)
where not exists (
  select 1 from public.allowlist_entries a
  where a.family_id = f.id and a.child_id is null and a.expires_at is null and a.domain = v.domain
);

-- 3. Local .html / .pdf files on by default ---------------------------------------------------
alter table public.family_settings alter column allow_local_files set default true;
update public.family_settings set allow_local_files = true where allow_local_files = false;
