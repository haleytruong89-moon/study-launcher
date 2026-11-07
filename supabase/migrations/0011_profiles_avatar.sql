-- 0011 (R3a, docs/BINH_YEN_BIEU_TUONG.md §B, parent decisions 07/11/2026): the child's own
-- character, made in the app. Stored next to the child's icon in profiles (the family sees it,
-- like the icon). Only CODES from a fixed list (hair, eyes, skin, outfit, accessory) plus an
-- optional character name (<= 24 characters); never a photo, never a feeling.
--
-- Additive and idempotent. Writes go through the server only (POST /api/profile/avatar, which
-- checks every code against lib/avatar.ts): browsers may READ the column, never write it.

alter table public.profiles add column if not exists avatar jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_shape_check' and conrelid = 'public.profiles'::regclass
  ) then
    -- A small JSON object, or nothing. The server checks the codes themselves.
    alter table public.profiles add constraint profiles_avatar_shape_check
      check (avatar is null or (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) <= 1024));
  end if;
end $$;

-- Read like the icon (0003). No update grant: the child writes through the server only.
grant select (avatar) on public.profiles to authenticated;
revoke update (avatar) on public.profiles from anon, authenticated;
