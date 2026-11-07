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
- **PIN con** (*đổi 19/10/2026: 6 số, bố mẹ đặt ở Thêm › Các con*): con chọn tên mình trên trang đăng nhập rồi gõ 6 số, thay cho email + mật khẩu dài. **Chỉ dùng được trên trình duyệt đã nhớ**: sau một lần đăng nhập thật bằng mật khẩu, server đặt cookie httpOnly (token ngẫu nhiên, bảng `pin_devices` chỉ lưu SHA-256). PIN lưu dạng scrypt có salt ở `profiles.pin_hash` (trình duyệt không đọc được). Mỗi lần thử được đếm **trước** khi so (RPC `child_pin_try`), sai 5 lần liên tiếp → khóa 15 phút. Đúng PIN → server tạo phiên đăng nhập cho con bằng token một lần (không rời server). Ghi `audit_log` (`pin.login`, `pin.login_failed`, `child.pin_set`). *Thêm 24/10/2026 (audit):* phụ huynh **đặt lại mật khẩu** hoặc bấm **"Đăng xuất con khỏi mọi máy"** → server mở một phiên tạm cho con (chỉ trong bộ nhớ) rồi đăng xuất **toàn cục** (thu hồi mọi refresh token), ghi mốc `child.sessions_revoked` vào `audit_log`, và đặt `revoked_at` cho mọi dòng `pin_devices`. Access token đã cấp còn hạn tối đa 1 giờ, nhưng `/api/pin/remember` từ chối token có `iat` cũ hơn mốc đó (không "nhớ lại" máy được). Con có thể bấm **"Quên máy này"** trên trang đăng nhập (`/api/pin/forget`: thu hồi theo cookie của chính trình duyệt đó, xóa cookie).
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
| `family_settings` | family_id (pk), break_minutes 10, free_minutes 45, extra_min_minutes 20, skill_min_minutes 20, passes_per_week 1, trust_up_pct 90, trust_up_weeks 3, trust_down_pct 70, homework_lookahead_days 1, photo_retention_days 120, homework_min_upcoming 1 (0002) | **Toàn bộ "luật gia đình"** |
| `app_slots` | family_id, child_id, subject, kind (`internal`/`external`/`placeholder`), label, url, allow_domains text[], active | Slot app môn học; domain của slot tự vào allowlist |
| `task_templates` | family_id, child_id, part (`extra`/`skill`), title, subject, app_slot_id, weekdays smallint[] (1=T2 … 7=CN), min_minutes, deep_link, pillar, sort, active | Bài bổ sung + kỹ năng **theo thứ trong tuần** |
| `homework_items` | family_id, child_id, subject, due_date, note, photo_paths text[], created_by, done_at, archived_at | Bài trên lớp phụ huynh giao. `photo_paths` chứa cả PDF/Word/Excel từ S2c (tên cột giữ nguyên) |
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

**Góc bình yên (0008, S-BY0)** — chi tiết ở `docs/BINH_YEN.md` §2–§3, §11: `profiles.by_pin_*` (trình duyệt không đọc / ghi), `family_settings.by_enabled` (mặc định **false**) + `by_study_minutes`, `by_idle_lock_minutes`, `by_daily_rewards`; `by_sessions` (chỉ máy chủ); `by_signals` (con xem của mình; bố mẹ xem tín hiệu gửi cả hai hoặc gửi mình, chỉ sửa `seen_at`/`seen_by` = mình; không ai thêm / xóa từ trình duyệt). Bản sao lưu bỏ dữ liệu `by_*`.

**Góc bình yên (0009, S-BY1)** — `BINH_YEN.md` §12: `by_checkins` (family_id, child_id, local_date, quad, word_key, intensity 1–5, activity_key, cause_key, understood_at, **client_run_id unique**, created_at). Chỉ mã cố định, không cột chữ tự do. **Không grant, không policy** cho trình duyệt (con / bố mẹ / anon); chỉ `/api/by/checkins` (service_role) khi có lượt ghé Góc bình yên (từ 07/11/2026 không còn PIN riêng). Danh sách từ / hoạt động / trọng số R1 ở `lib/binhYen/catalog.ts` (bảng `by_catalog` để lát sau).

**Góp ý (0010, 07/11/2026)** — `app_feedback` (id, family_id, child_id, kind `like`/`dislike`/`idea`, body 1–500 ký tự, created_at, seen_at). RLS bật. Bố mẹ trong gia đình **select** + **update chỉ cột `seen_at`**; con **select** dòng của mình; **không** grant insert/delete cho trình duyệt (chỉ `POST /api/feedback`). Không riêng tư: con được báo "Bố mẹ sẽ đọc góp ý này."

**Nhân vật của con (0011, R3a, 07/11/2026)** — `profiles.avatar jsonb` (null = "Hình tạm", nhân vật mặc định theo giọng). Chỉ lưu **mã** `{style, hair, eye, skin, outfit, acc, name}` (danh sách trong `lib/avatar.ts`, mã không bao giờ bị xóa) + tên ≤ 24 ký tự; check `jsonb_typeof = object` và ≤ 1 KB. Cả nhà **select** được (cột grant cho `authenticated`); trình duyệt **không** update cột này (revoke) — chỉ `POST /api/profile/avatar`. Không có ảnh nào của con (ảnh Picrew là R3b, bucket riêng).

