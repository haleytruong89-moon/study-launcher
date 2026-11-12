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
| A10 | **Thông báo đẩy (S5)** — làm trên máy tính, 1 lần: (1) mở app (link chính thức), đăng nhập phụ huynh → **Thêm › Thông báo** → bấm **Tạo khóa thông báo**; (2) **Vercel → Settings → Environment Variables**: thêm `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` (chép từ trang vừa mở, chọn Production + Preview) → **Redeploy**; (3) **GitHub → Secrets** (như A9): thêm `CRON_SECRET` (cùng giá trị) và `APP_URL` (= link Vercel chính thức, vd `https://study-launcher.vercel.app`); (4) trên **iPhone**: Safari mở app → Chia sẻ → **Thêm vào MH chính** → mở từ biểu tượng → Thêm › Thông báo → **Bật** → **Gửi thử** | Khóa được tạo **trong trình duyệt của bạn**, không qua máy chủ hay chat. Không gửi các giá trị này cho ai. Đổi khóa sau này = mọi điện thoại phải bật lại. Kiểm tra: `/api/health/ready` hết cảnh báo `push_configured`. Nhắc buổi tối do **Vercel Cron** chạy (từ 07/11/2026, file `vercel.json`): tới trong khung **21:00–21:59**, chỉ khi còn việc chờ. Vercel tự dùng `CRON_SECRET` ở bước (2), không cần cài thêm. GitHub job "Evening reminder" chỉ còn chạy tay (lịch cũ của GitHub chạy trễ tới 3–4 giờ sáng). Ngoài 20:00–23:00 app không gửi nhắc |

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

## B+. Cài extension bản chạy thử lên laptop con (S4b, ~10 phút/máy)

Bản chạy thử cài tay (chế độ nhà phát triển). Con **có thể tắt** nếu biết cách. Chạy thử vài ngày ổn rồi mới đăng cửa hàng (mục C) để cài kiểu không tắt được.

1. Trên laptop con, mở **https://study-launcher-nine.vercel.app/downloads/study-launcher-extension.zip** → tải về → chuột phải → **Extract All** (giải nén). Để thư mục ở chỗ cố định, ví dụ `C:\StudyLauncher`. **Đừng xóa thư mục này**: extension chạy từ đó.
2. Mở **edge://extensions** (Edge) hoặc **chrome://extensions** (Chrome) → bật **Developer mode / Chế độ nhà phát triển** → **Load unpacked / Tải tiện ích đã giải nén** → chọn thư mục có file `manifest.json` bên trong (nếu báo *Manifest file is missing*, là đang chọn thư mục ngoài — mở vào thư mục con).
3. Ở thẻ extension bấm **Details / Chi tiết** → bật **Allow in InPrivate** (Edge) / **Allow in Incognito** (Chrome). Không bật thì cửa sổ ẩn danh không bị chặn (trang Thiết bị sẽ cảnh báo).
   Extension tự mở trang **Ghép máy**. Đăng nhập **tài khoản của con** nếu được hỏi.
4. Trên iPhone: trang phụ huynh → **Thiết bị** → ở tên con bấm **Tạo mã ghép máy** → đọc 6 số cho con nhập → **Ghép máy**. Thấy "Xong! Máy này đã ghép" là được.
5. Thử: mở youtube.com → phải chuyển sang trang "Đang giờ học". Ở trang phụ huynh → **Mở/khóa** → **Mở 15 phút** → trong ≤ 30 giây youtube vào được; **Về bình thường** → tab youtube tự chuyển lại trang chặn.
6. Dùng cả Edge và Chrome trên cùng máy → làm bước 2–4 cho **từng** trình duyệt (mỗi trình duyệt một mã).

Gỡ một máy: trang phụ huynh → **Thiết bị** → **Gỡ máy** (extension trên máy đó khóa web cho tới khi ghép lại).

Khi có bản mới của extension: tải zip mới, giải nén **đè** lên thư mục cũ, vào trang extensions bấm **Reload / Tải lại**.

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


---

## F. Tự xóa ảnh cũ (S3e, ~5 phút, sau khi merge PR S3e)

