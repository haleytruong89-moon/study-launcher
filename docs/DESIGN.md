# Study Launcher — DESIGN v0.2

> Thiết kế kỹ thuật cho `docs/SPEC.md` v0.2. Spec trả lời **làm gì**; file này trả lời **làm thế nào**.
> Cập nhật: 05/10/2026. Thay đổi quyết định kiến trúc → bàn trên Claude.ai trước, rồi sửa file này.

## 0. Tổng quan

```
 iPhone phụ huynh (PWA)           Laptop con (Windows)
 ├─ Giao bài, duyệt, xem gộp      ├─ Chrome/Edge: Launcher (PWA) ── Hôm nay, phiên học, ảnh
 └─ Nhận Web Push                 └─ Extension MV3 ── chặn/mở web theo trạng thái
            │                                  │  (token thiết bị, hỏi 1 phút/lần)
            ▼                                  ▼
        Next.js trên Vercel (route handlers = nơi DUY NHẤT ghi dữ liệu nghiệp vụ)
        └─ lib/dayState.ts  ← hàm thuần, nguồn sự thật cho "đang khóa hay mở"
            │
            ▼
        Supabase riêng: Postgres (RLS mọi bảng) · Auth · Storage (ảnh) 
```

Nguyên tắc xuyên suốt:
1. **Server quyết định, client chỉ hiển thị.** Mọi thời lượng tính theo giờ server. Con không ghi trực tiếp vào bảng nghiệp vụ.
2. **Một hàm duy nhất tính trạng thái** (`computeDayState`) dùng cho cả Launcher lẫn extension, nên 2 bên không bao giờ lệch nhau.
3. **Fail-closed:** không chắc trạng thái thì khóa (chỉ mở allowlist).
4. **Mọi tham số nằm trong DB** (`family_settings`, allowlist, mẫu việc); không hard-code luật gia đình.

## 1. Stack

| Lớp | Chọn | Lý do |
|---|---|---|
| Web app | Next.js (App Router) + TypeScript + Tailwind CSS | Cùng hệ với App Toán; phụ huynh đã quen quy trình Vercel |
| PWA | `manifest.webmanifest` + service worker tự viết (`public/sw.js`) | Cần cài lên Home Screen iOS để có Web Push |
| DB/Auth/Storage | **Supabase project riêng** (không dùng chung App Toán) | Tách rủi ro: lỗi migration Launcher không chạm dữ liệu học Toán |
| Hosting | Vercel (Hobby) | Auto-deploy từ GitHub, preview mỗi PR |
| Push | Thư viện `web-push` + khóa VAPID | Chuẩn Web Push, chạy cả iOS 16.4+ (PWA đã cài) |
| Extension | Manifest V3, chạy Chrome + Edge, thư mục `extension/` trong cùng repo | Một codebase, chung kiểu dữ liệu |
| Test | Vitest (bắt buộc cho `lib/dayState.ts`) | Máy trạng thái là phần dễ sai nhất |
| Múi giờ | `Asia/Ho_Chi_Minh` (UTC+7) | "Ngày" bắt đầu 00:00 giờ VN |

## 2. Tài khoản, vai trò, đăng nhập

| Ai | Tài khoản Supabase Auth | Đăng nhập ở đâu |
|---|---|---|
| Phụ huynh (1–2 người) | Email thật + mật khẩu | iPhone (PWA) + máy tính riêng |
| Mỗi con | Email nội bộ do phụ huynh tạo (vd `nguyen@<family>.local`) + mật khẩu ngẫu nhiên mạnh; **con không cần biết mật khẩu** | Phụ huynh đăng nhập 1 lần trên laptop / iPad của con; phiên được giữ lâu (refresh token) |

