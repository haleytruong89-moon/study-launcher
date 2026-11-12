# Study Launcher — Hướng dẫn chuẩn bị (cho phụ huynh)

Cập nhật: 13/10/2026 (phần C viết lại 12/11/2026). Làm theo thứ tự A → D. Phần B làm được ngay, **không cần code**, và nên làm sớm nhất vì nó kiểm tra giả định rủi ro nhất của dự án.

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

> Lưu ý: mục đích của bài thử là xác nhận các khóa registry chạy đúng trên máy thật. Tên khóa đã đối chiếu tài liệu ngày 12/11/2026 (nguồn ở cuối phần C). Edge dùng `HKLM\SOFTWARE\Policies\Microsoft\Edge\...` và một số tên khác (`InPrivateModeAvailability`, `BrowserAddProfileEnabled`) — cấu hình thật cho cả Chrome + Edge bằng script ở **C8**. Không cần thử chính sách "trang chủ": trên máy không join domain Chrome bỏ qua nó; extension của mình sẽ tự mở Launcher ở tab mới.

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

## C. Đăng extension lên cửa hàng + cài kiểu không gỡ được (S6, ~2 giờ + thời gian chờ duyệt)

Cập nhật: 12/11/2026. **Vì sao phải đăng cửa hàng:** laptop Windows ở nhà không "join domain" công ty, nên Chrome và Edge **chỉ chịu ép cài** (con không gỡ/tắt được) extension **lấy từ cửa hàng chính thức**. Google: cài tự động extension không có trên Chrome Web Store thì máy phải join domain Active Directory ([nguồn 3]). Microsoft ghi rõ với Edge: máy không join domain thì chỉ ép cài được extension có trên Edge Add-ons ([nguồn 7]). Bản cài tay hiện nay (B+) con có thể tắt — ép cài từ cửa hàng mới làm cho khóa máy là thật.

Hồ sơ để copy–dán (mô tả, lý do từng quyền, câu trả lời tab Riêng tư, ảnh): **`docs/store/LISTING.md`** + thư mục **`docs/store/assets/`**. Chính sách riêng tư: **https://study-launcher-nine.vercel.app/chinh-sach-rieng-tu** (công khai, không cần đăng nhập).

**Thứ tự:** C1–C2 làm ngay được (tạo tài khoản) · C3–C6 **sau khi PR #64 và PR "biểu tượng + manifest" (LISTING §7) đã merge** · C7–C10 sau khi cửa hàng duyệt xong.

### C1. Tài khoản nhà phát triển Chrome Web Store (~15 phút, mất phí 1 lần)

| # | Việc | Ghi chú |
|---|---|---|
| C1.1 | Chọn **một tài khoản Google** của bố hoặc mẹ (nên bật xác minh 2 bước). Có thể dùng một email riêng cho việc này | **Email tài khoản nhà phát triển không đổi được sau khi tạo** ([nguồn 1]). Email liên hệ hiện trên trang extension (kể cả khi Unlisted) — không dùng email có tên các con |
| C1.2 | Mở **https://chrome.google.com/webstore/devconsole** → đăng nhập → đồng ý *Developer Agreement* → **trả phí đăng ký** bằng thẻ | Phí **một lần**. Google công bố **5 USD** (Chromium Blog 12/03/2020, [nguồn 2]); trang hướng dẫn hiện tại (xem 12/11/2026) chỉ ghi "one-time registration fee", không ghi số → **xem số tiền trên màn hình trước khi trả** |
| C1.3 | Mục *Account*: tên nhà phát hành trung tính, vd **Study Launcher Family**. Nếu được hỏi *trader / non-trader* (người bán hàng?), chọn **non-trader** (gia đình, không kinh doanh) | Câu hỏi này Claude chưa kiểm chứng trên màn hình thật — chụp màn hình gửi Claude nếu chưa rõ |
| C1.4 | Ghi lại: đã tạo xong | Tài khoản mới mặc định được đăng **2 extension** ([nguồn 4]) — đủ |

### C2. Tài khoản Microsoft Partner Center cho Edge (~15 phút, miễn phí)

| # | Việc | Ghi chú |
|---|---|---|
| C2.1 | Cần **tài khoản Microsoft cá nhân** (Outlook/Hotmail/Live). **Không** dùng tài khoản công ty/trường học | Microsoft: không nhận đăng ký bằng tài khoản work/school ([nguồn 5]) |
| C2.2 | Mở **https://partner.microsoft.com/dashboard/microsoftedge/overview** → đăng nhập → form đăng ký hiện ra (nếu không: *Account settings › Programs* → *Get started* ở thẻ Microsoft Edge) | **Miễn phí**: "There is no registration fee" ([nguồn 5]) |
| C2.3 | *Account country/region*: **Vietnam** · *Account type*: **Individual** · *Publisher display name*: vd **Study Launcher Family** → tick đồng ý điều khoản → **Finish** | Quốc gia và loại tài khoản **không đổi được** sau khi đăng ký. Individual duyệt nhanh hơn Company ([nguồn 5]). Chờ email xác nhận |