Mỗi tuần (thứ Hai 04:17 giờ VN) GitHub gọi `/api/cron/cleanup` để xóa **tệp** ảnh/đề bài cũ hơn số ngày ở **Luật trong nhà › Giữ ảnh bài** (mặc định 120). Việc này **chỉ bắt đầu khi đủ 2 secret GitHub dưới đây**; thiếu thì job tự bỏ qua (chỉ hiện cảnh báo).

| Bước | Việc | Ghi chú |
|---|---|---|
| F1 | **Đã làm bước A10 (thông báo đẩy, PR S5)?** → **không phải làm gì thêm**: job này dùng lại đúng 2 secret GitHub `CRON_SECRET` + `APP_URL` và biến Vercel `CRON_SECRET` của A10 | Cùng 1 giá trị cho cả nhắc 21:45 và tự xóa ảnh |
| F2 | **Chưa làm A10:** tự tạo `CRON_SECRET` = chuỗi ngẫu nhiên ≥ 32 ký tự (vd nút "tạo mật khẩu" của trình quản lý mật khẩu, chỉ chữ + số). (1) **Vercel → Settings → Environment Variables**: thêm `CRON_SECRET` (Production) → **Redeploy**; (2) **GitHub → Secrets** (như A9): thêm `CRON_SECRET` (cùng giá trị) và `APP_URL` (= link Vercel chính thức, vd `https://study-launcher.vercel.app`) | Không gửi giá trị này qua chat. Sau này làm A10 thì dùng lại giá trị này, không tạo cái mới |
| F3 | Trước lần chạy thật đầu tiên, nên bấm **Luật trong nhà › Xem trước sẽ xóa gì** để thấy số ảnh sẽ bị xóa | Muốn thử job mà không xóa: **GitHub → Actions → Weekly photo cleanup → Run workflow** (ô "Chỉ đếm, không xóa" mặc định đã tick) |

Ảnh đã xóa **không lấy lại được**: bản sao lưu hằng tuần (A9) không gồm ảnh. Muốn giữ lâu hơn: tăng "Giữ ảnh bài" (tối đa 365 ngày) **trước** lần chạy kế tiếp.

---

## G. Góc bình yên (S-BY0, ~5 phút, sau khi merge PR S-BY0)

Merge PR **không** tự bật cho con (`by_enabled = false`). Bật khi cả nhà đã nói chuyện về Góc bình yên.

| Bước | Việc | Ghi chú |
|---|---|---|
| G1 | **Đã làm A10** (thông báo đẩy). Chưa làm A10 → làm A10 trước | "Con muốn nói chuyện" **không** nhắc lại sau 10' (chốt 05/11/2026): con được nhắc tìm bố mẹ trực tiếp. Job GitHub `by-escalate.yml` bỏ lịch 5' từ 07/11/2026 (chỉ chạy tay) |
| G2 | Trên **iPhone của bố và của mẹ**: Thêm › **Thông báo** → bật, bấm **Gửi thử** | Chưa có điện thoại nào bật → con **không thấy** nút "Muốn nói chuyện" (để con không tưởng là đã báo) |
| G3 | Thêm › **Luật trong nhà** › mục **Góc bình yên** → tích **Bật Góc bình yên cho các con** → Lưu | Trong giờ học mỗi lần tối đa 10' (≥ 5). Tắt lúc nào cũng được: khu này ẩn, dữ liệu của con giữ nguyên, nút "Muốn nói chuyện" vẫn còn |
| G4 | Ngồi cùng con: con mở **🌿 Góc bình yên** trên màn Hôm nay → vào thẳng (**không có PIN riêng** từ 07/11/2026 — các con thấy gõ mã mỗi lần là phiền) → mở **🔒 Ai thấy gì?** đọc cùng con | Ai dùng máy đang đăng nhập tài khoản con cũng vào được: nhắc con đăng xuất / khóa máy khi cho người khác mượn |

---

## H. Database riêng cho link preview (Đợt 4, ~30 phút, làm 1 lần)

