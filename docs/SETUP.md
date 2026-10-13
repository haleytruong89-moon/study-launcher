# Study Launcher — Hướng dẫn chuẩn bị (cho phụ huynh)

Cập nhật: 13/10/2026. Làm theo thứ tự A → D. Phần B làm được ngay, **không cần code**, và nên làm sớm nhất vì nó kiểm tra giả định rủi ro nhất của dự án.

---

## A. Tạo hạ tầng (~30 phút)

Dùng lại các tài khoản GitHub / Supabase / Vercel đang dùng cho App Toán.

| # | Việc | Ghi chú |
|---|---|---|
| A1 | **GitHub**: tạo repo **private** tên `study-launcher`, để trống (không tick README) | Cùng tài khoản với repo `Math-app` |
| A2 | **Supabase**: tạo **project mới** tên `study-launcher`, region Southeast Asia (Singapore). Lưu mật khẩu DB vào nơi an toàn | **Không** dùng chung project của App Toán. Gói free thường cho 2 project đang chạy — App Toán dùng 1, còn 1 (kiểm tra lại trên trang Supabase) |
| A3 | Ghi lại 3 giá trị trong phần cài đặt API của project mới: Project URL, `anon` key, `service_role` key | `service_role` là khóa quản trị — **chỉ** dán vào Vercel, không gửi qua chat |
| A4 | **Vercel**: Import repo `study-launcher` → thêm biến môi trường theo `.env.example` (5 biến bắt buộc cho S0: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `FIRST_PARENT_EMAIL` = email tài khoản phụ huynh ở A8) | Làm sau khi PR S0 mở. `NEXT_PUBLIC_APP_URL` = địa chỉ Vercel của project (vd `https://study-launcher.vercel.app`) |
| A5 | Báo Claude: "repo đã tạo" | Claude đẩy 4 file tài liệu lên repo giúp |
| A6 | **Supabase ↔ GitHub**: Project Settings → Integrations → GitHub → chọn repo `haleytruong89-moon/study-launcher`, Working directory `.`, Production branch `main`, **Deploy to production = Bật**. Automatic branching để nguyên (gói Free không có; bật khi nâng Pro sẽ tính tiền theo giờ) | Từ lúc này, SQL trong `supabase/migrations/` **tự chạy khi bạn merge PR vào `main`**. **Không sửa tay trong SQL Editor** (sẽ lệch với repo). Mỗi PR sẽ nói rõ có đụng database hay không |
| A7 | **Supabase → Authentication → Sign In / Providers**: tắt "Allow new users to sign up" (chỉ tài khoản bạn tạo mới đăng nhập được) | Làm **trước khi mở link Vercel lần đầu** (không chờ đến khi cho con dùng) |
| A8 | **Supabase → Authentication → Users → Add user**: tạo tài khoản **phụ huynh** (email thật + mật khẩu mạnh, tick "Auto Confirm User") | Sau khi S0 chạy, đăng nhập bằng tài khoản này ở trang `/login`, màn "Thiết lập lần đầu" sẽ hiện ra |
| A9 | **GitHub → repo → Settings → Secrets and variables → Actions**, thêm 5 secret: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (giữ project không bị ngủ, chạy hằng ngày); `SUPABASE_DB_URL` (lấy ở nút **Connect** của Supabase, chọn **Session pooler**, thay `[YOUR-PASSWORD]` bằng mật khẩu DB); `BACKUP_PASSPHRASE` (một cụm mật khẩu dài bạn tự đặt, ≥ 20 ký tự) | Hai secret sau dùng cho **sao lưu hằng tuần, được mã hóa** (quyết định 13/10). **Lưu `BACKUP_PASSPHRASE` vào quản lý mật khẩu của bạn: mất nó thì bản sao lưu vô dụng**. `SUPABASE_DB_URL` chứa mật khẩu DB: chỉ dán vào GitHub Secrets, không gửi qua chat. Thiếu 1 trong 2 secret thì sao lưu tự bỏ qua (không bao giờ đẩy file chưa mã hóa). Bản sao lưu gồm dữ liệu bảng + tài khoản đăng nhập, **không** gồm ảnh |

