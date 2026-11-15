-- 0019_tutor_images.sql — Gia sư AI Toán, lát G3: photos of problems and of the child's work
-- (gia-su-ai-math DOMAIN §2 attachments, §4.8, §5).
-- Additive and idempotent. Only the tutor server (service role) reads and writes this bucket:
-- there is no storage policy for browsers, so RLS on storage.objects denies them; the screen gets
-- 10-minute signed URLs. Photos are already cleaned (EXIF removed, resized, JPEG) by the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tutor-images', 'tutor-images', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Which child message a photo was sent with (a problem holds up to 4 photos: the problem, then work).
-- The table grants and RLS policies of 0017 cover the new column.
alter table tutor.attachments add column if not exists message_id uuid references tutor.messages (id) on delete cascade;
create index if not exists attachments_problem_idx on tutor.attachments (problem_id, created_at);