- Tài khoản con được tạo từ trang quản trị của phụ huynh (route server dùng `service_role`, giống App Toán).
- Màn "Chọn profile + PIN" (mockup màn 1): liệt kê **các profile đã đăng nhập trên trình duyệt này** + nút "Phụ huynh". Mỗi laptop thường chỉ có 1 con.
- **PIN con** (4 số): khóa nhẹ để em không mở nhầm profile anh/chị; kiểm ở server.
- **PIN phụ huynh** dùng trên máy con cho các thao tác override / cài đặt nhanh, **không** đăng nhập phụ huynh trên máy con:
  - Route `POST /api/parent-pin/*` nhận PIN → so `pin_hash` (bcrypt/argon2) ở server → thực hiện thao tác bằng `service_role` → ghi `audit_log`.
  - Sai 5 lần → khóa nhập 15 phút (`pin_failed_count`, `pin_locked_until`).
- Trang cài đặt đầy đủ (allowlist, mẫu việc, ngưỡng) chỉ mở khi **đăng nhập tài khoản phụ huynh**.

## 3. Thời gian & "ngày"

- `localDate(now)` = ngày theo `Asia/Ho_Chi_Minh`. Mọi bảng theo ngày dùng cột `local_date date`.
- Không bao giờ đọc giờ máy client để tính thời lượng. Client chỉ hiển thị đồng hồ đếm, mốc thời gian lấy từ server (`serverNow` trả kèm mọi response).
- Tuần bắt đầu **thứ Hai** (thẻ miễn, thống kê tuần, chế độ Tin tưởng).

## 4. Schema (migration `0001_init.sql`)

Tất cả bảng có `id uuid default gen_random_uuid()` (trừ khi ghi khác), `created_at timestamptz default now()`, **RLS bật**.

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `families` | name, timezone default `'Asia/Ho_Chi_Minh'` | 1 dòng |
| `profiles` | id = `auth.users.id`, family_id, role (`parent`/`child`), display_name, grade, color, pin_hash, pin_failed_count, pin_locked_until, bedtime (time, mặc định 21:30) | |
| `family_settings` | family_id (pk), break_minutes 10, free_minutes 45, extra_min_minutes 20, skill_min_minutes 20, passes_per_week 1, trust_up_pct 90, trust_up_weeks 3, trust_down_pct 70, homework_lookahead_days 1, photo_retention_days 120 | **Toàn bộ "luật gia đình"** |
| `app_slots` | family_id, child_id, subject, kind (`internal`/`external`/`placeholder`), label, url, allow_domains text[], active | Slot app môn học; domain của slot tự vào allowlist |
| `task_templates` | family_id, child_id, part (`extra`/`skill`), title, subject, app_slot_id, weekdays smallint[] (1=T2 … 7=CN), min_minutes, deep_link, pillar, sort, active | Bài bổ sung + kỹ năng **theo thứ trong tuần** |
| `homework_items` | family_id, child_id, subject, due_date, note, photo_paths text[], created_by, done_at, archived_at | Bài trên lớp phụ huynh giao |
| `task_runs` | family_id, child_id, local_date, source (`homework`/`template`), homework_item_id, template_id, started_at, done_at, proof_paths text[], parent_verdict (`ok`/`not_ok`/null), verdict_at | 1 lần làm 1 việc; phút = done_at − started_at |
| `day_sessions` | pk (child_id, local_date), day_type (`normal`/`sick`/`exam`/`holiday`), disabled_template_ids uuid[], break_started_at, break_ended_at, break_skipped, part1_done_at, part2_done_at, free_started_at, pass_used_at | Mốc của ngày; tạo lười khi đọc lần đầu |
| `overrides` | child_id, local_date, kind (`open_until`/`lock_until`), until, created_by, reason | Override phụ huynh; **bản ghi mới nhất còn hiệu lực thắng**; `until` bị cắt ở 00:00 |
| `allowlist_entries` | family_id, child_id (null = cả nhà), domain, grp (`system`/`internal`/`external`/`dictionary`/`child_pick`/`request`), expires_at (null = vĩnh viễn), created_by | |
| `unlock_requests` | family_id, child_id, url, domain, reason, status (`pending`/`approved_15m`/`approved_day`/`approved_permanent`/`denied`), decided_at, decided_by | Duyệt → tạo `allowlist_entries` có `expires_at` |
| `extension_devices` | family_id, child_id, token_hash, label, last_seen_at, revoked_at | Token ghép đôi, chỉ lưu hash |
| `push_subscriptions` | profile_id, endpoint (unique), p256dh, auth, user_agent | |
| `trust_state` | child_id (pk), mode (`lock`/`trust`), since, updated_by | Phụ huynh xác nhận chuyển chế độ |
| `audit_log` | family_id, actor_id, action, payload jsonb | Override, duyệt, đổi cài đặt |

