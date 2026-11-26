-- 0030 Maths tutor: "cách làm" (worked-example) teaching cards C6.*, C9.* (repo gia-su-ai-math, D37,
-- parent decision 26/11/2026: "giảng các cách → bài mẫu → con tự làm").
--
-- ADDITIVE and idempotent. One CHECK constraint is re-created wider (as in 0024); no data is dropped,
-- every existing value still passes. Without it the tutor cannot save a message that shows card C6.1.
--
-- tutor.messages.card_ref: "T6.12#1" (hiểu bản chất), "D6.1#2" (đọc đề), and now "C6.1#1" (cách làm).

alter table tutor.messages drop constraint if exists messages_card_ref_format;
alter table tutor.messages add constraint messages_card_ref_format
  check (card_ref is null or card_ref ~ '^(T6|T9|N7|N8|TH|D6|D9|C6|C9)\.[0-9]{1,2}#[12]$');
