-- PREVIEW ONLY. Run by .github/workflows/preview-db-reset.yml after guard.sh, db-guard.sh and
-- `preview-db.mjs wipe` have all passed. NOT a migration: never put this in supabase/migrations.
--
-- Empties the app schema so `supabase db push --include-all` can rebuild it from
-- supabase/migrations, exactly like a fresh project:
--   * drops and recreates schema public (all app tables, functions, and the storage policies
--     that depend on public functions — the migrations recreate them);
--   * drops supabase_migrations (the CLI's "already applied" list), otherwise db push would
--     think every migration is still there and apply nothing.
-- Not touched: auth (accounts are deleted through the Auth API by `wipe`), storage buckets
-- (kept; migrations upsert them), extensions, roles.
--
-- Third, in-database check (same rule as db-guard.sh / lib.mjs): if ANY login that is not a
-- test account exists, raise an error, so the whole transaction rolls back and nothing is dropped.

begin;

do $$
begin
  if exists (
    select 1 from auth.users
     where email is null
        or lower(split_part(email, '@', 2)) not in ('example.com', 'study-launcher.local')
  ) then
    raise exception 'preview reset refused: this database has a non-test account (production?)';
  end if;
end
$$;

drop schema if exists public cascade;
create schema public;
-- Same access as a fresh Supabase project. No default privileges are recreated, which matches
-- the real project's "Automatically expose new tables" = OFF: every migration grants explicitly.
grant usage on schema public to anon, authenticated, service_role;

drop schema if exists supabase_migrations cascade;

commit;