---

## A+. Kiểm tra nhanh sau khi cấu hình (1 link)

Mở `https://<link-vercel-của-bạn>/api/health/ready`. Kết quả `"ok": true` nghĩa là: biến môi trường đủ, nối được database, đủ 15 bảng + 2 kho ảnh, đã tắt đăng ký tự do. Mục nào `false` kèm gợi ý (tiếng Việt) cần làm gì. Dòng `family_created` chỉ là cảnh báo cho tới khi bạn làm "Thiết lập lần đầu". Bạn có thể gửi link này cho Claude để Claude đọc giúp.

---

## B. Thử chính sách khóa extension trên Windows (~45 phút, không cần code) ⚠️ làm sớm

**Mục đích:** xác nhận laptop của con **ép cài được một extension mà con không gỡ/tắt được**, và chặn được tab ẩn danh. Nếu không làm được, cả cơ chế khóa phải thiết kế lại — nên kiểm tra trước khi đầu tư code.

Cách thử: dùng **một extension có sẵn trên Chrome Web Store** (bất kỳ extension vô hại nào) thay cho extension của mình.

**B1. Chuẩn bị**
- Trên laptop của con, kiểm tra phiên bản Windows: Settings → System → About → mục *Edition* (Home hay Pro). Ghi lại.
- Lấy ID của một extension trên Chrome Web Store: mở trang extension, ID là chuỗi 32 ký tự ở cuối đường link. Ví dụ "Google Docs Offline": `ghbmnnjooekpmoecnnnilnnbdlolhkhi`.

**B2. Đặt chính sách** — mở **Command Prompt (Run as administrator)**, chạy từng dòng:

```bat
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "ghbmnnjooekpmoecnnnilnnbdlolhkhi;https://clients2.google.com/service/update2/crx" /f
reg add "HKLM\SOFTWARE\Policies\Google\Chrome" /v IncognitoModeAvailability /t REG_DWORD /d 1 /f
reg add "HKLM\SOFTWARE\Policies\Google\Chrome" /v BrowserGuestModeEnabled /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Google\Chrome" /v BrowserAddPersonEnabled /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Google\Chrome" /v DeveloperToolsAvailability /t REG_DWORD /d 2 /f
```

(Dòng cuối khóa DevTools trên máy này — để con không tắt luật chặn bằng DevTools.)

**B3. Kiểm tra** — đóng hẳn Chrome rồi mở lại:

| Kiểm tra | Kết quả mong đợi | Đạt? |
|---|---|---|
| Vào `chrome://policy` | Thấy các chính sách trên, trạng thái OK | |
| Vào `chrome://extensions` | Extension tự có mặt, ghi "được quản trị viên cài đặt", **không có nút Gỡ / không tắt được** | |
| Bấm Ctrl+Shift+N | **Không** mở được cửa sổ ẩn danh | |
| Bấm F12 | **Không** mở được DevTools | |
| Đăng nhập tài khoản Windows **của con** (loại Standard, không phải Administrator) và thử lại 3 dòng trên | Kết quả giống hệt | |
| Trong tài khoản của con, thử mở Registry Editor sửa khóa trên | Bị yêu cầu mật khẩu quản trị | |

**B4. Gỡ sau khi thử** (nếu muốn trả máy về như cũ):

```bat
reg delete "HKLM\SOFTWARE\Policies\Google\Chrome" /f
```

**B5. Báo lại cho Claude:** phiên bản Windows + bảng B3 (Đạt / Không đạt từng dòng). Nếu tài khoản của con hiện là Administrator, cần tạo tài khoản Standard cho con — làm ở bước cấu hình chính thức (M3), Claude sẽ hướng dẫn.