**Seed (sau khi tạo gia đình):** allowlist mặc định — domain Launcher, `math-app-gules.vercel.app`, `translate.google.com`, `dictionary.cambridge.org`, `tratu.soha.vn`, `accounts.google.com`; 2 profile con; `family_settings` mặc định.

## 5. Máy trạng thái — `lib/dayState.ts`

Hàm thuần, không I/O, test bằng Vitest với `now` truyền vào:

```ts
computeDayState(input: DayInput, now: Date): DayState

type Status =
  | 'LOCK_P1' | 'BREAK' | 'LOCK_P2' | 'FREE_READY'
  | 'FREE' | 'LOCK_END'          // luồng thường (R1 07/11/2026: bỏ BREAK_OFFER, thêm FREE_READY)
  | 'OPEN_SICK' | 'OPEN_TRUST' | 'OPEN_OVERRIDE' | 'LOCK_OVERRIDE'

interface DayState {
  status: Status
  open: boolean                // extension chỉ cần trường này + allowlist
  openUntil: string | null     // ISO, để extension đặt alarm đúng lúc
  part1: { total: number; done: number; items: TaskView[] }
  part2: { total: number; done: number; items: TaskView[] }     // R1: không còn `locked`
  break: { state; canStart: boolean; … }   // canStart: hiện nút Nghỉ, /api/day/break start được phép
  free: { canStart: boolean; … }           // ngày không có việc nào: nút "Bắt đầu giờ tự do"
  passAvailable: boolean
  week: { date: string; result: 'ok' | 'pass' | 'miss' | 'today' | 'sick' }[]   // 7 ngày qua
  trust: { mode: 'lock' | 'trust'; weeksMet: number; weeksNeeded: number }
  serverNow: string
}
```

Thứ tự ưu tiên (đánh giá từ trên xuống, gặp điều kiện đúng thì dừng). **R1 — bố mẹ chốt 07/11/2026** (`docs/MAN_CHINH_MOI.md` §1, ví dụ E1–E24): kỹ năng làm song song với bài tập; giờ tự do khi xong **cả hai** phần; nghỉ 10' khi xong **một** trong hai phần.

| # | Điều kiện | Status | open |
|---|---|---|---|
| 1–2 | Override **mới nhất** của hôm nay còn hiệu lực (chốt 14/10/2026: bản mới nhất thay hẳn bản cũ; hết hạn → về luồng thường): `lock_until` → LOCK_OVERRIDE; `open_until` → OPEN_OVERRIDE | LOCK_OVERRIDE / OPEN_OVERRIDE | ✗ / ✓ đến `until` |
| 3 | `trust_state.mode = trust` | OPEN_TRUST | ✓ (vẫn hiện việc + nhắc) |
| 4 | `day_type = sick` | OPEN_SICK | ✓ cả ngày |
| 5 | `free_started_at` có và `now ≥ free_started_at + free_minutes` | LOCK_END | ✗ |
| 6 | `free_started_at` có (do xong cả hai phần hoặc dùng thẻ) | FREE | ✓ đến hết 45' |
| 7 | `break_started_at` có, chưa `break_ended_at`, và `now < break_started_at + break_minutes` | BREAK | ✓ đến hết nghỉ |
| 8 | Phần 1 chưa xong | LOCK_P1 | ✗ |
| 9 | Phần 1 xong, Phần 2 chưa xong | LOCK_P2 | ✗ |
| 10 | Cả hai phần **không có việc nào**, con chưa bấm "Bắt đầu giờ tự do" (chốt 07/11/2026) | FREE_READY | ✗ |

Quy tắc phụ:
- **Mọi `openUntil` bị cắt ở 00:00** giờ VN của ngày hiện tại (nghỉ, giờ tự do, override).
- **Phần không có việc nào** (vd ngày thi tắt hết mẫu việc, ngày không có kỹ năng) = coi như đã xong (nghỉ được, phần kia xong là xong ngày).
  - *Chốt 14/10 + 07/11/2026:* phần rỗng **chưa ghi** mốc cho đến khi **phần kia có mốc**; lúc đó ghi luôn (kể cả đang bị khóa tay, để "ngày đạt" không bị trễ). Bài / kỹ năng giao trước lúc đó vẫn khóa lại.
  - **Cả hai phần rỗng** → FREE_READY: không tự ghi gì (extension hỏi cả lúc 00:00). Con bấm "Bắt đầu giờ tự do" (`POST /api/day/free`, nút chỉ có ở FREE_READY và chế độ Tin tưởng) thì mới ghi 2 mốc + `free_started_at`. Ngày đó không mời dùng thẻ. Dùng thẻ không bao giờ ghi mốc phần.
