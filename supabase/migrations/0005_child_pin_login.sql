-- 0005_child_pin_login.sql — child signs in with a 6-digit PIN on a remembered browser
-- (parent decision 19/10/2026, child UI review). ADDITIVE and idempotent: nothing is
-- dropped, no existing row is changed.
--
-- The PIN itself lives in the columns 0001 already created on profiles (pin_hash,
-- pin_failed_count, pin_locked_until), which browsers can never read (no column grant).
--
-- pin_devices: browsers where the child has signed in once with the real password. Only
-- such a browser can use the PIN (an httpOnly cookie holds a random token; only its
-- SHA-256 is stored here). Server-only table: RLS on, NO policy, no browser grants.

create table if not exists public.pin_devices (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  child_id      uuid not null references public.profiles (id) on delete cascade,
  token_hash    text not null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  unique (token_hash, child_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pin_devices_child_family_fk' and conrelid = 'public.pin_devices'::regclass
  ) then
    alter table public.pin_devices add constraint pin_devices_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.pin_devices enable row level security;
revoke all on public.pin_devices from anon, authenticated;
grant all on public.pin_devices to service_role;

-- One PIN try, counted ATOMICALLY before the comparison (parallel requests cannot get more
-- than 5 tries): the 5th try in a row locks the PIN for 15 minutes (SPEC 2.6: "sai 5 lần
-- -> khóa nhập 15 phút"). A lock that has ended starts the count again at 1.
-- Returns the try number (1..5), or no row when the PIN is locked or not set.
-- service_role only.
create or replace function public.child_pin_try(p_child uuid)
returns integer
language sql
security invoker
set search_path = public
as $$
  update public.profiles
     set pin_failed_count = case when pin_locked_until <= now() then 1 else pin_failed_count + 1 end,
         pin_locked_until = case
           when (case when pin_locked_until <= now() then 1 else pin_failed_count + 1 end) >= 5 then now() + interval '15 minutes'
           else null
         end
   where id = p_child
     and role = 'child'
     and pin_hash is not null
     and (pin_locked_until is null or pin_locked_until <= now())
  returning pin_failed_count;
$$;
revoke all on function public.child_pin_try(uuid) from public, anon, authenticated;
grant execute on function public.child_pin_try(uuid) to service_role;