**RLS (tóm tắt):**
- Hàm trợ giúp `security definer stable`: `auth_family_id()`, `auth_role()`.
- **Phụ huynh:** select/insert/update/delete mọi dòng có `family_id = auth_family_id()`.
- **Con:** chỉ **select** dòng của chính mình (`child_id = auth.uid()`) + `family_settings`, `app_slots`, `allowlist_entries` của gia đình. **Không có quyền ghi** bảng nghiệp vụ; mọi thao tác của con đi qua route server (mục 6), route kiểm luật rồi ghi bằng `service_role`.
- `service_role` **chỉ** dùng trong route server, không bao giờ xuất hiện ở client hay extension.

**Seed (sau khi tạo gia đình):** allowlist mặc định — domain Launcher, `math-app-gules.vercel.app`, `translate.google.com`, `dictionary.cambridge.org`, `tratu.soha.vn`, `accounts.google.com`; 2 profile con; `family_settings` mặc định.

## 5. Máy trạng thái — `lib/dayState.ts`

Hàm thuần, không I/O, test bằng Vitest với `now` truyền vào:

```ts
computeDayState(input: DayInput, now: Date): DayState

type Status =
  | 'LOCK_P1' | 'BREAK_OFFER' | 'BREAK' | 'LOCK_P2'
  | 'FREE' | 'LOCK_END'          // luồng thường
  | 'OPEN_SICK' | 'OPEN_TRUST' | 'OPEN_OVERRIDE' | 'LOCK_OVERRIDE'

interface DayState {
  status: Status
  open: boolean                // extension chỉ cần trường này + allowlist
  openUntil: string | null     // ISO, để extension đặt alarm đúng lúc
  part1: { total: number; done: number; items: TaskView[] }
  part2: { total: number; done: number; locked: boolean; items: TaskView[] }
  passAvailable: boolean
  week: { date: string; result: 'ok' | 'pass' | 'miss' | 'today' | 'sick' }[]   // 7 ngày qua
  trust: { mode: 'lock' | 'trust'; weeksMet: number; weeksNeeded: number }
  serverNow: string
}
```

Thứ tự ưu tiên (đánh giá từ trên xuống, gặp điều kiện đúng thì dừng):

| # | Điều kiện | Status | open |
|---|---|---|---|
| 1–2 | Có override còn hiệu lực → lấy **bản mới nhất**: `lock_until` → LOCK_OVERRIDE; `open_until` → OPEN_OVERRIDE | LOCK_OVERRIDE / OPEN_OVERRIDE | ✗ / ✓ đến `until` |
| 3 | `trust_state.mode = trust` | OPEN_TRUST | ✓ (vẫn hiện việc + nhắc) |
| 4 | `day_type = sick` | OPEN_SICK | ✓ cả ngày |
| 5 | `free_started_at` có và `now ≥ free_started_at + free_minutes` | LOCK_END | ✗ |
| 6 | `free_started_at` có (do xong Phần 2 hoặc dùng thẻ) | FREE | ✓ đến hết 45' |
| 7 | Phần 1 chưa xong | LOCK_P1 | ✗ |
| 8 | Chưa nghỉ, chưa bỏ qua nghỉ | BREAK_OFFER | ✗ |
| 9 | `break_started_at` có, chưa `break_ended_at`, và `now < break_started_at + break_minutes` | BREAK | ✓ đến hết nghỉ |
| 10 | còn lại (Phần 2 chưa xong) | LOCK_P2 | ✗ |

