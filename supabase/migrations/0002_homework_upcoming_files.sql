-- 0002_homework_upcoming_files.sql — S2c (parent decisions 17/10/2026).
-- ADDITIVE and idempotent: adds one setting column and widens the homework bucket's file
-- types. Nothing is dropped, no row is deleted, no existing value is changed.
--
-- 1. family_settings.homework_min_upcoming: on a day with no homework due (overdue, today or
--    within homework_lookahead_days), the child must finish at least this many "Sắp tới"
--    (upcoming) homework items of their choice. 0 turns the rule off. Default 1.
-- 2. homework bucket: besides photos, parents may attach PDF, Word and Excel files.
--    The per-file limit stays 5 MB (already set in 0001). The proofs bucket is unchanged:
--    the child's proof stays a photo.

alter table public.family_settings
  add column if not exists homework_min_upcoming integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'family_settings_homework_min_upcoming_check'
      and conrelid = 'public.family_settings'::regclass
  ) then
    alter table public.family_settings
      add constraint family_settings_homework_min_upcoming_check
      check (homework_min_upcoming between 0 and 5);
  end if;
end $$;

-- Existing grants (0001: select/insert/update/delete on family_settings to authenticated,
-- RLS: parents of the family write, children read) already cover the new column.

update storage.buckets
set allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    file_size_limit = 5242880
where id = 'homework';