### C3. Lấy gói zip để tải lên (~5 phút)

1. Trên máy tính, tải **https://study-launcher-nine.vercel.app/downloads/study-launcher-extension.zip** (link chính thức; **không** lấy từ link preview của PR). Gói này do Vercel build tự động mỗi lần merge (`npm run build` → `scripts/build-extension.mjs`).
2. **Không giải nén rồi nén lại** — tải nguyên file zip lên cửa hàng.
3. Kiểm tra nhanh (mở zip bằng File Explorer, không cần giải nén): ngay trong zip (không có thư mục con) có `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js` (+ các file `icon-*.png` sau PR biểu tượng). Mở `manifest.json` bằng Notepad: dòng `"matches"` phải là `https://study-launcher-nine.vercel.app/*` và `"version"` là bản mới nhất. Không có file `.map`, `.ts`, `.env` (đã kiểm tra 12/11/2026: gói 0.3.3 gồm đúng 5 file trên, mã không nén/không làm rối).

### C4. Nộp lên Chrome Web Store (~30 phút)

1. **devconsole** → **+ New item** → chọn file zip → *Upload*. Cửa hàng tự chạy thử cài đặt khi tải gói lên; nếu báo lỗi thì gửi Claude, sửa trước khi nộp ([nguồn 4]).
2. Tab **Store listing**: dán mô tả, chọn danh mục, ngôn ngữ, tải icon 128, 3 ảnh 1280×800, small promo tile 440×280 — theo `LISTING.md` §1.
3. Tab **Privacy practices**: *Single purpose* (§2), lý do từng quyền (§3), *Remote code* = **No**, *Data usage* tick đúng như §4 + 3 ô cam kết, *Privacy policy URL*.
4. Tab **Distribution**: *Visibility* = **Unlisted** (§6). Khu vực: tất cả.
5. Tab **Test instructions**: dán đoạn §5 (không đưa tài khoản của con).
6. **Submit for review**.

### C5. Nộp lên Edge Add-ons (~30 phút)

1. Partner Center → **Microsoft Edge** → **Create new extension** → tải **cùng file zip** lên.
2. **Availability**: *Visibility* = **Hidden** (chỉ ai có link mới thấy); *Markets*: tất cả.
3. **Properties**: danh mục (LISTING §1); *Does your extension access, collect or transmit personal information?* = **Yes** → *Privacy policy URL*; *Website*.
4. **Store listings** → ngôn ngữ **Vietnamese**: mô tả (§1, cần 250–10.000 ký tự — đoạn trong LISTING đủ), *Extension logo* = `edge-logo-300.png`, ảnh 1280×800, *Small promotional tile* 440×280 ([nguồn 6]).
5. **Submit** → ô *Notes for certification*: dán đoạn §5 → **Publish**.

### C6. Chờ duyệt

| Cửa hàng | Thời gian (theo tài liệu chính thức) |
|---|---|
| Chrome | Phần lớn **vài ngày**, có thể **vài tuần**; quá 3 tuần thì liên hệ hỗ trợ. Có thể lâu hơn với *nhà phát triển mới, extension mới, quyền rộng* (`<all_urls>`) — mình có cả ba ([nguồn 8]) |
| Edge | Tới **7 ngày làm việc** ([nguồn 6]) |

Bị từ chối: chép nguyên email/lý do gửi Claude. Không tự sửa quyền trong manifest.

### C7. Sau khi được duyệt: ghi lại ID extension (~5 phút)

- **Chrome**: devconsole → mở item → **Item ID** (32 chữ cái a–p; cũng là đoạn cuối link trang cửa hàng).
- **Edge**: Partner Center → mở extension → tìm dòng **Extension ID** (32 chữ cái a–p; cũng là đoạn cuối link trang Edge Add-ons `microsoftedge.microsoft.com/addons/detail/…/<ID>`). **Không** dùng *Store ID / Product ID* (dạng chữ hoa + số).
- Ghi 2 ID vào ghi chú của bạn. **Vercel** (tùy chọn): thêm `NEXT_PUBLIC_EXTENSION_ID_CHROME`, `NEXT_PUBLIC_EXTENSION_ID_EDGE` để lưu cho đủ. Hiện app **chưa dùng** 2 biến này ở đâu (đã kiểm 12/11/2026 — ghép máy đi qua content script, không cần ID), nên **không cần Redeploy**.