Quy tắc phụ:
- **Mọi `openUntil` bị cắt ở 00:00** giờ VN của ngày hiện tại (nghỉ, giờ tự do, override).
- **Phần không có việc nào** (vd ngày thi tắt hết mẫu việc, ngày không có kỹ năng) = coi như đã xong; mốc `part1_done_at` / `part2_done_at` + `free_started_at` được ghi lười ở lần đọc đầu tiên thấy điều kiện đúng (trong transaction).
- **`part2.locked` tính từ dữ liệu, không từ status web**: khóa khi chưa có `part1_done_at` hoặc (chưa nghỉ xong và chưa bỏ qua nghỉ). Nhờ vậy ở OPEN_TRUST / OPEN_SICK / override, thứ tự Phần 1 → Phần 2 vẫn giữ.
- Phút tối thiểu của một việc = `task_templates.min_minutes` nếu có, nếu không lấy `extra_min_minutes` / `skill_min_minutes` trong `family_settings`.
- **Phần 1** = `homework_items` chưa `done_at`, chưa `archived_at`, `due_date ≤ localDate + homework_lookahead_days` + `task_templates` part `extra` có `weekday` hôm nay, không nằm trong `disabled_template_ids`. Slot `placeholder` **vẫn hiện** thành dòng "đang xây" (trả trong `items` với cờ `placeholder: true`) nhưng **không tính** vào total/done.
- **Phần 2** = `task_templates` part `skill` của thứ hôm nay. Khóa khi status ∈ {LOCK_P1, BREAK_OFFER, BREAK}.
- Phần 1 xong lần đầu → ghi `part1_done_at`. Phụ huynh giao thêm bài **sau** mốc này → bài hiện trong danh sách nhưng **không khóa lại** ngày đó.
- Phần 2 xong → ghi `part2_done_at` và `free_started_at = now` (cùng một transaction).
- Thẻ miễn: còn thẻ khi số `pass_used_at` trong tuần (T2–CN) < `passes_per_week` **và hôm nay chưa có `free_started_at`** (không cho dùng thẻ để có giờ tự do lần 2). Dùng → `pass_used_at = now`, `free_started_at = now`.
- "Ngày đạt" (cho thống kê tuần và chế độ Tin tưởng): có `part2_done_at` trước `bedtime`, **hoặc** dùng thẻ, **hoặc** `day_type ∈ {sick, holiday}`. Ngày thi (`exam`) **không** tự tính đạt. Tính lười khi đọc, không cần cron.
- Tiến độ Tin tưởng: đếm số tuần **liên tiếp gần nhất** có tỷ lệ ngày đạt ≥ `trust_up_pct`. Đủ `trust_up_weeks` → hiện gợi ý cho phụ huynh xác nhận. **Không tự chuyển chế độ.** Đang Tin tưởng mà 1 tuần < `trust_down_pct` → gợi ý quay lại Khóa.

**Bắt buộc có test** cho từng dòng của bảng ưu tiên + mốc biên (đúng giây hết 10', hết 45', qua 00:00, tuần mới).

## 6. API (Next.js route handlers)

Mọi route trả `serverNow`. Launcher gọi lại `GET /api/today` **mỗi 30 giây khi tab đang hiện** và mỗi khi tab được focus (đáp ứng tiêu chí "≤ 1 phút"). Route của con xác thực bằng phiên Supabase của con; route extension bằng `Bearer <device token>`.

