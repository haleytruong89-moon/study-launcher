# Study Launcher — hồ sơ đăng cửa hàng (Chrome Web Store + Edge Add-ons)

Cập nhật: 12/11/2026 · Dùng cho extension **0.3.3** (manifest hiện tại; PR #64 sẽ lên 0.3.4). Các bước bấm: `docs/SETUP.md` phần C.
File này là **chỗ copy–dán**: mỗi ô bên dưới ghi rõ dán vào ô nào của cửa hàng. Phần tiếng Anh là thứ người duyệt của cửa hàng đọc.

> Mọi câu ở đây đã đối chiếu với code ngày 12/11/2026 (`extension/src/*`, `app/api/ext/*`). Nếu extension đổi việc **gửi** hoặc **lưu** gì, sửa cùng lúc: file này, trang `app/chinh-sach-rieng-tu/page.tsx`, và tab Privacy của 2 cửa hàng.

---

## 1. Thông tin chung (cả 2 cửa hàng)

| Ô | Giá trị |
|---|---|
| Tên (lấy từ manifest) | `Study Launcher` |
| Mô tả ngắn / Summary (lấy từ manifest `description`, Chrome ≤ 132 ký tự) | Hiện tại: `Mở trang học trước, web sau: khóa web theo trạng thái của Study Launcher.` (73 ký tự). Đề xuất đổi sau #64 — xem §7 |
| Ngôn ngữ của trang cửa hàng | **Tiếng Việt** (người dùng là gia đình Việt). Mô tả chi tiết có thêm phần tiếng Anh cho người duyệt |
| Danh mục — Chrome | **Education** (nếu không có, chọn *Productivity › Tools*) |
| Danh mục — Edge | **Productivity** (Edge không có mục Giáo dục riêng cho extension thì chọn mục gần nhất) |
| Trang web / Homepage | `https://study-launcher-nine.vercel.app` |
| Chính sách riêng tư | `https://study-launcher-nine.vercel.app/chinh-sach-rieng-tu` (công khai, không cần đăng nhập) |
| Hỗ trợ / Support | Để trống hoặc dùng email nhà phát triển. **Không** ghi tên các con ở bất kỳ ô nào |
| Hiển thị | Chrome: **Unlisted** · Edge: **Hidden** (xem §6) |
| Khu vực | Tất cả (hoặc chỉ Việt Nam — không ảnh hưởng việc cài bằng chính sách) |
| Giá | Miễn phí |

### Mô tả chi tiết (dán vào *Description* — Chrome và Edge; Edge cần 250–10.000 ký tự)

```text
Study Launcher — học trước, web sau.

Extension đi kèm ứng dụng Study Launcher của gia đình. Bố mẹ cài lên laptop của con:
• Giờ học: trình duyệt chỉ mở các trang học bố mẹ đã cho phép. Trang khác chuyển sang trang "Đang giờ học"; con có thể xin bố mẹ mở trang cần cho việc học.
• Mở tab mới là thấy "Việc hôm nay" của con.
• Xong bài tập và kỹ năng: web mở giờ tự do theo luật của gia đình, hết giờ tự khóa lại.
• Mất mạng hoặc không chắc trạng thái: vẫn khóa, chỉ mở trang học.
• Bố mẹ được báo khi extension bị gỡ.

Cần tài khoản Study Launcher của gia đình và mã ghép máy 6 số từ trang phụ huynh. Extension không đọc nội dung trang web, không gửi lịch sử duyệt web, không quảng cáo, không thống kê.

—

Study Launcher — study first, web later.

Companion extension of a family's own Study Launcher web app. Parents install it on their children's laptops:
• During study time the browser opens only the study sites the parents allowed. Other sites are redirected to a "study time" page where the child can ask the parents to open a page needed for school.
• New tabs open the child's list of today's tasks.
• When homework and daily skills are done, the web opens for free time following the family's rules, then locks again.
• If the server cannot be reached, it stays locked to study sites (fail-closed).
• Parents are notified if the extension is removed.

Requires the family's Study Launcher account and a 6-digit pairing code from the parent page. The extension does not read page content, does not send browsing history, and has no ads or analytics.
Privacy policy: https://study-launcher-nine.vercel.app/chinh-sach-rieng-tu
```

### Hình ảnh (thư mục `docs/store/assets/`)

| Ô | File | Kích thước |
|---|---|---|
| Chrome *Store icon* | `store-icon-128.png` | 128×128 |
| Edge *Extension logo* | `edge-logo-300.png` | 300×300 |
| Ảnh chụp màn hình (cả 2; Chrome cần ≥ 1) | `screenshot-1-dang-gio-hoc-1280x800.png`, `screenshot-2-viec-hom-nay-1280x800.png`, `screenshot-3-gio-tu-do-1280x800.png` | 1280×800 |
| *Small promo tile* (Chrome; Edge tùy chọn) | `promo-small-440x280.png` | 440×280 |

Ảnh là **minh họa** (dữ liệu giả, tên "Con", địa chỉ `*.example`), vẽ lại bằng `bash docs/store/assets/render.sh` từ `docs/store/assets/src/*.html`.

---

## 2. Mục đích duy nhất (Chrome › Privacy practices › *Single purpose*)

```text
During the study time set by the parents in the family's Study Launcher app, restrict the child's browser to the study sites the parents allowed, and open it again for free time when the day's tasks are done.
```

## 3. Lý do cho từng quyền (Chrome › Privacy practices › *Permission justification*)

Đúng với manifest 0.3.3: `declarativeNetRequest`, `storage`, `alarms`, `tabs`, `webRequest`, host `<all_urls>`.

| Quyền | Dán vào ô justification |
|---|---|
| `declarativeNetRequest` | `While the web is locked, the extension installs dynamic rules: top-level navigations to sites outside the parent-approved list are redirected to the Study Launcher "study time" page, the approved sites are allowed, and translate.goog proxy pages are blocked (they would bypass the list). When the web is open all rules are removed. No static rule sets, no header changes.` |
| `storage` | `Stores, in chrome.storage.local only: the device token received when the parents pair the laptop, the last locked/open state, the approved and always-blocked site lists, the open-until time and the count of consecutive failed server checks. This lets the extension stay locked (fail-closed) when the server cannot be reached. No browsing history is stored.` |
| `alarms` | `Checks the state with the family's Study Launcher server every 30 seconds, and fires a one-shot alarm exactly at the end of an open period (e.g. free time) so the web locks again on time.` |
| `tabs` | `When the web locks, tabs already open on sites outside the approved list are moved to the "study time" page (network rules only affect new navigations). New empty tabs and browser start open the child's "today" page. Also catches file: tabs that network rules cannot see. Tab URLs are checked locally and are not sent anywhere.` |
| `webRequest` | `Non-blocking listener for onErrorOccurred on sub_frame requests only, to notice when the extension's own rules blocked a frame of the same site inside an allowed study page (e.g. a Google sign-in frame inside Google Meet). Such a frame (page origin + frame URL, at most once an hour per host) is reported to the parents so they can allow it. It does not read headers or bodies and does not block or modify requests.` |
| Host `<all_urls>` | `The sites to block are not known in advance: everything except the parent-approved list is blocked during study time, so redirect rules (which need host access), the tab check and the frame-error listener must work on any site. The content script is NOT injected into other sites: it runs only on the Study Launcher app's own pages to receive the pairing token. If site access is reduced, the extension stays locked (fail-closed).` |

**Remote code** (Chrome › Privacy practices): chọn **"No, I am not using remote code"**. (Đúng: mọi file JS nằm trong gói, `fetch` chỉ lấy dữ liệu JSON từ máy chủ của gia đình.)

## 4. Dữ liệu thu thập (Chrome › Privacy practices › *Data usage*)

Chrome hỏi extension có **thu thập** loại dữ liệu nào. Trả lời theo đúng code:

| Loại (tên trên Chrome) | Tick? | Vì sao |
|---|---|---|
| Personally identifiable information | Không | Extension không gửi tên, email, địa chỉ… Tên laptop gõ ở trang Ghép máy của ứng dụng, không qua extension |
| Health information | Không | — |
| Financial and payment information | Không | — |
| **Authentication information** | **Có** (thận trọng) | Extension giữ và gửi một **mã thiết bị** (credential của chính ứng dụng, nhận lúc ghép máy) trong mỗi lần hỏi máy chủ. Không đụng mật khẩu của trang nào |
| Personal communications | Không | Không đọc email, tin nhắn |
| Location | Không | Không dùng vị trí. (Máy chủ nào cũng thấy địa chỉ IP khi được gọi; ứng dụng không lưu) |
| **Web history** | **Có** | Khi khóa, địa chỉ trang bị chặn được đưa sang trang "Đang giờ học" (`/blocked?u=…`) và được **lưu** nếu con bấm "Xin bố mẹ mở"; địa chỉ **khung bị chặn** trong trang học được gửi và có thể lưu thành yêu cầu cho bố mẹ |
| User activity | Không | Không ghi click, phím, cuộn chuột. Bộ nghe `webRequest` chỉ thấy lỗi của khung do chính extension chặn. *Nếu người duyệt hỏi, có thể tick thêm cho an toàn* |
| Website content | Không | Không đọc chữ, ảnh, nội dung trang |

**Ba ô cam kết (certifications) — tick cả 3** (đều đúng):

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**: `https://study-launcher-nine.vercel.app/chinh-sach-rieng-tu`

## 5. Hướng dẫn cho người duyệt (Chrome › *Test instructions* · Edge › *Notes for certification*)

Quan trọng: cài vào mà **chưa ghép máy** thì extension **khóa web, chỉ mở trang Study Launcher** (đúng thiết kế fail-closed). Người duyệt cần biết trước để không tưởng là lỗi. Không đưa tài khoản thật của gia đình cho người duyệt.

```text
Study Launcher is a private parental-control tool for one family. It only works together with the family's own web app (https://study-launcher-nine.vercel.app), which assigns tasks and decides when the web is locked or open.

Expected behaviour right after installing, without pairing:
1. The extension opens the app's pairing page (/ghep-may), which asks for a child login. We cannot share the family's child accounts (they belong to minors).
2. Because the laptop is not paired, the extension is fail-closed: every website except the Study Launcher app is redirected to the app's "study time" page (/blocked?u=<blocked address>). New tabs open the app's /today page (which asks to log in). The toolbar popup says "Chưa ghép máy với tài khoản của con" (not paired).
3. Removing the extension restores normal browsing. (Only on a paired laptop does the browser then open the app's /api/ext/uninstalled address, which notifies the parents and shows a neutral page.)

After pairing (parents only): the extension polls GET /api/ext/state every 30 s with its device token; the server answers locked/open and the allowed site list. Nothing else is sent except the blocked-frame report (POST /api/ext/frame-block) described in the permission justifications. No remote code; the source in the package is not minified.

Privacy policy: https://study-launcher-nine.vercel.app/chinh-sach-rieng-tu
```

## 6. Vì sao chọn Unlisted (Chrome) / Hidden (Edge)

- **Unlisted** (Chrome): không có trong kết quả tìm kiếm của cửa hàng, ai có đường link mới thấy; cài kiểu ép buộc bằng chính sách vẫn chạy bình thường. **Public** thì người lạ có thể cài nhầm (với họ extension chỉ khóa trình duyệt). **Private** chỉ cho tài khoản Google được liệt kê — không hợp với cài bằng chính sách trên máy không có tài khoản quản lý.
- **Hidden** (Edge): tương đương Unlisted — gỡ khỏi tìm kiếm/duyệt, chỉ mở được bằng đường link.
- Cả hai vẫn được **duyệt đầy đủ** như bản công khai.

## 7. Việc phải làm trong `extension/` SAU KHI #64 merge (không làm ở nhánh này)

Nhánh `feature/d4-cua-hang` **không sửa** `extension/` vì PR #64 đang đổi `extension/src/*`, `manifest.json` (0.3.3 → 0.3.4) và `extension/README.md`. Sau khi #64 merge, một PR nhỏ (vd `feature/s6-manifest-cua-hang`):

1. **Biểu tượng** — chép `docs/store/assets/icons/icon-{16,32,48,128}.png` vào `extension/static/` (build tự chép `static/*` vào gói), thêm vào manifest:
   ```json
   "icons": { "16": "icon-16.png", "32": "icon-32.png", "48": "icon-48.png", "128": "icon-128.png" },
   "action": { "default_title": "Study Launcher", "default_popup": "popup.html",
               "default_icon": { "16": "icon-16.png", "32": "icon-32.png" } }
   ```
   Hiện manifest **không có** `icons` → trình duyệt hiện biểu tượng mặc định. Ảnh 128×128 vẫn tải riêng lên trang cửa hàng (§1), nên đây là việc nên làm, có thể không bắt buộc để nộp (chưa kiểm chứng cửa hàng có từ chối gói không có icon hay không).
2. **`homepage_url`**: `"https://study-launcher-nine.vercel.app"` — nên đặt lúc build từ cùng `NEXT_PUBLIC_APP_URL` như `content_scripts` (sửa `scripts/build-extension.mjs`, dòng đang thay `launcher.invalid`).
3. **`short_name`**: `"Study Launcher"` (tùy chọn).
4. **Mô tả ngắn** (`description`, ≤ 132 ký tự) — đề xuất: `Học trước, web sau: giờ học chỉ mở trang học bố mẹ cho phép; xong bài tập + kỹ năng thì web mở giờ tự do.` (105 ký tự). Muốn cửa hàng có cả bản tiếng Anh thì dùng `default_locale: "vi"` + `_locales/vi/messages.json` + `_locales/en/messages.json` (EN: `Study first, web later: during study time the browser opens only the study sites your family allowed in Study Launcher.` — 119 ký tự).
5. **`launcher.invalid`**: giữ như hiện tại. Gói tải lên cửa hàng **phải** là gói build từ bản production (manifest trong zip có `"matches": ["https://study-launcher-nine.vercel.app/*"]`, không còn `launcher.invalid`). Không cần sửa code, chỉ cần kiểm tra trước khi nộp (SETUP C4).
6. **Không cần `key`**: cửa hàng tự cấp ID; ứng dụng không dùng ID extension ở đâu (ghép máy qua content script). Thêm `key` chỉ để giữ ID của bản cài tay — không cần.
7. **Không bỏ quyền nào**: cả 6 quyền đang được dùng (bảng §3). `chrome.permissions.contains`, `chrome.action`, `chrome.runtime.setUninstallURL` không cần khai báo quyền.
8. **Số phiên bản**: mỗi lần nộp bản mới phải tăng `version` (vd 0.3.4 → 0.3.5). Bản đầu tiên lên cửa hàng nên là bản có biểu tượng (mục 1).