**Vì sao:** đến nay link preview của mỗi PR dùng **database thật** → thử một PR là đụng dữ liệu thật của 2 con, và tính năng có SQL mới (vd R8b ngân hàng giờ nghỉ) không thử được trước khi merge. Sau mục này, link preview dùng một **project Supabase thứ hai chỉ có dữ liệu giả** (gia đình "Gia đình thử (preview)", 2 con "Con A", "Con B"). Link chính thức không đổi gì. Quyết định 12/11/2026.

Chưa làm mục này thì mọi thứ chạy như cũ: workflow mới tự bỏ qua (báo "chưa có secret PREVIEW_DB_URL").

### H0. Kiểm tra trước: còn suất project miễn phí không? ⚠️

Theo Supabase (tra ngày 12/11/2026): gói Free **tối đa 2 project đang chạy**, tính **gộp mọi tổ chức mà bạn là Owner/Administrator**; project **đã tạm dừng (paused) không tính**; project Free **tự tạm dừng sau 1 tuần không dùng**. Nguồn: [supabase.com/pricing](https://supabase.com/pricing), [Billing on Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase).

Bạn đang chạy **App Toán + study-launcher = 2 project** → rất có thể **đã hết suất**. Cách gỡ (bạn chọn, Claude không tự làm):
- App Toán không cần chạy nữa → **Pause** nó (Project Settings › General) rồi tạo project preview;
- một người khác trong nhà dùng **tài khoản Supabase riêng** tạo project preview (nên đọc điều khoản của Supabase trước);
- nâng gói trả phí → **không** làm khi chưa quyết (CLAUDE.md: không thêm dịch vụ trả phí).

Không có suất → dừng ở đây; link preview vẫn dùng database thật như trước.

### H1. Tạo project preview (trên supabase.com)

| # | Việc | Ghi chú |
|---|---|---|
| H1.1 | **New project**, tên `study-launcher-preview`, region **Southeast Asia (Singapore)** (như project thật). Mật khẩu DB: dài, **chỉ chữ + số** (khỏi phải mã hóa ký tự đặc biệt), lưu vào trình quản lý mật khẩu | Nếu màn tạo có ô **"Automatically expose new tables"** (Data API): **bỏ tick**, giống project thật. Không thấy ô này cũng không sao: bước H3 xóa–dựng lại sẽ bỏ quyền mặc định |
| H1.2 | **Không** nối GitHub cho project này (Integrations › GitHub để trống) | SQL vào preview do workflow của repo làm (H3, H5). Chỉ project **thật** nối GitHub (A6) |
| H1.3 | **Authentication › Sign In / Providers**: tắt **"Allow new users to sign up"** | Như A7 |
| H1.4 | Ghi lại của project **preview**: Project URL, `anon` key, `service_role` key (như A3) | Nếu trang API Keys chỉ hiện "Publishable / Secret", mở tab **Legacy API Keys** để lấy `anon` + `service_role` giống project thật |
| H1.5 | Nút **Connect** › **Session pooler** › chép chuỗi kết nối, thay `[YOUR-PASSWORD]` bằng mật khẩu DB | Dạng `postgresql://postgres.<mã>:<mật khẩu>@aws-…pooler.supabase.com:5432/postgres`. **Phải** là Session pooler: máy GitHub chỉ có IPv4, còn "Direct connection" là IPv6 ([Supabase: Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)); Transaction pooler (cổng 6543) không hợp cho chạy SQL dài. Dán **nguyên dạng** (chỉ được thêm `?sslmode=require`): chuỗi có tham số khác, nhiều máy chủ, hay ký tự `@` chưa mã hóa trong mật khẩu sẽ bị workflow từ chối |
| H1.6 | Mở project **THẬT** › Project Settings › General › **Project ID** (20 chữ thường, cũng là phần đầu link `https://<mã>.supabase.co`) → ghi lại | Đây là "mã project thật" để workflow **từ chối** mọi thao tác nhắm vào nó |

### H2. GitHub: 4 secret

GitHub › repo › Settings › Secrets and variables › Actions:

| Tab | Tên | Giá trị |
|---|---|---|
| Secrets | `PREVIEW_DB_URL` | chuỗi kết nối **preview** ở H1.5 |
| Secrets | `PREVIEW_SERVICE_ROLE_KEY` | `service_role` key của **preview** (H1.4) |
| Secrets | `PREVIEW_PARENT_PASSWORD` | mật khẩu đăng nhập thử, ≥ 12 ký tự, **khác** mọi mật khẩu thật |
| Secrets | `PRODUCTION_PROJECT_REF` | mã project **THẬT** (H1.6). Đặt ở tab **Secrets**, không phải Variables: repo công khai, giá trị Variables hiện rõ trong log Actions |

Kiểm tra secret `SUPABASE_DB_URL` và/hoặc `SUPABASE_URL` của bước A9 vẫn còn: workflow dùng chúng để **đối chiếu** mã project thật (thiếu cả hai → workflow từ chối chạy).

### H3. Dựng database preview lần đầu (sau khi PR Đợt 4 đã merge)

GitHub › **Actions** › **Preview database (reset — XÓA dữ liệu thử)** › **Run workflow** › *Use workflow from*: `main` › ô xác nhận gõ **`XOA-PREVIEW`** › để tick "Thêm lại dữ liệu thử" › **Run**. Xanh = xong (~3 phút). Trang kết quả ghi tên đăng nhập thử.

Workflow này **chỉ xóa project preview**. Trước khi xóa bất cứ gì, nó tự kiểm 5 lớp, lớp nào thấy sai cũng dừng:
1. phải gõ đúng `XOA-PREVIEW` và chạy từ `main`;
2. mã project trong `PREVIEW_DB_URL` **khác** mã project thật (`PRODUCTION_PROJECT_REF`), và mã thật này phải **khớp** với `SUPABASE_DB_URL`/`SUPABASE_URL` (biến gõ sai cũng bị phát hiện); `PREVIEW_DB_URL` không được trùng `SUPABASE_DB_URL`;
3. nhìn vào database (chỉ đọc): nếu có **bất kỳ tài khoản email thật** nào (database thật luôn có email của bố mẹ) → dừng. Preview chỉ có email `@example.com` và `@study-launcher.local`;
4. khóa `PREVIEW_SERVICE_ROLE_KEY` phải thuộc project preview; kiểm lại email từng tài khoản trước khi xóa;
5. lệnh xóa bảng kiểm lại lớp 3 **trong cùng một giao dịch** → sai là hoàn tác hết.

Không bước nào in ra chuỗi kết nối, khóa hay mã project. **Claude có thể gợi ý chạy workflow này, nhưng không tự chạy, và không bao giờ nhắm vào project thật.**

### H4. Vercel: biến môi trường **chỉ cho Preview**

Vercel › project › Settings › **Environment Variables**. Mỗi biến hiện đang áp cho cả Production + Preview. Với 3 biến đầu trong bảng: bấm **Edit** biến cũ → **bỏ tick Preview** (giữ Production) → Save; rồi **Add** biến **cùng tên**, giá trị của preview, **chỉ tick Preview**.

| Biến | Preview dùng | Vì sao |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL **preview** | trỏ preview sang database giả |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` key **preview** | như trên |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key **preview** | như trên — **quan trọng nhất**: thiếu biến này thì máy chủ preview vẫn ghi vào database thật |
| `FIRST_PARENT_EMAIL` | `phu-huynh-thu@example.com` (chỉ Preview) | để `/api/health/ready` của preview không báo thiếu; gia đình thử đã có sẵn nên không cần "Thiết lập lần đầu" |
| `NEXT_PUBLIC_APP_URL` | **giữ nguyên** link chính thức | xem "Extension và link preview" bên dưới |
| `CHILD_EMAIL_DOMAIN` | không đặt (mặc định `study-launcher.local`) | tài khoản con tạo thêm trên preview phải mang đuôi này, nếu không lớp kiểm 3 sẽ coi là "email thật" và chặn workflow |
| `VAPID_*`, `CRON_SECRET` | để nguyên | lịch Vercel Cron **chỉ chạy trên bản Production** ([Vercel](https://vercel.com/kb/guide/troubleshooting-vercel-cron-jobs)); các job GitHub gọi `APP_URL` = link chính thức. Preview chỉ gửi thông báo tới máy đã bật thông báo **trên chính link preview** (lưu trong database preview) — không làm phiền điện thoại thật |

Biến mới chỉ có hiệu lực cho **bản build mới**: Deployments › chọn một bản Preview › **Redeploy** (hoặc chờ PR kế tiếp).

Kho ảnh (`homework`, `proofs`, `avatars`) do chính các file SQL tạo (0001, 0012) → **không** phải tạo tay.

**Extension và link preview.** Mỗi lần build, `scripts/build-extension.mjs` gói địa chỉ `NEXT_PUBLIC_APP_URL` vào extension (`public/downloads/study-launcher-extension.zip`), và extension **chỉ ghép máy / chỉ nói chuyện** với đúng địa chỉ đó. Với Preview giữ link chính thức:
- extension **không thể** ghép với link preview (trang preview không có content script) → dữ liệu thật và giả **không trộn**; trang "con chưa cài extension" trên preview cũng không gửi báo động (khác địa chỉ chính thức);
- nhưng file zip tải **từ link preview** là extension chứa **code chưa merge** mà vẫn nói chuyện với **máy chủ + database thật**. → **Chỉ tải extension từ link chính thức** để cài cho máy con (như mục B+).
- Không đặt `NEXT_PUBLIC_APP_URL` = link preview: mỗi PR có một địa chỉ khác nhau nên giá trị nào cũng sai; để trống thì máy chủ báo lỗi (biến bắt buộc).

### H5. Kiểm tra

1. Mở `https://<link-preview>/api/health/ready` → `"ok": true`. Cảnh báo `app_url_matches_host` là **bình thường** với preview.
2. Mở link preview → đăng nhập `phu-huynh-thu@example.com` + `PREVIEW_PARENT_PASSWORD` → thấy **Con A, Con B** (mỗi con 2 bài tập, 1 việc bổ sung, 1 kỹ năng). **Thấy tên thật của con = sai**: xem lại H4 rồi Redeploy.
3. Xem màn của con: đăng xuất → đăng nhập `con-a@study-launcher.local` (hoặc `con-b@…`), cùng mật khẩu. Đặt PIN cho con thử ở trang phụ huynh nếu muốn.
4. Mở link **chính thức** → vẫn là 2 con thật, không có Con A/Con B.

### H6. Từ giờ, khi thử một PR

- Link preview hiện **dữ liệu giả**. Bấm gì, xóa gì cũng được — không đụng dữ liệu thật.
- PR **có SQL**: workflow **Preview database (apply migrations)** tự chạy khi PR mở/cập nhật → đợi nó **xanh** rồi mới thử preview. SQL của PR chạy trên database preview **trước** khi merge; database thật vẫn chỉ nhận SQL **lúc bạn merge** (như cũ).
- Nếu một PR **sửa lại** file SQL của chính nó sau khi đã chạy trên preview, PR có SQL bị **đóng không merge**, hoặc dữ liệu thử rối quá → chạy lại H3 (reset).
- Hai PR có SQL cùng mở thì dùng chung một database preview (SQL của cả hai đều có ở đó).
- Muốn thử với **dữ liệu thật của 2 con** (vd xem số liệu tuần thật) → vẫn phải **merge** rồi xem trên link chính thức.
- Project preview **tự ngủ sau 1 tuần** không dùng: link preview báo lỗi database, workflow báo "không đọc được database preview". Vào Supabase › project preview › **Restore** (cần còn suất, xem H0).
- Workflow từ chối với lỗi "có N tài khoản không phải tài khoản thử": ai đó đã tạo tài khoản email thật trong project preview → xóa tài khoản đó ở Supabase preview › Authentication › Users rồi chạy lại.

### H7. Quay về như cũ

1. Vercel: xóa các biến **chỉ-Preview** đã thêm ở H4; ở 3 biến Production (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) bấm Edit → **tick lại Preview** → Redeploy một bản preview. Từ đó preview lại dùng database thật.
2. GitHub: xóa secret `PREVIEW_DB_URL` → các workflow preview tự bỏ qua.
3. (Tùy) xóa hoặc Pause project `study-launcher-preview` để trả suất miễn phí.