| Route | Ai gọi | Việc làm |
|---|---|---|
| `GET /api/today` | con | Trả `DayState` + danh sách việc |
| `POST /api/tasks/start` | con | Tạo `task_run` (chặn nếu Phần 2 đang khóa; chặn nếu đã có run mở cho việc đó) |
| `POST /api/tasks/finish` | con | Kiểm `now − started_at ≥ min_minutes` (template) → nếu thiếu trả **409**. Homework: cần ≥ 1 `proof_path` → set `homework_items.done_at`. Cập nhật mốc phần |
| `POST /api/tasks/proof` | con | Ghi đường dẫn ảnh đã tải lên Storage vào `task_run` |
| `POST /api/day/break` | con | `start` / `skip` (chỉ ở BREAK_OFFER); `end` (chỉ ở BREAK — nút "Học tiếp", ghi `break_ended_at`) |
| `POST /api/day/pass` | con | Dùng thẻ miễn nếu còn; trả 409 nếu hôm nay đã có `free_started_at` |
| `POST /api/unlock-requests` | con (hoặc trang khóa) | Tạo yêu cầu (bỏ qua nếu cùng domain đang `pending`) → gửi push cho phụ huynh |
| `GET /api/unlock-requests/:id` | trang khóa | Trạng thái yêu cầu (hiện "đã duyệt" / "bị từ chối" / "bố mẹ chưa trả lời" sau 10 phút) |
| `POST /api/unlock-requests/:id/decide` | phụ huynh | Duyệt / từ chối → tạo allowlist có hạn |
| `POST /api/parent-pin/override` | máy con + PIN phụ huynh | `open_until` / `lock_until` / **cộng N phút** = tạo `open_until` mới tính từ `max(openUntil hiện tại, now)` (cắt ở 00:00) |
| `POST /api/parent-pin/verify` | máy con + PIN phụ huynh | Mở nhanh cài đặt nhẹ trên máy con (vd ghép extension) |
| `GET/POST /api/admin/*` | phụ huynh | Tài khoản con, cài đặt, allowlist, mẫu việc, slot, ngày đặc biệt, chế độ Tin tưởng, verdict |
| `POST /api/push/subscribe` | mọi profile | Lưu subscription |
| `POST /api/ext/pair` | máy con + PIN phụ huynh | Tạo token thiết bị (trả 1 lần, lưu hash) |
| `GET /api/ext/state` | extension | `{open, openUntil, allow: string[], blockAlways: string[], launcherUrl, pollSeconds, serverNow}`; cập nhật `last_seen_at` |
| `GET /api/cron/evening` | Vercel Cron (1 lần/ngày ~20:30 VN) | Push nhắc phụ huynh "xem gộp buổi tối" |

## 7. Extension (thư mục `extension/`)

**Manifest V3**, một bản cho cả Chrome và Edge.

| Phần | Thiết kế |
|---|---|
| Quyền | `declarativeNetRequestWithHostAccess`, `storage`, `alarms`, `tabs`; `host_permissions: ["<all_urls>"]`; `externally_connectable.matches` = domain Launcher |
| Trang chủ | Chính sách trang chủ của Chrome **không áp dụng** trên Windows không join domain → extension tự lo: `chrome_url_overrides.newtab` = trang chuyển hướng sang Launcher; `chrome.runtime.onStartup` mở 1 tab Launcher |
| Ghép đôi | Trên laptop con, trang `/devices` của Launcher (cần PIN phụ huynh) gọi `/api/ext/pair` → gửi token sang extension bằng `chrome.runtime.sendMessage(EXT_ID, {type:'pair', token, apiBase})`. Không cần gõ tay. ID extension khác nhau giữa Chrome Web Store, Edge Add-ons và bản dev → 2 biến môi trường `NEXT_PUBLIC_EXTENSION_ID_CHROME`, `NEXT_PUBLIC_EXTENSION_ID_EDGE`; trang ghép đôi thử lần lượt |
| Đồng bộ | `chrome.alarms` mỗi 1 phút + lúc khởi động + một alarm đặt đúng `openUntil`. Lưu trạng thái + allowlist + `fetchedAt` vào `chrome.storage.local` |
| Luật chặn (dynamic rules) | Khi khóa: (1) **block-all** `main_frame` → redirect sang `https://<launcher>/blocked?u=<url gốc>` (ưu tiên 1, `regexSubstitution`; URL gốc **không được mã hóa** → trang `/blocked` đọc nguyên phần sau `u=` kể cả `&`, `#`); (2) **allow** `requestDomains` = allowlist (ưu tiên 2); (3) **block** `translate.goog` (ưu tiên 3, thắng allow). Khi mở: gỡ hết luật |
| Quét tab | Khi chuyển mở → khóa: `chrome.tabs.query({})`, tab http(s) nào ngoài allowlist thì `chrome.tabs.update` sang trang khóa |
| Fail-closed | **Đếm số lần hỏi thất bại liên tiếp** (không dùng đồng hồ máy): ≥ 2 lần → áp **khóa** với allowlist đã lưu. `openUntil` cũ chỉ được tin khi lần hỏi gần nhất thành công. Chưa từng đồng bộ → chỉ cho domain Launcher |
| Phát hiện bị tắt | Server thấy `last_seen_at` > 10 phút trong khi laptop đang dùng → hiện cảnh báo trên trang phụ huynh (dấu hiệu có thể đã tắt extension) |
| Phát hành | Đóng gói đăng **unlisted** lên Chrome Web Store + Edge Add-ons (bắt buộc để cài kiểu ép buộc trên Windows không join domain — xem `docs/SETUP.md`) |
| Popup | Tối giản: trạng thái hiện tại + nút "Mở Launcher" |