> Lưu ý: các khóa registry trên lấy theo tài liệu chính sách Chrome hiện hành mà Claude biết; mục đích của bài thử chính là xác nhận chúng chạy đúng trên máy thật. Edge có bộ khóa tương tự (`HKLM\SOFTWARE\Policies\Microsoft\Edge\...`) nhưng một số tên khác — vd ẩn danh của Edge là `InPrivateModeAvailability` — sẽ cấu hình ở M3. Không cần thử chính sách "trang chủ": trên máy không join domain Chrome bỏ qua nó; extension của mình sẽ tự mở Launcher ở tab mới.

---

## C. Tài khoản phát hành extension (làm sớm vì có thể phải chờ duyệt)

| # | Việc | Chi phí |
|---|---|---|
| C1 | Đăng ký tài khoản nhà phát triển **Chrome Web Store** | Phí 1 lần ~5 USD |
| C2 | Đăng ký **Microsoft Partner Center** (Edge Add-ons) | Miễn phí |

Extension sẽ đăng ở chế độ **unlisted** (không ai tìm thấy, chỉ cài qua chính sách). Lần duyệt đầu có thể mất vài ngày.

---

## D. Bắt đầu với Claude Code

1. Sau A5, mở Claude Code, gắn repo `study-launcher`.
2. Prompt kiểm tra đầu tiên:
   > Đọc CLAUDE.md và các file trong docs/. Tóm tắt bằng tiếng Việt: project này build gì, tech stack, 5 quyết định quan trọng nhất, và lát S0 gồm những gì.
3. Nếu tóm tắt đúng → prompt tiếp:
   > Làm lát S0 theo docs/DESIGN.md §13. Tạo nhánh và PR, không merge. Cập nhật docs/PROGRESS.md.
4. Thử link preview của PR theo hướng dẫn trong mô tả PR → merge. Nếu PR có SQL, SQL tự chạy lên Supabase thật ngay khi merge (đã nối ở A6), nên đọc kỹ phần "Có đụng database không" trong mô tả PR trước khi bấm.

### Nhịp làm việc đề xuất

App Toán đang cần ~30 phút mỗi sáng. Để không vượt 1–2 giờ/ngày:
- Launcher chạy **2–3 lát/tuần** xen kẽ với App Toán, hoặc
- Bắt đầu Launcher sau khi App Toán xong S3 và vào pilot.

Mỗi lát Launcher cần phụ huynh ~20–30 phút: đọc PR, thử preview, merge (SQL tự chạy lúc merge).

---

## E. Khôi phục từ bản sao lưu (khi cần)

Bản sao lưu nằm ở GitHub → tab **Actions** → workflow *Weekly database backup* → lần chạy gần nhất → mục **Artifacts** → `db-backup-encrypted` (giữ 30 ngày). Ảnh trong kho ảnh **không** có trong bản này.

> Đã diễn tập trên Postgres tạm trong máy; **chưa thử trên Supabase thật**. Đầu pilot, nhờ Claude làm một buổi diễn tập khôi phục trên một project Supabase thử trước khi cần dùng thật.

Cách khôi phục (Claude làm giúp, cần máy có `psql` + `pg_restore` bản 17):

1. Tạo project Supabase mới (hoặc dùng project hiện tại nếu chỉ hỏng dữ liệu), để migration chạy cho đủ bảng (merge `main` là tự chạy).
2. Giải mã: `gpg --decrypt --output backup.tar study-launcher-YYYYMMDD.tar.gpg` (hỏi `BACKUP_PASSPHRASE`), rồi `tar -xf backup.tar` → ra `auth.dump` và `public.dump`.
3. Nạp **theo đúng thứ tự** (tài khoản trước, rồi hồ sơ, rồi phần còn lại):
   ```bash
   pg_restore --no-owner --data-only -d "$DB_URL" auth.dump
   pg_restore --no-owner --data-only -t families -t profiles -d "$DB_URL" public.dump
   pg_restore --no-owner --data-only -d "$DB_URL" \
     -t family_settings -t app_slots -t task_templates -t homework_items -t task_runs -t day_sessions \
     -t overrides -t allowlist_entries -t unlock_requests -t extension_devices -t push_subscriptions \
     -t trust_state -t audit_log public.dump
   ```
4. Đăng nhập lại bằng tài khoản phụ huynh để kiểm tra.

