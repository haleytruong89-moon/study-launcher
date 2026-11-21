-- 0024 G6 of the maths tutor (repo gia-su-ai-math, plan docs/superpowers/plans/2026-11-21-g6-cards-and-review.md;
-- parent decisions 21/11/2026: D26 start-of-session review, design C teaching cards, Y1–Y5).
--
-- ADDITIVE and idempotent. Two CHECK constraints are re-created wider; one new CHECK on a new column.
-- No data is dropped.
--
-- 1. tutor.messages.card_ref: the approved teaching card shown with a tutor message
--    ("T6.12#1" = card T6.12, way 1; "D6.1#2" = reading card D6.1, way 2). The app renders the
--    card text from the repo's approved bundle; the database keeps only the reference.
-- 2. tutor.review_items: review questions now also come from approved cards (Y2):
--    kind += why / recognize, source += card, columns card_code + item_key,
--    one item per (child, card, question key). Browsers still never read `answer`.

-- 1 ------------------------------------------------------------------------------------------
alter table tutor.messages add column if not exists card_ref text;
alter table tutor.messages drop constraint if exists messages_card_ref_format;
alter table tutor.messages add constraint messages_card_ref_format
  check (card_ref is null or card_ref ~ '^(T6|T9|N7|N8|TH|D6|D9)\.[0-9]{1,2}#[12]$');

-- 2 ------------------------------------------------------------------------------------------
alter table tutor.review_items drop constraint if exists review_items_kind_check;
alter table tutor.review_items add constraint review_items_kind_check
  check (kind in ('formula', 'mini_problem', 'why', 'recognize'));
alter table tutor.review_items drop constraint if exists review_items_source_check;
alter table tutor.review_items add constraint review_items_source_check
  check (source in ('seed', 'diagnosis', 'parent', 'card'));
alter table tutor.review_items add column if not exists card_code text;
alter table tutor.review_items add column if not exists item_key text;
create unique index if not exists review_items_card_uidx on tutor.review_items (child_id, card_code, item_key)
  where deleted_at is null and card_code is not null;

-- 0017 grants review_items to browsers per column (never `answer`): add the two new columns.
grant select (card_code, item_key) on tutor.review_items to authenticated;
