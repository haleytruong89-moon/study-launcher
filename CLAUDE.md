# Study Launcher

Web app (PWA) + browser extension giúp 2 con (Nguyên lớp 9, An lớp 6) hình thành thói quen học: mở máy là thấy **việc hôm nay**; laptop **chỉ mở trang học** cho đến khi xong bài tập + kỹ năng; xong thì có **45 phút giờ tự do**, hết giờ khóa lại. Kiểm soát giảm dần qua **chế độ Tin tưởng**.

Người dùng: 2 con (laptop Windows + iPhone/iPad), phụ huynh (iPhone). Chủ dự án là phụ huynh, **không phải dev** — giải thích bằng tiếng Việt đơn giản, mỗi PR phải có hướng dẫn thử trên preview.

## Đọc trước khi làm bất cứ việc gì

1. `docs/SPEC.md` — đặc biệt §2.5 User stories, §2.6 **Tiêu chí nghiệm thu** (định nghĩa "xong").
2. `docs/DESIGN.md` — kiến trúc, schema, máy trạng thái (§5), API (§6), extension (§7), **lát build (§13)**.
3. `docs/PROGRESS.md` — lát nào đã xong, đang dở gì (tạo file này ở lát S0 nếu chưa có).

## Tech stack

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS — deploy Vercel
- Supabase **project riêng** (Postgres + Auth + Storage), RLS bật mọi bảng và bucket
- PWA: `public/manifest.webmanifest` + `public/sw.js` (Web Push qua `web-push` + VAPID)
- Extension Manifest V3 trong `extension/`, chạy Chrome + Edge
- Test: Vitest (bắt buộc cho `lib/dayState.ts`)
- Múi giờ nghiệp vụ: `Asia/Ho_Chi_Minh`; tuần bắt đầu thứ Hai

## Conventions

- Code, comment, tên file, commit message: **tiếng Anh**. Chữ hiển thị trên giao diện: **tiếng Việt**.
- camelCase cho biến/hàm TS; snake_case cho cột DB.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Mỗi lát = 1 nhánh `feature/sN-<ten-ngan>` = 1 PR nhỏ. Không gộp nhiều lát vào 1 PR.
- Mô tả PR (tiếng Việt) gồm: làm gì · cách thử trên link preview (từng bước bấm) · **SQL cần phụ huynh áp** (nếu có) · tiêu chí nghiệm thu nào đã đạt.
- Giao diện bám mockup: https://claude.ai/artifact/LmjBU4kbFczUKae43NvFNT (5 màn). Màu: nền `#F4F5F0`, chữ `#1C1F1D`, nhấn `#2B5D4F`; Nguyên `#2F5D9E`, An `#B85A1C`; font Be Vietnam Pro. Nút cao ≥ 44px.

## Key decisions (đã chốt — xem SPEC §18 log)

- **Server quyết định, client chỉ hiển thị.** Mọi thao tác của con đi qua route server; con **không có quyền ghi** bảng nghiệp vụ (RLS chỉ cho select).
- **Một hàm `computeDayState(input, now)`** là nguồn sự thật cho cả Launcher và extension.
- **Giờ server** cho mọi thời lượng; không tin đồng hồ máy con.
- **Fail-closed**: không chắc trạng thái → khóa (chỉ allowlist). Extension đếm lần hỏi thất bại, không dựa vào đồng hồ máy.
- Mọi khoảng mở (nghỉ, giờ tự do, override) **dừng ở 00:00**. Phần không có việc = đã xong. Override **mới nhất** thắng.
- Bài trên lớp: **không có thời gian tối thiểu**, bắt buộc ảnh bằng chứng. Bài bổ sung + kỹ năng: **tối thiểu 20 phút**.
- Bài bổ sung **bắt buộc** (thuộc Phần 1). Kỹ năng v1 = **danh sách cố định theo thứ trong tuần**.
- Nghỉ 10' (tùy chọn, 1 lần/ngày) · giờ tự do **45'** (1 lần/ngày) · thẻ miễn 1/tuần.
- Khi khóa: chỉ allowlist (app học + từ điển/dịch). **Không** Google Search, **không** YouTube. Luôn chặn `*.translate.goog`.
- Chế độ Tin tưởng: hệ thống **chỉ gợi ý**, phụ huynh xác nhận mới chuyển.
- Mọi luật gia đình là dữ liệu trong `family_settings` / allowlist / mẫu việc — **không hard-code**.

## Warnings — KHÔNG được làm

- Không dùng `service_role` ở client hoặc extension. Extension chỉ cầm token thiết bị.
- Không áp migration lên Supabase production. Viết file `supabase/migrations/NNNN_*.sql` (idempotent: `if not exists`, `create or replace`, `drop policy if exists`) → phụ huynh áp. **Không sửa** migration đã áp; tạo file mới.
- Không chạy `supabase db reset --linked`. Không xóa dữ liệu thật.
- Không đổi hành vi khóa/mở, thứ tự ưu tiên trạng thái (DESIGN §5), allowlist mặc định, hay quyền ghi của con. Thấy spec thiếu hoặc mâu thuẫn → **dừng lại, ghi vào PR / PROGRESS.md, hỏi phụ huynh** (DESIGN §15).
- Không thêm streak, bảng xếp hạng, điểm đổi giờ chơi (SPEC §15).
- Không thêm dịch vụ trả phí hoặc dịch vụ bên thứ ba nhận dữ liệu của con.
- Không commit secret (`.env*` trừ `.env.example`).

## Quy trình mỗi lát

1. Đọc SPEC §2.6 + DESIGN §13 cho lát đó → viết kế hoạch ngắn vào đầu PR.
2. Code → `npm run typecheck && npm run lint && npm test` phải xanh.
3. Tự kiểm theo tiêu chí nghiệm thu của lát; ghi cái nào đạt / chưa.
4. Mở PR (preview Vercel tự tạo) → cập nhật `docs/PROGRESS.md` (ngày, lát, trạng thái, việc còn mở, SQL cần áp).
5. Không merge — phụ huynh thử preview, áp SQL, rồi merge.

## Lệnh thường dùng

```bash
npm run dev            # chạy local
npm run typecheck      # tsc --noEmit
npm run lint
npm test               # vitest
npx supabase migration new <name>
npx supabase db push --dry-run   # phụ huynh chạy, không phải Claude
```

## Biến môi trường (`.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `NEXT_PUBLIC_EXTENSION_ID_CHROME`, `NEXT_PUBLIC_EXTENSION_ID_EDGE`, `NEXT_PUBLIC_APP_URL`

## Current status

- Phase: 3 — Implementation, **chưa bắt đầu**
- Last updated: 05/10/2026
- Tiếp theo: **S0 — Khung** (DESIGN §13)
- Việc phụ huynh song song: thử chính sách extension trên 1 laptop (`docs/SETUP.md` phần B); họp gia đình để chốt tham số (không chặn code).