### C8. Cài kiểu bắt buộc trên laptop của con (~20 phút/máy)

Điều kiện: tài khoản Windows của con là **Standard** (không phải Administrator); bạn biết mật khẩu một tài khoản Administrator trên máy đó.

1. Trên laptop con, đăng nhập tài khoản **Administrator**. Lấy 2 file `cai-chinh-sach.ps1` và `go-chinh-sach.ps1` trong thư mục `docs/store/windows-policy/` của repo (GitHub → mở file → nút **Download raw file**), để vào một thư mục, vd `C:\StudyLauncher\policy`.
2. Start → gõ **PowerShell** → chuột phải **Windows PowerShell** → **Run as administrator**, rồi gõ:
   ```powershell
   cd C:\StudyLauncher\policy
   powershell -ExecutionPolicy Bypass -File .\cai-chinh-sach.ps1
   ```
   Dán **ID Chrome**, Enter, dán **ID Edge**, Enter. Script đặt (máy nào cũng như nhau, cho mọi tài khoản Windows):

   | Trình duyệt | Khóa registry `HKLM\SOFTWARE\Policies\…` | Tác dụng |
   |---|---|---|
   | Chrome | `Google\Chrome\ExtensionInstallForcelist\N` = `<ID Chrome>;https://clients2.google.com/service/update2/crx` | Ép cài từ Chrome Web Store, con không gỡ/tắt được |
   | Chrome | `IncognitoModeAvailability` = 1 · `BrowserGuestModeEnabled` = 0 · `BrowserAddPersonEnabled` = 0 · `DeveloperToolsAvailability` = 2 | Tắt ẩn danh · tắt khách · không thêm hồ sơ mới · tắt DevTools ([nguồn 9–12]) |
   | Edge | `Microsoft\Edge\ExtensionInstallForcelist\N` = `<ID Edge>;https://edge.microsoft.com/extensionwebstorebase/v1/crx` | Ép cài từ Edge Add-ons; "Users can't uninstall or turn off" ([nguồn 7]) |
   | Edge | `InPrivateModeAvailability` = 1 · `BrowserGuestModeEnabled` = 0 · `BrowserAddProfileEnabled` = 0 · `DeveloperToolsAvailability` = 2 | Tắt InPrivate · tắt khách · không thêm hồ sơ mới · tắt DevTools ([nguồn 13–15], [nguồn 7]) |

   Lưu ý tên khác nhau: thêm hồ sơ là `BrowserAddPersonEnabled` (Chrome) nhưng `BrowserAddProfileEnabled` (Edge); ẩn danh là `IncognitoModeAvailability` (Chrome) nhưng `InPrivateModeAvailability` (Edge). Script không xóa chính sách khác đã có (vd của trường).
3. **Đóng hết** cửa sổ Chrome và Edge, mở lại. Kiểm tra (đăng nhập tài khoản **của con**):

   | Kiểm tra | Mong đợi | Chrome | Edge |
   |---|---|---|---|
   | `chrome://policy` / `edge://policy` → *Reload policies* | Các dòng ở bảng trên, trạng thái OK | | |
   | `chrome://extensions` / `edge://extensions` | Study Launcher ghi "được quản trị viên cài đặt", **không** có nút Gỡ, **không** tắt được | | |
   | Ctrl+Shift+N | Không mở được ẩn danh / InPrivate | | |
   | Menu hồ sơ (ảnh đại diện góc trên) | Không có "Khách" / "Thêm hồ sơ" | | |
   | F12 | Không mở được DevTools | | |
   | Chi tiết extension → *Quyền truy cập trang web* | Thử đổi sang "Khi nhấp": nếu đổi được thì web vẫn **bị khóa** (extension 0.3.2+ fail-closed) — ghi lại kết quả cho Claude | | |

4. **Ghép máy cho bản cửa hàng**: extension mới tự mở trang **Ghép máy** → đăng nhập tài khoản con → trên iPhone: Thiết bị → **Tạo mã ghép máy** → nhập 6 số. Bản cửa hàng là extension **khác** bản cài tay (ID khác, bộ nhớ khác) nên **phải ghép lại**, mỗi trình duyệt một mã.
5. Thử như B+ bước 5 (youtube → trang chặn; Mở 15 phút; Về bình thường).

### C9. Gỡ bản cài tay (B+) sau khi bản cửa hàng chạy

