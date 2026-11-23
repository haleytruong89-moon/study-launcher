-- 0028 Night lock (parent decision 23/11/2026): from night_lock_from to night_lock_to (local time,
-- may wrap past 00:00) nothing OPENS a child's laptop — no free time, break, pass, trust or
-- sick-day opening; study pages stay open as in any locked status; a parent's "Mở máy" still wins.
-- Family-wide; equal times = no night lock. Computed by computeDayState (lib/dayState/night.ts).
--
-- ADDITIVE and idempotent: two new family_settings columns with defaults 00:00 and 07:00.
-- Nothing is dropped, no existing row is changed beyond getting the defaults. family_settings
-- keeps its grants and policies (browsers read; the server writes the family's settings).
alter table public.family_settings
  add column if not exists night_lock_from time not null default '00:00';
alter table public.family_settings
  add column if not exists night_lock_to time not null default '07:00';
