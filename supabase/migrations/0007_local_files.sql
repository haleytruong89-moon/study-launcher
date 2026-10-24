-- 0007_local_files.sql — "Cho mở file HTML / PDF trên máy trong giờ học"
-- (parent decision 24/10/2026). ADDITIVE and idempotent: one new setting, OFF by default,
-- so nothing changes until a parent turns it on in "Luật trong nhà".
-- When on, the extension does not send file:///…/*.html|*.htm|*.pdf tabs to the lock page
-- while the laptop is in study time. Links inside such a file still follow the allowlist.

alter table public.family_settings add column if not exists allow_local_files boolean not null default false;