1. Ở `edge://extensions` / `chrome://extensions` sẽ thấy 2 dòng "Study Launcher": bản cửa hàng (ghi "được quản trị viên cài đặt") và bản cài tay (có nút **Gỡ**). Bấm **Gỡ** ở **bản cài tay**. Tắt **Chế độ nhà phát triển**. (Chính sách tắt DevTools có thể đã tự vô hiệu bản cài tay — gỡ cho gọn.)
2. Gỡ bản cài tay sẽ làm iPhone nhận thông báo "Extension trên laptop của … vừa bị gỡ" — **đúng như mong đợi**.
3. Trang phụ huynh → **Thiết bị** → ở dòng laptop **cũ** (lần cuối hỏi máy chủ không còn cập nhật) bấm **Gỡ máy**. Dòng mới (vừa ghép ở C8.4) giữ lại.
4. Có thể xóa thư mục `C:\StudyLauncher` của bản cài tay (giữ thư mục `policy`).

### C10. Chặn trình duyệt khác (Firefox, Cốc Cốc, Opera, Brave…) bằng Microsoft Family Safety

Chính sách ở C8 chỉ áp cho Chrome và Edge. Tài khoản Standard vẫn có thể tự cài một số trình duyệt **cho riêng mình** (không cần quyền quản trị) — kể cả **Cốc Cốc** (chạy được extension Chrome nhưng **không** nhận chính sách của Chrome). Phải chặn bằng **Microsoft Family Safety**:

1. Tài khoản Windows của con phải là **tài khoản Microsoft của con** nằm trong nhóm gia đình (https://family.microsoft.com). Tài khoản cục bộ (local) không được Family Safety quản lý.
2. Trong Family Safety → con → **Edge** → bật **Filter inappropriate websites**. Khi bật, Windows **chặn mọi trình duyệt khác Edge** theo mặc định (vì Family Safety chỉ lọc được trong Edge); con bấm "Ask to use" thì bố mẹ nhận yêu cầu ([nguồn 16]).
3. Nhà dùng cả Chrome: Family Safety → con → **Windows › Apps & games** → **bỏ chặn Google Chrome**. Để nguyên chặn các trình duyệt khác ([nguồn 16]).
4. Bật **Activity reporting** cho con — nếu tắt, cửa sổ trình duyệt bị đóng mà không hiện nút xin phép ([nguồn 16]).
5. Thử: trên tài khoản con, mở/cài Firefox hoặc Cốc Cốc → phải bị chặn.

> Bộ lọc web của Family Safety là của Microsoft, độc lập với Study Launcher (Study Launcher vẫn quyết định giờ học/giờ tự do). Từ 06/2025 có lỗi Family Safety chặn cả trình duyệt đã cho phép sau mỗi lần cập nhật; báo chí 02/2026 ghi Microsoft đã sửa ([nguồn 17]). Nếu Chrome tự nhiên bị chặn, kiểm tra lại bước 3.

### C11. Khi có bản extension mới

Mỗi lần extension đổi (PR có đụng `extension/`): sau khi merge, tải zip mới (C3) → devconsole: item → **Package › Upload new package** → Submit; Partner Center: extension → **Update** → tải zip → Publish. Số `version` phải tăng. Duyệt lại như C6. Laptop **tự cập nhật** từ cửa hàng, không phải làm gì trên máy con.

### C12. Bỏ toàn bộ chính sách (trả máy về như cũ)

PowerShell (Run as administrator) → `powershell -ExecutionPolicy Bypass -File .\go-chinh-sach.ps1` → dán 2 ID. Chỉ xóa đúng những gì `cai-chinh-sach.ps1` đặt. Đóng/mở lại trình duyệt: extension ép cài tự bị gỡ ([nguồn 7]) → iPhone nhận thông báo "bị gỡ" (bình thường).

### Nguồn (tra ngày 12/11/2026)

1. Chrome for Developers — *Register your developer account*: https://developer.chrome.com/docs/webstore/register
2. Chromium Blog (12/03/2020) — "The Chrome Web Store charges a $5.00 fee to register": https://blog.chromium.org/2020/03/new-developer-dashboard-and.html
3. Google Chrome Enterprise Help — *Set Chrome app and extension policies (Windows)*: https://support.google.com/chrome/a/answer/7532015
4. Chrome for Developers Blog (20/08/2026) — *Chrome Web Store updates: Faster reviews, new publication limits…*: https://developer.chrome.com/blog/cws-review-updates-2026
5. Microsoft Learn — *Register as a Microsoft Edge extension developer*: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account
6. Microsoft Learn — *Publish a Microsoft Edge extension* (review ≤ 7 business days, Hidden, image sizes): https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
7. Microsoft Learn — Edge policy *ExtensionInstallForcelist*: https://learn.microsoft.com/en-my/deployEdge/microsoft-edge-policies/extensioninstallforcelist
8. Chrome for Developers — *Chrome Web Store review process*: https://developer.chrome.com/docs/webstore/review-process
9. Google Chrome Enterprise Help — *Allow private browsing* (`IncognitoModeAvailability`, 1 = tắt): https://support.google.com/chrome/a/answer/9302896
10. DISA STIG (Chrome) — `BrowserGuestModeEnabled` = 0 tại `HKLM\Software\Policies\Google\Chrome`: https://stigviewer.com/stig/google_chrome_current_windows/2023-11-21/finding/V-226401
11. DISA STIG (Chrome) — `DeveloperToolsAvailability` = 2: https://stigviewer.com/stig/google_chrome_current_windows/2023-11-21/finding/V-221599
12. Geek Rewind — `BrowserAddPersonEnabled` (DWORD, 0 = không thêm hồ sơ): https://geekrewind.com/enable-or-disable-new-user-profiles-in-chrome/ *(nguồn phụ; danh sách chính sách chính thức chromeenterprise.google không mở được lúc tra)*
13. Microsoft Learn — Edge *InPrivateModeAvailability* (1 = tắt): https://learn.microsoft.com/lb-lu/DeployEdge/microsoft-edge-browser-policies/inprivatemodeavailability
14. Microsoft Learn — Edge *BrowserAddProfileEnabled*: https://learn.microsoft.com/is-is/deployedge/microsoft-edge-policies/browseraddprofileenabled
15. Microsoft Learn — Edge *BrowserGuestModeEnabled*: https://learn.microsoft.com/en-ie/deployedge/microsoft-edge-browser-policies/browserguestmodeenabled
16. Eric Lawrence (cựu kỹ sư Edge), *Family Safety Content Filtering* (12/06/2025): https://textslashplain.com/2025/06/12/family-safety-content-filtering/
17. PC Perspective (13/02/2026), Family Safety chặn trình duyệt khác — đã sửa: https://pcper.com/2026/02/were-innocent-it-was-family-safety-parental-controls-that-blocked-other-browsers/

**Chưa kiểm chứng trên máy thật:** Edge `DeveloperToolsAvailability` = 2 (cùng tên/giá trị với Chrome, tài liệu Edge chỉ nhắc tên); extension Unlisted/Hidden ép cài được trên Windows Home (đúng theo tài liệu, bảng C8 bước 3 là để xác nhận); có đổi được "Quyền truy cập trang web" của extension ép cài hay không; tên chính xác các ô trên màn hình đăng ký Chrome (trader/non-trader).

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

### E+. Diễn tập khôi phục sao lưu (~5 phút, nên làm mỗi tháng 1 lần)

Mục đích: chắc chắn bản sao lưu **mở ra được thật** trước khi có ngày cần dùng. Diễn tập chạy hoàn toàn trên GitHub, nạp bản sao lưu vào một cơ sở dữ liệu **tạm** (bị xóa khi chạy xong). **Không đụng** dữ liệu thật trên Supabase.

1. GitHub → repo → tab **Actions** → bên trái chọn **Restore drill** → nút **Run workflow** → **Run workflow**.
2. Chờ ~3 phút. Dấu ✅ xanh = khôi phục được. Bấm vào lần chạy để xem bảng **"Diễn tập khôi phục: OK"**: số dòng của từng bảng và **ngày học mới nhất** trong `task_runs`.
3. Cách đọc kết quả:
   - `families` = 1, `profiles` = số người trong nhà, `auth.users` ≥ số tài khoản → bình thường.
   - Ngày học mới nhất nên là ngày con dùng app gần với lần sao lưu (sao lưu chạy sáng thứ Hai).
   - Các bảng `by_*` (Góc bình yên) luôn là 0: bản sao lưu cố ý không giữ dữ liệu này.
   - Bảng chỉ có **số đếm**, không có tên, bài hay nội dung gì của con.
4. Dấu ❌ đỏ — đọc dòng lỗi đầu tiên:
   - *No backup found* hoặc *older than 8 days*: sao lưu hằng tuần không chạy → mở workflow *Weekly database backup*, bấm **Run workflow**, rồi diễn tập lại.
   - *could not decrypt*: secret `BACKUP_PASSPHRASE` trên GitHub không khớp mật khẩu lúc sao lưu → kiểm tra trong quản lý mật khẩu.
   - Lỗi khác (*did not restore*, *looks empty*): nhờ Claude xem (chỉ cần gửi link lần chạy; nhật ký không chứa dữ liệu của con).


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