- **Hai phần mở song song** (R1): bắt đầu / xong việc của phần nào cũng được, bất kể status. Mỗi lúc vẫn chỉ 1 việc có giờ tối thiểu (chốt 15/10).
- **Nghỉ** (R1): `break.canStart` khi Phần 1 đã xong (Phần 1 rỗng tính là xong, như trước R1) **hoặc** Phần 2 đã xong thật (Phần 2 rỗng một mình không mở nghỉ: ngày không có kỹ năng thì vẫn nghỉ sau bài tập), chưa nghỉ hôm nay (kể cả dòng cũ có `break_skipped = true`), chưa có giờ tự do, `break_minutes > 0`, máy đang khóa giờ học (LOCK_P1 / LOCK_P2 / FREE_READY — không phải khóa tay, Tin tưởng, ngày ốm, bố mẹ mở), và **không** có việc có giờ tối thiểu đang chạy. Trong lúc nghỉ (kể cả khi bố mẹ khóa tay giữa lúc nghỉ), route bắt đầu / xong / nộp ảnh / nhờ bố mẹ xem từ chối ("Đang nghỉ — bấm Học tiếp"). Giờ tự do bắt đầu trong lúc nghỉ (vd bố mẹ xác nhận bài cuối) → FREE ngay, phần nghỉ còn lại bỏ.
- Phút tối thiểu của một việc = `task_templates.min_minutes` nếu có, nếu không lấy `extra_min_minutes` / `skill_min_minutes` trong `family_settings`.
- *Chốt 17/10/2026 (S2c, `computeDayState` diễn giải 17–18):* **mọi** `homework_items` chưa xong, chưa `archived_at` đều trả về, với `group`: `due` (`due_date ≤ localDate + homework_lookahead_days`, bắt buộc từng bài) hoặc `upcoming` (không bắt buộc từng bài). Ngày không có bài `due` nào (kể cả đã xong hôm nay) → Phần 1 thêm `pick.needed = min(homework_min_upcoming, số bài upcoming)` "chỗ", lấp bằng bài upcoming xong hôm nay. `early` = xong vào ngày ≤ `due_date − 2`; `earlyThisWeek` đếm từ thứ Hai — chỉ hiển thị, không đổi trạng thái.
- **Phần 1** = `homework_items` chưa `done_at`, chưa `archived_at`, `due_date ≤ localDate + homework_lookahead_days` + `task_templates` part `extra` có `weekday` hôm nay, không nằm trong `disabled_template_ids`. Slot `placeholder` **vẫn hiện** thành dòng "đang xây" (trả trong `items` với cờ `placeholder: true`) nhưng **không tính** vào total/done.
- **Phần 2** = `task_templates` part `skill` của thứ hôm nay. Mở từ đầu ngày (R1).
- Phần 1 xong lần đầu → ghi `part1_done_at`; Phần 2 xong lần đầu → ghi `part2_done_at` (thứ tự nào cũng được). Phụ huynh giao thêm bài / bật thêm kỹ năng **sau** mốc của phần đó → hiện trong danh sách nhưng **không khóa lại** ngày đó.
- Có **cả hai** mốc → `free_started_at = now`. Các mốc của một lần đọc ghi trong **một** câu lệnh; nếu đã có lần đọc khác ghi trước thì ghi từng cột, phần trước, giờ tự do sau (không bao giờ có `free_started_at` mà thiếu mốc phần). *Chốt 14/10/2026:* nếu lúc đó đang có override **khóa**, `free_started_at` được hoãn đến lần đọc đầu tiên sau khi hết khóa.
- Thẻ miễn: còn thẻ khi số `pass_used_at` trong tuần (T2–CN) < `passes_per_week` **và hôm nay chưa có `free_started_at`** (không cho dùng thẻ để có giờ tự do lần 2). Dùng → `pass_used_at = now`, `free_started_at = now`.
- "Ngày đạt" (cho thống kê tuần và chế độ Tin tưởng): có **cả** `part1_done_at` **và** `part2_done_at` trước `bedtime` (R1; mọi dòng đã ghi từ lần chạy đầu (PR #4) đều có `part1_done_at` khi có `part2_done_at`, nên các tuần cũ không đổi kết quả), **hoặc** dùng thẻ, **hoặc** `day_type ∈ {sick, holiday}`. Ngày thi (`exam`) **không** tự tính đạt. Tính lười khi đọc, không cần cron.
- *(S3d, 01/11/2026)* **Ngày đặc biệt** do phụ huynh đặt (`POST /api/admin/special-days`, phiên của phụ huynh, ghi `audit_log` `day_type.set`): cho **hôm nay hoặc tối đa 60 ngày tới** (giờ server), **không sửa ngày đã qua**. `exam` / `holiday` tắt được **mẫu việc** (bài bổ sung / kỹ năng) **có lịch vào thứ của ngày đó**; bài trên lớp không tắt ở đây (dời hạn ở Giao bài). `normal` / `sick` xóa danh sách tắt. Về "Ngày thường" = ghi `day_type = normal`, không xóa dòng. Hiệu lực vẫn do `computeDayState` (không đổi).
- Tiến độ Tin tưởng: đếm số tuần **liên tiếp gần nhất** có tỷ lệ ngày đạt ≥ `trust_up_pct`. Đủ `trust_up_weeks` → hiện gợi ý cho phụ huynh xác nhận. **Không tự chuyển chế độ.** Đang Tin tưởng mà 1 tuần < `trust_down_pct` → gợi ý quay lại Khóa.
  - *(S3d, 04/11/2026)* Gợi ý hiện thành thẻ trên thẻ của con ở **Hôm nay** của bố mẹ, nút "Chuyển sang Tin tưởng" / "Quay lại chế độ Khóa" và **"Để sau"**. Bố mẹ còn chuyển tay bất kỳ lúc nào ở **Thêm › Các con** (có bước xác nhận). Ghi bằng phiên bố mẹ (`trust_state`, RLS `parent_all`; `since = now`, `updated_by`), log `trust.set {child_id, mode, previous, via}`. "Để sau" chỉ ghi log `trust.dismissed {child_id, suggestion, week}`. *Đề xuất, chờ bố mẹ chốt:* đã chuyển (bất kỳ chiều) hoặc "Để sau" trong tuần (T2–CN) → **ẩn gợi ý đến thứ Hai tuần sau** (`lib/admin/trust.ts`, đọc lại từ `audit_log`, không thêm bảng). `computeDayState` không đổi.

**Bắt buộc có test** cho từng dòng của bảng ưu tiên + mốc biên (đúng giây hết 10', hết 45', qua 00:00, tuần mới).

## 6. API (Next.js route handlers)

Mọi route trả `serverNow`. Launcher gọi lại `GET /api/today` **mỗi 30 giây khi tab đang hiện** và mỗi khi tab được focus (đáp ứng tiêu chí "≤ 1 phút"). Route của con xác thực bằng phiên Supabase của con; route extension bằng `Bearer <device token>`.

| Route | Ai gọi | Việc làm |
|---|---|---|
| `GET /api/today` | con | Trả `DayState` + danh sách việc |
| `POST /api/tasks/start` | con | Tạo `task_run` (R1: cả hai phần mở; chặn khi **đang nghỉ**; chặn nếu đã có run mở cho việc đó; 1 việc có giờ tối thiểu một lúc) |
| `POST /api/tasks/finish` | con | Kiểm `now − started_at ≥ min_minutes` (template) → nếu thiếu trả **409**. Homework: cần ≥ 1 `proof_path` → set `homework_items.done_at`. Cập nhật mốc phần. Chặn khi **đang nghỉ** (R1) |
| `POST /api/tasks/proof` | con | Ghi đường dẫn ảnh đã tải lên Storage vào `task_run`. Chặn khi **đang nghỉ** (R1; cả "Nhờ bố mẹ xem" `confirm-request`) |
| `POST /api/day/break` | con | `start` (khi `break.canStart`, R1); `end` (chỉ ở BREAK — nút "Học tiếp", ghi `break_ended_at`). `skip` bỏ ở R1 (trả 400) |
| `POST /api/day/free` | con | Ngày không có việc nào (FREE_READY): ghi `part1_done_at` + `part2_done_at` + `free_started_at` trong 1 câu lệnh (R1, chốt 07/11/2026) |
| `GET /api/week/days` | con | R2 "Tuần của con": 7 ngày T2–CN, mỗi ngày Cảm xúc (lượt ghé Góc bình yên **cuối cùng** của ngày: vùng + từ, chỉ khi Góc bình yên bật), Học tập / Kỹ năng (mốc phần), Vui chơi (`free_started_at`). **Chỉ phiên của con** (bố mẹ 403): cảm xúc không bao giờ nằm trong `DayState` / `todayView` / tổng kết tuần mà trang bố mẹ dùng lại (chốt 07/11/2026) |
| `POST /api/day/pass` | con | Dùng thẻ miễn nếu còn; trả 409 nếu hôm nay đã có `free_started_at`, hoặc ngày không có việc nào (đã có nút "Bắt đầu giờ tự do", R1) |
| `POST /api/unlock-requests` | con (hoặc trang khóa) | Tạo yêu cầu (bỏ qua nếu cùng domain đang `pending`) → gửi push cho phụ huynh |
| `GET /api/unlock-requests/:id` | trang khóa | Trạng thái yêu cầu (hiện "đã duyệt" / "bị từ chối" / "bố mẹ chưa trả lời" sau 10 phút) |
| `POST /api/unlock-requests/:id/decide` | phụ huynh | Duyệt / từ chối → tạo allowlist có hạn |
| `POST /api/parent-pin/override` | máy con + PIN phụ huynh | `open_until` / `lock_until` / **cộng N phút** = tạo `open_until` mới tính từ `max(openUntil hiện tại, now)` (cắt ở 00:00) |
| `POST /api/parent-pin/verify` | máy con + PIN phụ huynh | Mở nhanh cài đặt nhẹ trên máy con (vd ghép extension) |
| `GET/POST /api/admin/*` | phụ huynh | Tài khoản con, cài đặt, allowlist, mẫu việc, slot, ngày đặc biệt, chế độ Tin tưởng, verdict |
| `POST /api/admin/trust` | phụ huynh | *(S3d)* `{childId, mode: lock\|trust, via}` → upsert `trust_state` + log `trust.set`; `{childId, later: lock\|trust}` → chỉ log `trust.dismissed` (ẩn gợi ý tuần này). Con: 403 |
| `GET /parent/log` (trang) | phụ huynh | *(S3d)* **Nhật ký**: `audit_log` của gia đình (RLS `parent_select`), mới nhất trước, 50 dòng/lần (`?so=`, tối đa 1000), lọc `?con=` (`actor_id` hoặc `payload->>child_id`) và `?nhom=`; mỗi dòng là 1 câu tiếng Việt từ `lib/admin/auditText.ts` (render ở server, **không gửi payload thô** xuống trình duyệt; hành động lạ → câu trung tính) |
| `POST /api/admin/special-days` | phụ huynh | *(S3d)* `{childId, date, dayType, disabledTemplateIds}` → upsert `day_sessions.day_type` + `disabled_template_ids` (hôm nay … +60 ngày) |
| `POST /api/push/subscribe` | mọi profile | Lưu subscription |
| `POST /api/ext/pair` | máy con + PIN phụ huynh | Tạo token thiết bị (trả 1 lần, lưu hash) |
| `GET /api/ext/state` | extension | `{open, openUntil, allow: string[], blockAlways: string[], launcherUrl, pollSeconds, serverNow}`; cập nhật `last_seen_at` |
| `GET /api/cron/evening` | **Vercel Cron** (`vercel.json`, `0 14 * * *` = chạy 1 lần trong khung **21:00–21:59 VN**, gói Hobby; tự gửi `Authorization: Bearer CRON_SECRET`) | Push nhắc phụ huynh "xem gộp buổi tối" khi còn việc chờ. *(07/11/2026)* Ngoài **20:00–23:00 VN** trả `{skipped:"outside_window"}`, không gửi gì (dù ai gọi). GitHub `evening-reminder.yml` chỉ còn chạy tay |
| `GET /api/cron/cleanup` | GitHub Actions hằng tuần (`Authorization: Bearer CRON_SECRET`) | *(S3e)* Xóa **tệp** quá `photo_retention_days`; `?dryRun=1` chỉ đếm; ≤ 500 tệp/lần; log chỉ số đếm |
| `GET /api/admin/photo-cleanup` | phụ huynh | *(S3e)* "Xem trước sẽ xóa gì" — đếm (không xóa) cho gia đình mình, bằng phiên phụ huynh (RLS) |
| `POST /api/by/open` · `GET /api/by/state` · `POST /api/by/ping` | con | *(S-BY0; đổi 07/11/2026: **không PIN riêng, không tự khóa**)* `open` = con mở Góc bình yên: lượt ghé đang có trên trình duyệt này thì đi tiếp, không thì tạo lượt mới (`by_sessions` + cookie httpOnly, Secure, SameSite=Strict: `sl_by_page` path `/binh-yen`, `sl_by_api` path `/api/by`). `state` chỉ **xem**; `ping` = màn hình còn mở (mỗi 60 giây khi đang hiện) → `last_seen_at = now`. Rời quá 5 phút (giờ máy chủ) → lần mở sau là lượt mới (không khóa, không hỏi gì). Không `audit_log` |
| `POST /api/by/pin/set` · `POST /api/by/pin/verify` | — | *(Bỏ 07/11/2026)* Trả **410**: Góc bình yên không còn PIN riêng. Cột `profiles.by_pin_*`, hàm `by_pin_try`, `family_settings.by_idle_lock_minutes` **để nguyên, không dùng** (chỉ xóa khi phụ huynh đồng ý) |
| `GET/POST /api/by/signal` | con (phiên thường, **không** cần lượt ghé Góc bình yên) | *(S-BY0)* "Con muốn nói chuyện": `{kind: "want_talk", to: parentId \| null}` → `by_signal_create` (1 lần / 2' / con) → push chung chung `wantTalkMessage`. Chỉ nhận khi có điện thoại bố mẹ bật thông báo (không thì 409, nút ẩn). GET = có gửi được không + trạng thái lần gửi gần nhất |
| `GET /api/cron/by-escalate` | chạy tay (`by-escalate.yml`, **bỏ lịch 5' từ 07/11/2026**) | *(S-BY0)* Tín hiệu `needs_care` (S-BY2) chưa ai "Đã thấy" sau 10' → nhắc lại **1 lần** (`escalated_at` đặt trong cùng câu UPDATE). `want_talk` **không** nhắc lại (05/11/2026). Chạy sau mỗi `/api/today`, `/api/by/*` của con (`after()`) |
| `POST /api/admin/talk/:id/seen` · `GET /api/admin/talk/count` | phụ huynh | *(S-BY0)* "Đã thấy" bằng phiên của phụ huynh (RLS: chỉ `seen_at`, `seen_by` = mình) · số tín hiệu chưa xem (dải đỏ trên mọi trang) |
| `GET/POST /api/by/checkins` · `POST /api/by/checkins/delete` | con, **cần lượt ghé Góc bình yên** (`/api/by/open`) | *(S-BY1)* GET = 7 lượt gần nhất của chính con. POST `{clientRunId, quad, word, intensity, activity}` (activity null = "Vậy là đủ") → kiểm theo danh sách **trước** khi ghi; cùng `clientRunId` chỉ 1 dòng. Delete `{id}` hoặc `{all: true}` → xóa hẳn, chỉ của con. Không `audit_log`. **R5:** mọi route `/api/by/*` + trang tính giới hạn giờ học (`computeDayState`, giờ máy chủ): quá `by_study_minutes` kể từ lúc bắt đầu lượt ghé → lượt kết thúc, trả 409 `capped` |
| `POST /api/feedback` | con | *(07/11/2026)* **Góp ý** cho app `{kind: like\|dislike\|idea, body ≤ 500}` (zod, trim) → `app_feedback` (service_role; gia đình + con lấy từ phiên). ≤ **10 / con / ngày** (đếm ở máy chủ, ngày VN) → 429. Không push, không `audit_log` |
| `POST /api/profile/avatar` | con | *(R3a, 07/11/2026)* Lưu nhân vật `{avatar: {...}}` hoặc về hình tạm `{avatar: null}`. Máy chủ chỉ nhận mã có trong danh sách, không nhận khóa lạ, tên ≤ 24 ký tự (bỏ ký tự điều khiển) → 400. Ghi bằng service_role **chỉ dòng của con trong phiên** (`.eq(id).eq(role, child)`); bố mẹ 403, chưa đăng nhập 401 |
| `POST /api/admin/feedback/:id/seen` | phụ huynh | *(07/11/2026)* "Đã đọc" bằng phiên của bố mẹ (RLS: gia đình mình, chỉ cột `seen_at`) |

## 7. Extension (thư mục `extension/`)

**Manifest V3**, một bản cho cả Chrome và Edge.

| Phần | Thiết kế |
|---|---|
| Quyền | `declarativeNetRequest` *(24/10/2026, 0.3.2: trước là `declarativeNetRequestWithHostAccess`; luật chặn vẫn chạy khi bị tắt quyền trang)*, `storage`, `alarms`, `tabs`; `host_permissions: ["<all_urls>"]`; `externally_connectable.matches` = domain Launcher |
| Trang chủ | Chính sách trang chủ của Chrome **không áp dụng** trên Windows không join domain → extension tự lo: *(S4b)* tab mới (`chrome://newtab`, `edge://newtab`) được chuyển sang `/today` qua `tabs.onCreated/onUpdated` (không dùng `chrome_url_overrides`: trình duyệt hiện nút hoàn tác 1 chạm); `chrome.runtime.onStartup` mở 1 tab Launcher |
| Khung bị chặn | *(24/10/2026, extension 0.3.1, quyền `webRequest`)* Khi đang khóa, một khung (sub_frame) bị chặn **bên trong trang học được phép** và **cùng site** với trang (vd `x.google.com` trong `meet.google.com`) → extension gửi `POST /api/ext/frame-block {page, frame}` (token thiết bị). Server kiểm lại (cùng site, trang đúng là được phép, khung chưa được phép), bỏ qua nếu đã có yêu cầu đang chờ hoặc bố mẹ trả lời trong 7 ngày, tối đa 20/ngày/con → tạo `unlock_requests` với lý do "Tự phát hiện: …" → bố mẹ trả lời ở tab Con nhờ như Xin mở trang. Không đổi luật chặn: chỉ báo |
| Mất quyền trang | *(24/10/2026 audit, 0.3.2)* Ai đó chọn "Quyền truy cập trang web: Khi nhấp / Trên trang cụ thể" → extension mất quyền chuyển hướng. Extension kiểm `chrome.permissions.contains(<all_urls>)` mỗi lần áp luật và ngay khi quyền đổi (`permissions.onRemoved/onAdded`); thiếu quyền → **khóa** (giữ allowlist cuối), luật bắt-tất-cả đổi từ chuyển hướng sang **chặn** (trang lỗi của Chrome), popup hướng dẫn bật lại "Trên tất cả các trang web". Chính sách trình duyệt (SETUP B) nên khóa luôn cài đặt này |
| File trên máy | *(24/10/2026)* `family_settings.allow_local_files` (mặc định tắt) → `allowLocalFiles` trong `/api/ext/state`. Bật thì tab `file:` có đường dẫn kết thúc `.html` / `.htm` / `.pdf` không bị đưa về trang chặn (DNR không thấy `file:`, chỉ tab sweep / tab listener quyết định). Server cũ không gửi trường này → coi là tắt (fail-closed) |
| Ghép đôi | *(Đổi 17/10/2026, S4b — phụ huynh chọn mã 6 số vì PIN làm sau)*: bố mẹ bấm **Tạo mã ghép máy** (trang `/parent/devices`, mã 6 số, 10 phút, 1 lần, 5 lần thử, chỉ lưu hash, gắn với 1 con) → trên laptop con (đăng nhập tài khoản con) trang `/ghep-may` gọi `POST /api/ext/pair {code}` → nhận token → `window.postMessage` → **content script** của extension (chỉ chạy trên đúng domain Launcher, cố định lúc build) chuyển cho background. Địa chỉ máy chủ của extension **cố định lúc build** (`NEXT_PUBLIC_APP_URL`), không bao giờ lấy từ trang web → không cần `externally_connectable` hay ID extension |
| Đồng bộ | `chrome.alarms` mỗi **30 giây** (`pollSeconds` từ server, kẹp 30–60) + lúc khởi động + một alarm đặt đúng `openUntil`. Lưu trạng thái + allowlist vào `chrome.storage.local`. `GET /api/ext/state` dùng cùng `readToday` (ghi mốc lười như Launcher) và allowlist = `allowlist_entries` (cả nhà + của con, chưa hết hạn) + host của app môn học đang bật + deep link việc hôm nay |
| Luật chặn (dynamic rules) | Khi khóa: (1) **block-all** `main_frame` → redirect sang `https://<launcher>/blocked?u=<url gốc>` (ưu tiên 1, `regexSubstitution`; URL gốc **không được mã hóa** → trang `/blocked` đọc nguyên phần sau `u=` kể cả `&`, `#`); (2) **allow** `requestDomains` = allowlist (ưu tiên 2); (3) **block** `translate.goog` (ưu tiên 3, thắng allow). Khi mở: gỡ hết luật |
| Quét tab | Khi chuyển mở → khóa: `chrome.tabs.query({})`, tab http(s) nào ngoài allowlist thì `chrome.tabs.update` sang trang khóa |
| Fail-closed | *(S4b)* Mỗi lần hỏi tối đa **10 giây** (quá = thất bại); **401** (máy bị gỡ) → khóa ngay; cài luật lỗi → chỉ mở Launcher; khi đang mở, mỗi lần chuyển trang cũng hỏi lại (≥ 30 giây/lần, phòng đồng hồ máy bị chỉnh lùi làm dừng hẹn giờ). **Đếm số lần hỏi thất bại liên tiếp** (không dùng đồng hồ máy): ≥ 2 lần → áp **khóa** với allowlist đã lưu. `openUntil` cũ chỉ được tin khi lần hỏi gần nhất thành công. Chưa từng đồng bộ → chỉ cho domain Launcher |
| Phát hiện bị tắt | Trang Thiết bị hiện "Lần cuối hỏi máy chủ" (> 10 phút = đỏ). **Không** báo đẩy chỉ vì laptop im lặng (tắt máy là bình thường). *(S6, 01/11/2026, extension 0.3.3)* Hai tín hiệu báo bố mẹ (push + dòng đỏ trên Thiết bị), lưu ở `audit_log` (không thêm bảng/cột): **(1) bị gỡ** — sau khi ghép, extension đặt `chrome.runtime.setUninstallURL(<launcher>/api/ext/uninstalled?k=<SHA-256 của token>)` (= `token_hash`, không bao giờ là token; chưa ghép = ""); gỡ extension → trình duyệt mở địa chỉ này → server ghi `ext.uninstalled {device_id}` + push "Extension trên laptop của X vừa bị gỡ", tối đa 1 lần/máy/giờ, máy bố mẹ đã "Gỡ" thì chỉ ghi; luôn chuyển sang trang trung tính `/da-go-extension` (không lộ máy có tồn tại hay không); không thu hồi máy. **(2) mở Launcher không có extension** — `/today` trên Chrome/Edge/Chromium **máy tính** (`lib/ext/browser.ts`; iPhone/iPad/Android/Firefox không bao giờ) ping content script 6 giây không ai trả lời → `POST /api/ext/missing` (chỉ tài khoản con; server kiểm lại User-Agent; bỏ qua nếu con chưa có laptop nào đã ghép) → `ext.missing {browser}` + push, tối đa 1 lần/con/ngày; con thấy dòng "bố mẹ đã được báo". Giới hạn: extension bị **tắt** mà con không mở Launcher thì không có tín hiệu (chỉ thấy "Lần cuối hỏi máy chủ") |
| Phát hành | Đóng gói đăng **unlisted** lên Chrome Web Store + Edge Add-ons (bắt buộc để cài kiểu ép buộc trên Windows không join domain — xem `docs/SETUP.md`) |
| Popup | Tối giản: trạng thái hiện tại + nút "Mở Launcher" |

## 8. Thông báo đẩy (Web Push)

- Khóa VAPID trong env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- `public/sw.js`: nhận `push` (`{title, body, url, tag}`) → hiện thông báo; `notificationclick` → mở `url` trong app (`/parent/requests`, `/parent/review`).
- *(S5, chốt 01/11/2026)* Gửi khi: con **Xin mở trang** (chỉ lần đầu cho mỗi trang), con **Nhờ bố mẹ xem** (chỉ lần đầu cho mỗi lượt), **buổi tối** nếu còn bài chưa xem / việc con đang nhờ (`/api/cron/evening`). *(07/11/2026)* Gọi bởi **Vercel Cron** (`vercel.json`): tới trong khung **21:00–21:59** (gói Hobby chỉ hẹn được theo giờ, chạy lúc nào trong giờ đó) — thay GitHub vì lịch GitHub chạy trễ ~6 giờ (03:34–04:13). Route không gửi gì ngoài 20:00–23:00 VN. **Không** push khi con gửi Góp ý. **Không** gửi cho "Tự phát hiện" khung bị chặn (chỉ số đỏ). Không có giờ yên lặng. *(S6)* Thêm: extension **bị gỡ** (≤ 1 lần/máy/giờ) và con **mở Launcher không có extension** trên máy tính (≤ 1 lần/con/ngày) — xem §7.
- Gửi bằng `lib/push/send.ts` (`web-push`, service_role, không bao giờ làm hỏng thao tác của con; endpoint hết hạn 404/410 thì xóa). Nội dung push **không chứa chữ con viết**. Bố mẹ bật/tắt/gửi thử ở **Thêm › Thông báo**; khóa VAPID + `CRON_SECRET` tạo ngay trong trình duyệt phụ huynh (SETUP A10).
- iOS: chỉ hoạt động khi PWA đã **Add to Home Screen**, và phải xin quyền từ một thao tác bấm của người dùng. Thông báo iOS không có nút hành động, nên "1 chạm" = chạm thông báo → trang có 4 nút duyệt. **Cần thử trên iPhone thật ở S5.**
- Dự phòng nếu push iOS không ổn: trang phụ huynh tự làm mới mỗi 30 giây khi đang mở + huy hiệu số yêu cầu chờ.

## 9. Ảnh & Storage

| Bucket | Ai ghi | Ai đọc | Đường dẫn |
|---|---|---|---|
| `homework` (private) | phụ huynh | phụ huynh, con của bài đó | `{family_id}/{child_id}/{due_date}/{uuid}.{jpg,png,webp,pdf,doc,docx,xls,xlsx}` (S2c: ≤ 5 MB/tệp, ≤ 6 tệp/bài; sau khi sửa hạn, tệp cũ vẫn ở thư mục ngày cũ) |
| `proofs` (private) | con (thư mục của mình) | phụ huynh, chính con | `{family_id}/{child_id}/{local_date}/{uuid}.jpg` |

- Nén ở client trước khi tải: cạnh dài ≤ 1600px, JPEG chất lượng 0.8 (~200–400 KB/ảnh).
- Hiển thị bằng signed URL có hạn. *(S2c)* Tệp bài tập mở qua `GET /api/files/homework?path=…` (cùng domain với app, tải bằng phiên của người xem nên RLS kiểm tra) — máy đang khóa không cần mở domain Supabase.
- *(S3e)* **Tự xóa tệp quá hạn** (`lib/cleanup/`, job hằng tuần thứ Hai 04:17 VN): tệp có ngày (VN) **trước** `hôm nay − photo_retention_days` (đúng N ngày = giữ; sàn an toàn 7 ngày). `proofs`: mọi ảnh trong thư mục ngày cũ mà **chính tệp** cũng cũ (`created_at` trước mốc; tệp không bao giờ bị ghi đè). `homework`: chỉ tệp của bài **đã gỡ hoặc đã xong** quá N ngày, tạo + hạn nộp cũng quá N ngày, và không còn nằm trong bài nào khác; bài đang làm không bao giờ bị đụng. **Chỉ xóa tệp, không xóa/sửa dòng nào**: `proof_paths`/`photo_paths` giữ nguyên để số đếm (vd "Chờ xem", số ảnh) không đổi; "Ngày của con" hiện "Ảnh đã xóa sau N ngày" thay ảnh vỡ. Ghi `audit_log` `photos.cleanup` (chỉ số đếm).
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
| **S3** | *(Chia nhỏ 15/10/2026: S3a xem gộp · S3b PIN phụ huynh 6 số · S3c override từ máy con + iPhone · S3d ngày đặc biệt, Tin tưởng, allowlist, nhật ký · S3e xóa ảnh quá hạn. Màn chọn hồ sơ + PIN con: sau v1.)* Phụ huynh: xem gộp + Đạt/Chưa đạt, ngày đặc biệt, override bằng PIN trên máy con, gợi ý & xác nhận chế độ Tin tưởng, audit log, **job xóa ảnh quá hạn** (`/api/cron/cleanup`) | "Xem gộp", "Override & cấu hình" | M1 |
| **S4** | Extension: ghép đôi, `/api/ext/state`, luật chặn, quét tab, fail-closed, trang `/blocked`, **tab mới / khởi động → Launcher** | "Khóa web" | M2 |
| **S5** | Xin mở trang + Web Push (thử trên iPhone thật) + **nhắc xem gộp buổi tối** (`/api/cron/evening`) | "Xin mở trang" | M2 |
| **S6** | Cảnh báo extension mất kết nối *(01/11/2026: báo khi bị gỡ / mở Launcher không có extension — §7 "Phát hiện bị tắt")*; đóng gói đăng store (unlisted) | — | M2 |

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
