-- 0004_device_pairing.sql — S4b (parent decision 17/10/2026: pair a laptop with a 6-digit
-- code shown on the parent's phone). ADDITIVE and idempotent; nothing is dropped or changed.
--
-- device_pair_codes: one short-lived code per request. Only the code's HASH is stored.
-- Server-only table: RLS on with NO policy for browsers (like push_subscriptions), so
-- neither a child nor a parent browser can read or write it; routes use service_role.

create table if not exists public.device_pair_codes (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  child_id    uuid not null references public.profiles (id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    integer not null default 0 check (attempts >= 0),
  used_at     timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists device_pair_codes_child_idx on public.device_pair_codes (child_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'device_pair_codes_child_family_fk' and conrelid = 'public.device_pair_codes'::regclass
  ) then
    alter table public.device_pair_codes add constraint device_pair_codes_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.device_pair_codes enable row level security;
revoke all on public.device_pair_codes from anon, authenticated;
grant all on public.device_pair_codes to service_role;

-- Looking up a device by its token hash on every extension poll.
create index if not exists extension_devices_token_hash_idx on public.extension_devices (token_hash);

-- One try at a code, counted ATOMICALLY before the comparison (parallel requests cannot
-- get more than 5 tries). Returns the new try count, or null when the code is used,
-- expired, or out of tries. service_role only.
create or replace function public.pair_code_try(p_code_id uuid)
returns integer
language sql
security invoker
set search_path = public
as $$
  update public.device_pair_codes
     set attempts = attempts + 1
   where id = p_code_id and used_at is null and expires_at > now() and attempts < 5
  returning attempts;
$$;
revoke all on function public.pair_code_try(uuid) from public, anon, authenticated;
grant execute on function public.pair_code_try(uuid) to service_role;

-- Whether the extension may run in InPrivate / incognito windows (reported on each poll),
-- so the parent's "Thiết bị" page can warn when private windows are not covered.
alter table public.extension_devices add column if not exists incognito_allowed boolean;
grant select (incognito_allowed) on public.extension_devices to authenticated;
