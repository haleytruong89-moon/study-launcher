-- 0012 (R3b, docs/BINH_YEN_BIEU_TUONG.md §B "Bản 2", parent decision 07/11/2026): the child may
-- bring a character drawn on Picrew instead of the one made in the app. Up to 4 pictures, one
-- per face (bình yên, vui, buồn, bực); a face without its own picture uses the first one.
-- Drawings only, never a photo of the child: the app cannot check that, so the family sees the
-- pictures and a parent can remove them.
--
-- Additive and idempotent. Browsers only READ (the whole family, from the app's own address
-- /api/files/avatar); every write goes through the server (POST /api/profile/avatar/pics,
-- which checks size and file type), so there is no insert/update/delete policy here.

-- Private bucket: 1 MB per picture, PNG or JPEG only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- avatars/{family_id}/{child_id}/{uuid}.png|jpg — anyone in the family may look.
drop policy if exists avatars_family_select on storage.objects;
create policy avatars_family_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.auth_family_id()::text
  );

-- Which picture goes with which face: {"calm": "<path>", "smile": ..., "sad": ..., "angry": ...}.
alter table public.profiles add column if not exists avatar_pics jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_pics_shape_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_avatar_pics_shape_check
      check (avatar_pics is null or (jsonb_typeof(avatar_pics) = 'object' and pg_column_size(avatar_pics) <= 2048));
  end if;
end $$;

-- Read like the icon and the character (0003, 0011). No update grant: server only.
grant select (avatar_pics) on public.profiles to authenticated;
revoke update (avatar_pics) on public.profiles from anon, authenticated;