## 8. Thông báo đẩy (Web Push)

- Khóa VAPID trong env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- `public/sw.js`: nhận `push` → hiện thông báo; `notificationclick` → mở `/parent/requests/<id>`.
- iOS: chỉ hoạt động khi PWA đã **Add to Home Screen**, và phải xin quyền từ một thao tác bấm của người dùng. Thông báo iOS không có nút hành động, nên "1 chạm" = chạm thông báo → trang có 4 nút duyệt. **Cần thử trên iPhone thật ở S5.**
- Dự phòng nếu push iOS không ổn: trang phụ huynh tự làm mới mỗi 30 giây khi đang mở + huy hiệu số yêu cầu chờ.

## 9. Ảnh & Storage

| Bucket | Ai ghi | Ai đọc | Đường dẫn |
|---|---|---|---|
| `homework` (private) | phụ huynh | phụ huynh, con của bài đó | `{family_id}/{child_id}/{due_date}/{uuid}.jpg` |
| `proofs` (private) | con (thư mục của mình) | phụ huynh, chính con | `{family_id}/{child_id}/{local_date}/{uuid}.jpg` |

- Nén ở client trước khi tải: cạnh dài ≤ 1600px, JPEG chất lượng 0.8 (~200–400 KB/ảnh).
- Hiển thị bằng signed URL có hạn.
- Ước tính dung lượng: ~8 ảnh/con/ngày × ~300 KB × 2 con ≈ 5 MB/ngày → 120 ngày ≈ 600 MB, dưới mức Storage gói free (≈ 1 GB — **cần kiểm tra lại giới hạn hiện hành**). Vì vậy giữ ảnh `photo_retention_days = 120` ngày; job hằng tuần xóa ảnh cũ hơn.

## 10. Vận hành

| Việc | Cách | Tần suất |
|---|---|---|
| Giữ Supabase free không tự dừng | GitHub Actions gọi 1 query nhẹ | Hằng ngày (như App Toán) |
| Sao lưu DB | GitHub Actions `pg_dump` (schema `public` + `auth.users`/`auth.identities`) → **mã hóa bằng `BACKUP_PASSPHRASE`** → artifact riêng tư 30 ngày. Không gồm file ảnh trong Storage. GitHub chỉ giữ file đã mã hóa nên không trái §11. Quy trình khôi phục: `docs/SETUP.md` phần E | Hằng tuần |
| Xóa ảnh quá hạn | GitHub Actions gọi `/api/cron/cleanup` (có secret) | Hằng tuần |
| Nhắc xem gộp | Vercel Cron → `/api/cron/evening` | Hằng ngày (Hobby: giờ chạy có thể lệch trong khung 1 giờ) |
| Migration | Claude viết file `supabase/migrations/NNNN_*.sql` (idempotent, additive) → **tự chạy lên production khi phụ huynh merge PR vào `main`** (Supabase GitHub integration, chỉ "Deploy to production"; CI chạy thử trên Postgres tạm trước đó) | Theo PR |

## 11. Bảo mật — checklist

- [ ] RLS bật cho **mọi** bảng và cả 2 bucket; có test SQL/manual cho: con A không đọc được dữ liệu con B.
- [ ] `service_role` chỉ ở server; extension chỉ cầm token thiết bị (thu hồi được).
- [ ] PIN và token lưu dạng hash; giới hạn số lần thử PIN.
- [ ] Không có đường nào để con tự ghi `day_sessions`, `overrides`, `allowlist_entries`, `trust_state`.
- [ ] Trang `/blocked` và các route của con không lộ dữ liệu của con khác.
- [ ] Dữ liệu trẻ vị thành niên: không gửi ra dịch vụ thứ ba (ngoài Supabase/Vercel); con được giải thích trong buổi họp gia đình (cùng tinh thần D18 của App Toán).

## 12. Cấu trúc thư mục đề xuất

```
study-launcher/
├─ CLAUDE.md
├─ docs/ (SPEC.md, DESIGN.md, SETUP.md, PROGRESS.md)
├─ app/
│  ├─ (child)/today, (child)/blocked
│  ├─ (parent)/parent/... (giao bài, duyệt, xem gộp, cài đặt)
│  ├─ profiles/, devices/
│  └─ api/... (mục 6)
├─ lib/ (dayState.ts, time.ts, supabase/{server,client}.ts, push.ts, images.ts)
├─ supabase/migrations/
├─ extension/ (manifest.json, background.ts, popup/, build script)
├─ public/ (manifest.webmanifest, sw.js, icons)
└─ tests/ (dayState.test.ts, ...)
```

## 13. Lát build (mỗi lát = 1 PR nhỏ, có preview Vercel)

| Lát | Nội dung | Tiêu chí nghiệm thu (SPEC §2.6) | Milestone |
|---|---|---|---|
| **S0** | Khung: Next.js + TS + Tailwind, Supabase client, `0001_init.sql` (schema + RLS + seed), đăng nhập phụ huynh, trang tạo tài khoản con, PWA manifest + SW rỗng, CI (lint, typecheck, test), **GitHub Actions giữ Supabase không ngủ + backup tuần** | RLS checklist §11 | M1 |
| **S1** | Phụ huynh: cài đặt gia đình, app slots, mẫu việc theo thứ, **giao bài có ảnh** (mobile) | "Giao bài" | M1 |
| **S2** | Con: `computeDayState` + **test đầy đủ**, màn Hôm nay, bắt đầu/xong + tối thiểu 20', ảnh bằng chứng, nghỉ, thẻ miễn, 7 ngày qua | "Hôm nay" | M1 |
| **S3** | Phụ huynh: xem gộp + Đạt/Chưa đạt, ngày đặc biệt, override bằng PIN trên máy con, gợi ý & xác nhận chế độ Tin tưởng, audit log, **job xóa ảnh quá hạn** (`/api/cron/cleanup`) | "Xem gộp", "Override & cấu hình" | M1 |
| **S4** | Extension: ghép đôi, `/api/ext/state`, luật chặn, quét tab, fail-closed, trang `/blocked`, **tab mới / khởi động → Launcher** | "Khóa web" | M2 |
| **S5** | Xin mở trang + Web Push (thử trên iPhone thật) + **nhắc xem gộp buổi tối** (`/api/cron/evening`) | "Xin mở trang" | M2 |
| **S6** | Cảnh báo extension mất kết nối; đóng gói đăng store (unlisted) | — | M2 |

Sau S6 → M3 (cấu hình 2 laptop theo `docs/SETUP.md` phần Windows) → pilot 3 tuần.

## 14. Để Claude Code tự quyết (không cần hỏi)

- Thư viện UI cụ thể (vd shadcn/ui hay Tailwind thuần), cách tổ chức component.
- Cách build extension (vd esbuild/Vite).
- Tên hàm/biến, cấu trúc test, miễn giữ đúng các nguyên tắc ở mục 0 và hành vi ở SPEC §2.6.

## 15. KHÔNG tự quyết — phải quay lại Claude.ai

- Đổi thứ tự ưu tiên trạng thái (mục 5) hoặc bất kỳ hành vi khóa/mở nào.
- Thêm Google Search / YouTube vào allowlist mặc định.
- Cho con quyền ghi trực tiếp vào bảng nghiệp vụ.
- Dùng chung Supabase với App Toán, thêm dịch vụ trả phí, thêm dịch vụ bên thứ ba nhận dữ liệu của con.
