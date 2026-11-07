---
Project: Study Launcher (tên tạm) — trang chủ học tập + khóa web có điều kiện
Owner: Phụ huynh
Cập nhật: 05/10/2026 — v0.2 (DRAFT, chờ review → commit)
Phase: 1 Spec ✅ · 2 Design ✅ (mockup v0.1 + docs/DESIGN.md) → chuẩn bị chuyển Claude Code
Bản sao trong repo: `docs/SPEC.md` (repo `study-launcher`)
---

# PJ_LAUNCHER — v0.2

## 1. Mục tiêu

Khi con mở máy, trang đầu tiên là **Launcher**: chọn profile → thấy **Bài tập hôm nay** và **Kỹ năng hôm nay**. Máy **chỉ mở được trang học** cho đến khi con làm xong; xong thì có **45 phút giờ tự do**, hết giờ khóa lại.

**Mục tiêu dài hạn (mới ở v0.1):** hình thành **thói quen tự giác**, không phải khóa mãi. Khóa là giàn giáo — con giữ nhịp tốt thì app **giảm dần** kiểm soát (chế độ Tin tưởng, mục 7).

Vai trò trong hub:

| App | Vai trò |
|---|---|
| **Launcher** (dự án này) | Cổng vào mỗi ngày: hiển thị việc, phiên học, điều khiển khóa/mở web |
| App Toán (prod) | Bài bổ sung Toán — Launcher chỉ deep-link |
| App Văn / App Anh | Chưa có — slot linh hoạt (link app ngoài hoặc "đang xây") |
| SkillGrow (prototype) | v1: kỹ năng lấy từ **danh sách cố định theo thứ trong tuần** do phụ huynh soạn (mỗi dòng có thể deep-link sang SkillGrow); tích hợp đọc kế hoạch SkillGrow để M5 |

## 2. Nguyên tắc thiết kế (mới ở v0.1)

| Nguyên tắc | Vì sao |
|---|---|
| **Mở khóa theo thời gian học thật, không theo dấu tick** | Tick 7 ô mất 10 giây — v0 vô tình thưởng cho việc tick. Thời gian tập trung khó giả hơn (bài học từ Forest). |
| **Tin nhưng có kiểm** | Con chụp ảnh bài đã làm, máy mở ngay; phụ huynh xem gộp buổi tối (bài học từ Joon, bỏ bước chờ duyệt vì bố mẹ đi làm). |
| **Luật do cả nhà đặt** | Nghiên cứu UCF (2018, 215 cặp phụ huynh–teen): app kiểm soát áp từ trên xuống bị teen phản kháng, kém hiệu quả hơn sự tham gia của cha mẹ. |
| **Kiểm soát giảm dần** | Kiểm soát bên ngoài không giảm thì không chuyển thành động lực bên trong; mục tiêu là con tự giác khi lên lớp 10. |
| **Linh hoạt, không "tất cả hoặc không"** | Trượt 1 ngày không được làm sụp cả hệ (bài học streak của Duolingo; nhất quán với quyết định SkillGrow dùng mục tiêu tuần). |
| **Màn hình không phải "giải thưởng"** | Gọi là "giờ tự do", không phải phần thưởng (nghiên cứu ĐH Guelph 2019: dùng màn hình làm phần thưởng → trẻ dùng nhiều hơn; mẫu là trẻ nhỏ, tham khảo). |

## 2.5 User stories

**Con (Nguyên, An)**
- Là con, tôi muốn mở máy là thấy ngay việc hôm nay, để không phải tự nhớ cô giao gì.
- Là con, tôi muốn biết còn bao nhiêu việc nữa thì tới giờ tự do, để tự sắp xếp.
- Là con, tôi muốn xin mở một trang cần cho bài mà không phải gọi điện cho bố mẹ.
- Là con, tôi muốn có thẻ miễn khi quá mệt mà không bị coi là "trượt".
- Là con, tôi muốn thấy mình còn bao xa tới chế độ Tin tưởng, để có mục tiêu tự giác.

**Phụ huynh**
- Là phụ huynh, tôi muốn giao bài cho mỗi con trong ≤ 2 phút trên điện thoại.
- Là phụ huynh, tôi muốn duyệt yêu cầu mở trang bằng 1 chạm từ thông báo, để con không bị kẹt lâu.
- Là phụ huynh, tôi muốn xem gộp ảnh bài + thời gian học của cả ngày trong ≤ 5 phút buổi tối.
- Là phụ huynh, tôi muốn mở khóa / khóa / cộng phút bằng PIN ngay trên máy con khi cần.
- Là phụ huynh, tôi muốn chỉnh luật (số phút, danh sách trang, ngưỡng, số thẻ miễn) theo Thỏa thuận gia đình mà không cần sửa code.
- Là phụ huynh, tôi muốn bật ngày ốm / ngày thi / ngày lễ để hệ thống không ép con vô lý.

## 2.6 Tiêu chí nghiệm thu (acceptance criteria)

**Con — màn Hôm nay**
- Phần 1 gồm: bài trên lớp **chưa xong có hạn ≤ ngày mai** (kể cả quá hạn) + bài bổ sung theo lịch thứ trong tuần. Slot "đang xây" hiện nhưng không tính.
- *(S2c, chốt 17/10/2026)* Con thấy **mọi** bài trên lớp chưa xong, chia 2 nhóm: **"Phải xong hôm nay"** (quá hạn + hạn ≤ hôm nay + `homework_lookahead_days`, bắt buộc từng bài) và **"Sắp tới — làm trước được"** (không bắt buộc từng bài). Ngày **không có bài đến hạn** → con phải tự chọn xong ít nhất `homework_min_upcoming` bài (mặc định 1, sửa ở Cài đặt; 0 = tắt) trong "Sắp tới".
- *(S2c)* Bài xong khi còn **≥ 2 ngày** tới hạn được dấu **★ sớm**; màn con hiện "Tuần này làm sớm N bài", Xem gộp của bố mẹ cũng hiện. Chỉ để ghi nhận — **không** đổi trạng thái khóa/mở, không cộng điểm, không tự tính vào Tin tưởng.
- Bài bổ sung / kỹ năng: nút Xong bị khóa cho đến khi *giờ server − lúc bắt đầu ≥ số phút tối thiểu*. Gọi API Xong sớm hơn → bị từ chối, không ghi nhận.
- Bài trên lớp: bấm Xong bắt buộc tải ≥ 1 ảnh bài đã làm thì việc mới thành "xong".
- Phần 2 không bấm Bắt đầu được cho đến khi Phần 1 xong **và** giờ nghỉ đã dùng hoặc bỏ qua.
- Xong Phần 2 → giờ tự do bắt đầu tại thời điểm server ghi nhận; đúng 45' sau chuyển sang KHÓA_HẾT_NGÀY.
- Nghỉ 10' và giờ tự do mỗi thứ tối đa 1 lần/ngày.
- Thẻ miễn chỉ dùng được khi còn thẻ trong tuần (tuần bắt đầu thứ Hai); dùng → giờ tự do bắt đầu ngay, ngày tính "đạt".
- 00:00 giờ Việt Nam: trạng thái về KHÓA_BÀI_TẬP; nghỉ/giờ tự do không cộng dồn sang ngày sau.
- Không hiển thị streak hay bảng xếp hạng; chỉ "7 ngày qua" + tiến độ Tin tưởng.
- *(S2e)* **Kế hoạch hôm nay** (tùy chọn): con đánh dấu + xếp thứ tự việc; thẻ "Việc tiếp theo" đi theo kế hoạch. Kế hoạch **chỉ để hiển thị** — không đổi khóa/mở, không bắt buộc việc nào. Nhắc nhẹ "Xếp bài hôm nay?" khi Phần 1 chưa xong và có ≥ 2 việc; "Để sau" ẩn đến hết ngày trên máy đó.
- *(S2e)* Con chọn **biểu tượng** trong bộ 24 biểu tượng có sẵn (server kiểm tra); màu vẫn do bố mẹ đặt.
- *(S2e)* **Tổng kết tuần**: mở từ **17:00 Chủ nhật đến hết Thứ Hai** (giờ server). Hiện: số ngày đạt /7, bài ★ sớm, thời gian học, số ngày theo đúng kế hoạch; con trả lời 2 câu (≤ 500 chữ mỗi câu). Bố mẹ đọc ở Xem gộp. Ngoài giờ mở, server từ chối.

**Khóa web (extension, laptop)**
- Đang khóa: điều hướng trang chính tới domain ngoài allowlist → chuyển sang trang khóa của Launcher, giữ URL gốc. Ảnh/script/CDN của trang được phép không bị chặn.
- *(Chốt 17/10/2026, S4b)* Đang khóa: **khung nhúng (iframe) của domain ngoài allowlist cũng bị chặn**, để không nhúng được trang bị chặn vào trong trang được phép. Trang học nhúng video/bài từ domain khác → bố mẹ thêm domain đó vào danh sách.
- *(S4b)* Cửa sổ ẩn danh/InPrivate: khi cài, bật "Cho phép trong InPrivate/ẩn danh"; trang Thiết bị cảnh báo nếu chưa bật.
- `*.translate.goog` luôn bị chặn khi khóa.
- Chuyển sang khóa (hết nghỉ / hết giờ tự do): trong ≤ 60 giây mọi tab đang mở ngoài allowlist chuyển sang trang khóa (không chỉ chặn tab mới).
- Đang mở (nghỉ / giờ tự do / chế độ Tin tưởng): không chặn gì.
- Không gọi được server > 2 phút → coi như khóa (fail-closed), dùng allowlist đã lưu gần nhất.
- Đổi đồng hồ máy không làm thay đổi bất kỳ thời lượng nào.

**Xin mở trang**
- Con gửi yêu cầu → phụ huynh nhận thông báo trên iPhone trong ≤ 1 phút.
- Phụ huynh chọn 15' / cả hôm nay / thêm vĩnh viễn → extension mở domain đó trong ≤ 60 giây; từ chối → con thấy kết quả trên trang khóa.
- Cùng một domain đang chờ duyệt → không tạo thêm yêu cầu mới.

**Phụ huynh — Giao bài**
- Chụp ảnh trên iPhone → ảnh được nén (cạnh dài ≤ 1600px) trước khi tải lên; 1 môn/ngày có thể nhiều ảnh.
- *(S2c)* Phụ huynh chỉ cần nhập **hạn chót**. Đính kèm được **ảnh, PDF, Word, Excel** — tối đa **6 tệp/bài, mỗi tệp ≤ 5 MB**. Con mở tệp qua chính trang Launcher (máy đang khóa vẫn mở được). Ảnh bằng chứng của con vẫn là ảnh.
- *(S2c)* Nút **Sửa** trên từng bài đã giao: đổi môn, hạn chót (hạn mới phải từ hôm nay; giữ nguyên hạn cũ được), ghi chú, thêm/bớt tệp. Tệp bị bỏ ra thì xóa khỏi kho.
- Giao xong → bài hiện trên máy con ở lần tải trang hoặc lần đồng bộ kế tiếp (≤ 1 phút).

**Phụ huynh — Xem gộp buổi tối**
- Liệt kê theo con: việc đã xong trong ngày, số phút, ảnh bằng chứng (bài trên lớp).
- Đánh dấu Đạt / Chưa đạt lưu ngay. "Chưa đạt" **chỉ ghi nhận** để nói chuyện, không thu hồi giờ tự do và không làm ngày mất "đạt" (v1).

**Phụ huynh — Override & cấu hình**
- PIN phụ huynh xác thực ở server, không lưu dạng rõ; sai 5 lần → khóa nhập 15 phút.
- Override (mở khóa thủ công / cộng phút / khóa ngay) có hiệu lực trên extension trong ≤ 60 giây và được ghi log.
- Mọi tham số (phút nghỉ, giờ tự do, phút tối thiểu, allowlist, ngưỡng Tin tưởng, số thẻ/tuần, giờ ngủ) sửa trong trang Cài đặt phụ huynh, có hiệu lực ở lần đọc trạng thái kế tiếp.
- Bật ngày ốm → mở hết cả ngày, ngày tính "đạt"; ngày thi / ngày lễ → phụ huynh tắt bớt việc của ngày đó.

## 3. Non-goals (v1 KHÔNG làm)

- Không chấm bài — phụ huynh chỉ xem ảnh, đánh dấu "chưa đạt" nếu cần.
- Không OCR / đọc chữ trong ảnh bài tập.
- Không xây engine học (Toán/Văn/Anh/kỹ năng) — chỉ deep-link.
- Không làm app native iOS; iPhone/iPad **không có mở khóa có điều kiện** ở v1.
- Không hỗ trợ macOS / Firefox / Safari desktop (2 laptop đều Windows).
- Không có điểm đổi giờ chơi, không bảng xếp hạng giữa 2 con (xem mục 15).

## 4. Người dùng & thiết bị

| | Nguyên | An | Phụ huynh |
|---|---|---|---|
| Laptop Windows | 1 máy riêng | 1 máy riêng | Quản trị (tài khoản admin) |
| iPhone + iPad | Có | Có | Upload ảnh, duyệt yêu cầu, xem tổng kết |
| Đăng nhập | Profile + PIN 4 số, nhớ theo thiết bị | như Nguyên | PIN phụ huynh riêng |

## 5. Luồng chính

### 5.0 Trước pilot — họp gia đình (~30 phút, 1 lần)
Cả nhà cùng chốt luật; con được quyền quyết: thứ tự 2 phần, có nghỉ 10' hay không, 1–2 trang muốn thêm vào allowlist, thời gian tối thiểu đề xuất cho từng môn. Ghi thành **Thỏa thuận gia đình**, cả nhà ký, dán cạnh bàn học. Luật trong app = luật trong thỏa thuận.

### 5.1 Phụ huynh (tối hôm trước / sáng sớm, ~2 phút/con)
1. Mở Launcher trên điện thoại → chế độ Phụ huynh (PIN).
2. **Giao bài**: chọn con → môn → **ngày phải nộp** → chụp/chọn ảnh → ghi chú (tùy chọn). Mỗi ảnh gắn 1 môn + 1 ngày nộp; 1 môn có thể nhiều ảnh.
3. **Duyệt** (khi có thông báo): yêu cầu mở trang của con.
4. **Xem gộp buổi tối**: ảnh bài con đã làm, thời gian học từng môn → đánh dấu "chưa đạt" nếu cần.

### 5.2 Con (mỗi lần mở máy)
1. Mở trình duyệt hoặc tab mới là vào Launcher (extension đảm nhiệm, không dựa vào cài đặt trang chủ) → chọn profile → PIN.
2. Dashboard hôm nay — mỗi việc đi qua 3 bước: **Bắt đầu → đồng hồ chạy → Xong**.
   - **Phần 1 — Bài tập**: (a) bài trên lớp theo từng môn (ảnh phụ huynh gửi) — bấm Xong thì **chụp ảnh bài đã làm**; (b) bài bổ sung Toán/Anh (deep-link). Môn "đang xây" không tính.
   - **Phần 2 — Kỹ năng**: hoạt động SkillGrow của ngày.
   - **Bài trên lớp**: không có thời gian tối thiểu (độ dài do cô giáo quyết định) — đồng hồ vẫn chạy để ghi nhận thời gian; làm xong bấm Xong và **chụp ảnh** làm bằng chứng.
   - **Bài bổ sung + kỹ năng**: nút **Xong** chỉ bật khi đồng hồ đạt **tối thiểu 20 phút** (phụ huynh chỉnh riêng được từng việc).
3. Xong Phần 1 → **nghỉ 10 phút** (tùy chọn, mở mọi trang) → khóa lại → Phần 2.
4. Xong Phần 2 → **giờ tự do 45 phút** → hết giờ khóa lại đến hết ngày.
5. Gặp trang bị khóa mà cần cho bài → bấm **"Xin mở trang này"** → phụ huynh duyệt trên điện thoại.

## 6. Máy trạng thái (laptop, chế độ Khóa)

```
🔒 KHÓA_BÀI_TẬP ──(xong Phần 1)──▶ ☕ NGHỈ 10' ──(hết giờ / "học tiếp")──▶ 🔒 KHÓA_KỸ_NĂNG
                                                                                │
                                                          (xong Phần 2)        ▼
🔒 KHÓA_HẾT_NGÀY ◀──(hết 45')── 🎮 GIỜ_TỰ_DO 45' ◀───────────────────────────────┘
```

| Trạng thái | Web được mở |
|---|---|
| Mọi trạng thái 🔒 | **Chỉ allowlist** (mục 9) + trang phụ huynh đã duyệt tạm |
| ☕ Nghỉ / 🎮 Giờ tự do | Tất cả |

Quy tắc:
- Reset 00:00 mỗi ngày → về KHÓA_BÀI_TẬP. **Mọi khoảng mở (nghỉ, giờ tự do, override) kết thúc muộn nhất 00:00.** Không có bài trên lớp → Phần 1 chỉ còn bài bổ sung; một phần **không có việc nào** thì coi như đã xong.
- Mỗi ngày **1 lần** nghỉ 10' và **1 lần** giờ tự do 45'.
- Mọi thời gian (đồng hồ việc, nghỉ, giờ tự do) tính theo **đồng hồ server** (chống chỉnh giờ máy).
- Mất mạng / không đọc được trạng thái → **mặc định khóa**.
- **Phụ huynh override**: PIN → mở khóa thủ công / cộng thêm phút / khóa ngay.
- **Tổng thời gian tối thiểu** chỉ tính bài bổ sung + kỹ năng: ngày điển hình 2 bổ sung + 2 kỹ năng = **80 phút** + thời gian làm bài trên lớp thực tế.

## 7. Chế độ Tin tưởng — kiểm soát giảm dần (mới)

| | Chế độ **Khóa** (mặc định) | Chế độ **Tin tưởng** |
|---|---|---|
| Web khi chưa xong việc | Chỉ allowlist | Mở hết |
| Launcher | Như mục 6 | Vẫn hiện việc + phiên học + nhắc nhở |
| Lên chế độ | — | ≥ 90% ngày đạt trong **3 tuần liên tiếp** + phụ huynh xác nhận |
| Về lại Khóa | Hệ thống **gợi ý** khi 1 tuần < 70% ngày đạt; **phụ huynh xác nhận** (hoặc tự chuyển bất kỳ lúc nào) | — |

- **"Ngày đạt"** = xong cả 2 phần trước giờ ngủ (phụ huynh đặt, vd 21:30), hoặc ngày dùng thẻ miễn, ngày ốm, ngày lễ. **Ngày thi không tự tính đạt** — con vẫn phải xong danh sách đã rút gọn.
- *Chốt 05/11/2026:* lên Tin tưởng khi **≥ 90% ngày đạt trong 3 tuần liên tiếp**. Ngưỡng gợi ý quay lại Khóa (**70%**) vẫn là giá trị đề xuất. Cả ba sửa được ở Luật trong nhà.
- Hiển thị tiến độ tới chế độ Tin tưởng ngay trên màn Hôm nay — đây là động lực chính với tuổi teen: **quyền tự quyết**, không phải giờ chơi.

## 8. Linh hoạt (mới)

| Cơ chế | Quy tắc |
|---|---|
| **Thẻ miễn** | 1 thẻ / tuần / con, con tự dùng → ngày đó tính là "đạt", mở giờ tự do mà không cần xong việc. Không cộng dồn sang tuần sau. |
| **Ngày đặc biệt** | Phụ huynh bật: ngày ốm (mở hết, tính đạt), ngày lễ (tắt bớt việc, tính đạt), ngày thi (tắt bớt việc, phải xong phần còn lại mới tính đạt). |
| **Nhìn theo tuần** | Màn Hôm nay hiện "7 ngày qua: x ngày đạt" (cuộn theo ngày) thay vì chuỗi ngày liên tục. Thẻ miễn tính theo tuần T2–CN. |

## 9. Allowlist khi khóa

| Nhóm | Ví dụ (phụ huynh sửa được) |
|---|---|
| Hệ thống | Launcher, đăng nhập (accounts.google.com nếu app dùng Google login) |
| App học nội bộ | App Toán (math-app-gules.vercel.app), SkillGrow |
| App học bên ngoài | **Tự thêm** theo slot đang cấu hình (vd Khan, Duolingo…) |
| Từ điển / dịch | translate.google.com, dictionary.cambridge.org, tratu.soha.vn |
| Trang con đề xuất | 1–2 trang chốt trong họp gia đình |

- KHÔNG mở: Google Search, YouTube.
- ⚠️ Chặn riêng `*.translate.goog` — Google Dịch có thể "dịch cả trang web" thành proxy để lách.
- Chỉ chặn **điều hướng trang chính**; ảnh/script/CDN của trang được phép vẫn tải bình thường.

### 9.1 Xin mở trang (mới)
- Trên màn khóa: nút **"Xin mở trang này"** + ô lý do ngắn (tùy chọn).
- Phụ huynh nhận thông báo trên iPhone → duyệt 1 chạm: **15 phút / cả hôm nay / thêm vĩnh viễn vào allowlist / từ chối**.
- Chưa duyệt sau 10 phút → con thấy "Bố mẹ chưa trả lời — làm việc khác trước nhé".

## 10. Bảo vệ trên Windows (cấu hình 1 lần/máy — checklist riêng)

| Lỗ hổng | Biện pháp |
|---|---|
| Gỡ/tắt extension | Cài **bắt buộc** qua policy `ExtensionInstallForcelist` (Chrome + Edge). Trên máy Windows không join domain, policy này chỉ nhận extension từ store → đăng extension **unlisted** lên Chrome Web Store (phí 1 lần 5 USD) + Edge Add-ons (miễn phí). |
| Tab ẩn danh / khách | Chrome: `IncognitoModeAvailability=1`, `BrowserGuestModeEnabled=0`, `BrowserAddPersonEnabled=0`; Edge: `InPrivateModeAvailability=1` + khóa tương đương |
| Tắt qua DevTools | `DeveloperToolsAvailability=2` |
| Cài trình duyệt khác | Con dùng **tài khoản Windows chuẩn** (không admin) + Microsoft Family Safety chặn app lạ. Rủi ro còn: trình duyệt portable → phụ huynh kiểm tra định kỳ. |
| Edge (không gỡ được) | Extension chạy được trên Edge → force-install cả Edge. |

## 11. iPhone / iPad (v1)

- Launcher chạy dạng PWA (Add to Home Screen) để xem việc, chạy phiên học, chụp ảnh bài.
- Phụ huynh nhận **thông báo đẩy** qua PWA đã cài trên Home Screen (iOS hỗ trợ Web Push cho PWA từ iOS 16.4 — cần kiểm tra lại trên máy thật).
- Khóa trên máy con: **Screen Time** cấu hình tĩnh — Downtime theo giờ + "Chỉ các trang web được phép". Không tự mở khi xong bài.

## 12. Mô hình dữ liệu (dự kiến — bản chính thức: `docs/DESIGN.md` §4)

| Bảng | Trường chính |
|---|---|
| profiles | id, name, role (child/parent), pin_hash, bedtime |
| devices | id, profile_id, platform, last_seen, push_subscription |
| homework_items | id, child_id, subject, due_date, photo_paths[], note, status |
| app_slots | id, child_id, subject, kind (internal/external/placeholder), url, label |
| task_rules | child_id, subject/kind, min_minutes |
| **focus_sessions** | id, child_id, task_ref, started_at, ended_at, minutes |
| **proof_photos** | id, child_id, homework_item_id, photo_path, parent_verdict (ok/chưa đạt/null), note |
| day_sessions | child_id, date, state, part1_done_at, break_start, part2_done_at, unlock_start, day_type (normal/sick/exam/holiday), pass_used, achieved |
| **unlock_requests** | id, child_id, url, reason, created_at, decision (15m/today/permanent/deny), decided_at |
| **trust_state** | child_id, mode (lock/trust), since, weekly_scores[] |
| allowlist | id, child_id (null = dùng chung), domain, group, expires_at |
| task_templates | Bài bổ sung + kỹ năng theo thứ trong tuần (đã chốt) |

Ảnh lưu Supabase Storage (bucket private, URL ký có thời hạn).

## 13. Kiến trúc kỹ thuật (tóm tắt — chi tiết đã chốt: `docs/DESIGN.md`)

- **PWA**: Next.js + Supabase (Postgres, Auth, Storage) + Vercel — cùng stack App Toán/SkillGrow.
- **Web Push** cho phụ huynh (yêu cầu mở trang, nhắc xem gộp buổi tối).
- **Extension** (Manifest V3, Chrome + Edge): `declarativeNetRequest` chặn main_frame ngoài allowlist; hỏi trạng thái từ API mỗi 1 phút + đặt hẹn giờ đúng lúc hết giờ mở; đếm giờ theo server; chế độ Tin tưởng → tắt chặn; tab mới / mở trình duyệt → vào Launcher.
- Extension ghép với laptop 1 lần: trang Launcher (nhập PIN phụ huynh) gửi token thẳng sang extension, không cần gõ mã.

## 14. Milestones

| M | Nội dung | Nơi làm |
|---|---|---|
| M0 | Spec v0.1 + mockup | Claude.ai |
| **M0.5** | **Họp gia đình → Thỏa thuận gia đình** (chốt ngưỡng, thời gian tối thiểu, allowlist) | Cả nhà |
| M1 | PWA: profile/PIN, dashboard, giao bài, **phiên học có đồng hồ, ảnh bằng chứng**, thẻ miễn | Claude Code |
| M2 | Extension + máy trạng thái + allowlist + **xin mở trang + Web Push** + override phụ huynh | Claude Code |
| M3 | Checklist cấu hình Windows + cài 2 máy + checklist Screen Time iOS | Phụ huynh + Claude |
| M4 | Pilot 3 tuần (đủ 1 chu kỳ xét chế độ Tin tưởng) → ghi lỗi lách, chỉnh ngưỡng | Gia đình |
| M5 | **Chế độ Tin tưởng** bật thật + tích hợp SkillGrow / App Toán | Claude Code |

## 15. Backlog & những điều tránh

| Nhóm | Mục | Ghi chú |
|---|---|---|
| v1.1 | Gọi 45' là "giờ tự do" + gợi ý hoạt động không màn hình | Đổi chữ đã làm ở v0.1; phần gợi ý để v1.1 |
| v1.1 | Con tự lập kế hoạch 1 phút: sắp thứ tự + ước lượng thời gian, cuối ngày so với thực tế | Rèn chức năng điều hành (trụ cột E SkillGrow) |
| v2 | Giao diện theo tuổi: An (cây/thú ảo), Nguyên (đếm ngược thi vào 10) | Sau pilot |
| v2 | Lịch nhiệt / "khu rừng" tích lũy cả tháng | Sau pilot |
| v2 | Tổng kết Chủ nhật 10' từ dữ liệu app | Có thể làm thủ công ngay từ pilot |
| **Tránh** | Điểm đổi lấy thêm giờ chơi | Biến việc học thành giao dịch |
| **Tránh** | Bảng xếp hạng giữa 2 con | So sánh anh em, lệch 3 tuổi |
| **Tránh** | Khóa iPhone/iPad theo điều kiện ở v1 | Chi phí app native quá lớn |

## 16. Câu hỏi mở (cần phụ huynh chốt — nhiều câu chốt luôn trong họp gia đình)

1. ~~Bài bổ sung~~ → đã chốt: **bắt buộc**, tính vào Phần 1.
2. ~~Nguồn kỹ năng v1~~ → đã chốt: **danh sách cố định theo thứ trong tuần**, phụ huynh soạn 1 lần.
3. ~~Thời gian tối thiểu~~ → đã chốt: 20' cho bài bổ sung + kỹ năng; bài trên lớp không có tối thiểu.
4. **Ngưỡng chế độ Tin tưởng** (đề xuất 90% / 3 tuần / về lại khi < 70%) và **giờ ngủ** tính "ngày đạt"?
5. Cuối tuần / ngày lễ có luật khác không?
6. ~~Supabase~~ → đã chốt: **project Supabase riêng**, **repo GitHub riêng** `study-launcher`.
7. Giữ ảnh bài tập + ảnh bằng chứng bao lâu?
8. Tên hiển thị chính thức (tạm: "Study Launcher"; repo `study-launcher`).
9. *(mới, mặc định đã ghi ở §2.6 — xác nhận lại)* Bài trên lớp hiện khi **hạn ≤ ngày mai**; "Chưa đạt" chỉ ghi nhận, không làm mất "ngày đạt".

## 17. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Con bật đồng hồ rồi làm việc khác | Ảnh bằng chứng + phụ huynh xem gộp; chấp nhận một phần — không có hệ thống nào chống lách 100% |
| Bài trên lớp làm ẩu cho nhanh (không có tối thiểu) | Ảnh bài đã làm + phụ huynh đánh dấu "chưa đạt" buổi tối |
| Allowlist thiếu trang → bị kẹt | Xin mở trang + override PIN |
| Phụ huynh không kịp duyệt / không xem gộp | Duyệt 1 chạm; nếu bỏ xem gộp > 1 tuần, cơ chế "tin nhưng có kiểm" mất tác dụng → cam kết trong Thỏa thuận gia đình |
| Push iOS không ổn định | Kiểm tra sớm ở M2; dự phòng: con nhắn Zalo |
| Con lách bằng iPhone/iPad | Screen Time tĩnh; chấp nhận ở v1 |
| Chi phí | Supabase/Vercel free tier đủ cho 2 con; 5 USD Chrome Web Store 1 lần |

## 18. Run/decision log

| Ngày | Quyết định |
|---|---|
| 05/10/2026 | Khóa desktop = Chrome/Edge extension, chế độ **allowlist** (chặn tất cả trừ trang học) |
| 05/10/2026 | Allowlist khi khóa: app học + **chỉ từ điển/dịch** (không Google Search, không YouTube) |
| 05/10/2026 | Sau khi xong: **60 phút** rồi khóa lại; nghỉ 10' giữa 2 phần |
| 05/10/2026 | Bài trên lớp: phụ huynh upload **1 ảnh / môn / ngày**, tag môn + ngày nộp |
| 05/10/2026 | App môn: slot linh hoạt (app ngoài / "đang xây" / app nội bộ) |
| 05/10/2026 | Laptop Windows; iPhone/iPad dùng Screen Time tĩnh, không mở khóa có điều kiện ở v1 |
| 05/10/2026 | v0.1 sau brainstorm best practice — đưa vào v1: **phiên học có đồng hồ + thời gian tối thiểu** (thay tick trơn), **ảnh bằng chứng** (mở ngay, xem gộp tối), **xin mở trang** (duyệt 1 chạm), **họp gia đình + Thỏa thuận** trước pilot, **chế độ Tin tưởng** (kiểm soát giảm dần), **thẻ miễn 1/tuần + ngày đặc biệt** |
| 05/10/2026 | Để v1.1: gợi ý giờ tự do không màn hình, con tự lập kế hoạch. Tránh: điểm đổi giờ chơi, xếp hạng 2 con |
| 05/10/2026 | Pilot kéo dài **3 tuần** (đủ 1 chu kỳ xét chế độ Tin tưởng) |
| 05/10/2026 | Giờ tự do **45 phút** (thay 60'); thời gian tối thiểu **mặc định 20 phút / việc** |
| 05/10/2026 | Chọn phương án B: **20' tối thiểu chỉ cho bài bổ sung + kỹ năng**; bài trên lớp không có tối thiểu — độ dài do cô giáo quyết định, ảnh bài đã làm là bằng chứng. Tổng tối thiểu ngày điển hình: 80' (thay vì 160') |
| 05/10/2026 | Rà soát chéo bridge files (19 điểm) → chốt mặc định: phần không có việc = đã xong; mọi khoảng mở dừng ở 00:00; override mới nhất thắng; thẻ miễn không dùng được khi đã có giờ tự do; "Học tiếp" kết thúc nghỉ sớm; ngày thi không tự tính đạt; về lại Khóa cần phụ huynh xác nhận; extension mở Launcher ở tab mới thay cho chính sách trang chủ |
| 05/10/2026 | Chốt 4 điểm trước khi code: **Supabase project riêng**, **repo riêng `study-launcher`**, **bài bổ sung bắt buộc**, **kỹ năng v1 = danh sách cố định theo thứ**. Thêm user stories + tiêu chí nghiệm thu (§2.5–2.6) → v0.2; tạo bridge files `CLAUDE.md`, `docs/SPEC.md`, `docs/DESIGN.md`, `docs/SETUP.md` |
| 13/10/2026 | Nối Supabase ↔ GitHub, chỉ bật **Deploy to production** (SQL trong `supabase/migrations/` tự chạy khi phụ huynh merge vào `main`); **Automatic branching tắt** (gói Free không có, và tính tiền theo giờ khi nâng cấp). Thay cho quy ước cũ "phụ huynh dán SQL". Cấm sửa tay trong SQL Editor. Project tắt "Automatically expose new tables" nên mọi bảng phải `grant` rõ ràng |
| 13/10/2026 | Sao lưu hằng tuần: gói Free của Supabase không có sao lưu tự động → dùng GitHub Actions, **mã hóa bằng mật khẩu riêng trước khi lưu** (GitHub chỉ giữ file đã mã hóa). Ảnh không được sao lưu |
| 14/10/2026 | Chốt 3 điểm khóa/mở (PR #4): (1) **Phần 1 rỗng chưa phải "xong hẳn"** — ngày vẫn đi tiếp (mời nghỉ → Phần 2) nhưng bài bố mẹ giao trước khi con bấm nghỉ/bỏ qua nghỉ vẫn **khóa lại**; (2) **override mới nhất thay hẳn các override cũ** trong ngày — hết hạn thì về luồng thường, không bật lại override cũ; (3) xong Phần 2 lúc **bố mẹ đang khóa tay** → giờ tự do **hoãn**, bắt đầu khi hết khóa (vẫn dừng ở 00:00). Thêm nút sửa tên/lớp/màu + đặt lại mật khẩu tài khoản con (PR #5) |
| 15/10/2026 | Chốt 2 điểm (PR #6): **mỗi lúc chỉ 1 việc có giờ tối thiểu** (bài bổ sung / kỹ năng) được chạy — xong việc này mới bắt đầu việc khác, để 1 lần chờ 20' không tính cho 2 việc; bài trên lớp không giới hạn. **Không dùng thẻ miễn khi bố mẹ đang khóa tay** (ẩn nút). Mỗi ảnh bằng chứng chỉ dùng cho 1 bài |
| 17/10/2026 | Chốt S2c — **quản lý bài trên lớp kiểu C**: bố mẹ chỉ nhập hạn chót; con thấy mọi bài chưa xong trong 2 nhóm "Phải xong hôm nay" / "Sắp tới"; ngày không có bài đến hạn phải tự chọn ≥ 1 bài sắp tới (số này sửa ở Cài đặt). **★ sớm** = xong khi còn ≥ 2 ngày tới hạn. Đính kèm ảnh + PDF + Word/Excel, **5 MB/tệp, tối đa 6 tệp**; chỉ bố mẹ tải đề, con vẫn nộp ảnh. Có nút Sửa bài |
| 17/10/2026 | Động lực: **không dùng điểm** (giữ §15). Thay bằng con tự lập kế hoạch (tùy chọn, có nhắc nhẹ), ghi nhận ★ sớm (bố mẹ xem, **không tự tính** vào Tin tưởng), phần thưởng thật = quyền tự quản. Con được **chọn biểu tượng**, màu giữ như bố mẹ đặt. **Tổng kết tuần tối Chủ nhật** (số liệu + 2 câu con tự trả lời). Màn mới + lập kế hoạch + tổng kết tuần làm ở S2d (tài liệu "Động lực & UI màn Hôm nay", mockup https://claude.ai/artifact/2DvaSkgPVLEEVC1bntW8MX) |
| 17/10/2026 | Chốt S2d/S2e: chia 2 PR — **S2d** màn Hôm nay mới (đầu trang theo màu của con + vòng tiến độ, thẻ "Việc tiếp theo", **chế độ tập trung** đồng hồ lớn, chữ "Giờ học" thay "Khóa", ngày trước khi dùng app hiện "–") **không đụng DB**; **S2e** lập kế hoạch + biểu tượng con chọn (**bộ ~24 biểu tượng có sẵn**, không tải ảnh) + **Tổng kết tuần** (2 câu: "Tuần này con làm tốt điều gì?" / "Tuần sau con muốn đổi 1 điều gì?", **bố mẹ xem được** ở Xem gộp; hiện **CN 17:00 → hết Thứ Hai**) — có SQL |
| 17/10/2026 | Chốt S4b: đồng ý **4 cách chặt** của lõi extension (mở lại trình duyệt khóa tới lần hỏi đầu; hết giờ mở → khóa ngay theo hẹn giờ; 2 lần hỏi lỗi liên tiếp → khóa; chặn `file:` khi khóa). **Ghép máy bằng mã 6 số** từ iPhone bố mẹ (thay PIN). Dùng **cả Edge và Chrome**. Chạy thử bằng **cài tay (chế độ nhà phát triển)** trên 1 laptop vài ngày trước khi đăng cửa hàng |
| 17/10/2026 | Sau review bảo mật S4b: **chặn khung nhúng ngoài danh sách khi khóa**; **cửa sổ ẩn danh**: bật cho phép khi cài + trang Thiết bị cảnh báo. Thêm: hỏi máy chủ quá 10 giây = lỗi (không bao giờ "kẹt mở"), token bị gỡ → khóa ngay, cài luật lỗi → chỉ mở Launcher, tab mới mở Hôm nay bằng cách khác (trình duyệt hay đề nghị "hoàn tác" trang tab mới) |
| 18/10/2026 | Link học khi máy đang khóa (Meet, NotebookLM, link giáo viên/gia sư): làm **trang "Trang học" cho bố mẹ** (thêm/bỏ domain, cho 1 con hoặc cả 2, luôn luôn hoặc đến hết hôm nay; Google Search/YouTube không thêm vĩnh viễn được) + **"Xin mở trang"** trên trang chặn (bố mẹ chọn 15 phút / hết hôm nay / luôn cho phép / không). Báo bố mẹ bằng **số đỏ trên menu, tự làm mới 30 giây**; thông báo đẩy làm sau. Đăng nhập xong quay lại đúng trang đang mở (vd /ghep-may) |
| 18/10/2026 | Zalo (con chat với gia sư): bố mẹ **luôn mở cả zalo.me** (chấp nhận con chat được cả với bạn trong giờ học). Khi con xin một trang con (vd `redirect.zalo.me`), nút duyệt có thêm **"Luôn cho phép cả <tên miền gốc>"**; máy chủ tự tính tên miền gốc, không bao giờ gợi ý google.com, youtube.com, vercel.app, com.vn… |
| 19/10/2026 | Rà soát UI phụ huynh (canvas "Phụ huynh – UI mới"): **menu 4 mục ở đáy** (Hôm nay · Giao bài · Xin mở · Thêm); trang chủ **Hôm nay** = "Cần bố mẹ làm" + thẻ từng con (Quá hạn / Phải xong hôm nay / Sắp tới tối đa 3, nhãn chữ cho từng việc); **Ngày của con** thay Xem gộp (chọn con, lùi ngày ≤ 30, ảnh chờ xem + Đạt/Chưa đạt to); **Mở/khóa thành tấm trượt** (chọn việc → thời gian → 1 nút ghi rõ hành động, bỏ hộp xác nhận). Làm 3 PR: (1) trang chủ + Ngày của con + Mở/khóa, (2) Giao bài, (3) Lịch việc theo tuần + Thêm. Không đổi luật khóa/mở |
| 19/10/2026 | Rà soát UI của con: (1) **nộp ảnh bài** thành tấm "Nộp ảnh bài" — chọn **nhiều ảnh** (tối đa 6), xem lại, bỏ ảnh mờ, rồi 1 nút "Nộp N ảnh và xong"; trên laptop có **mã QR mở đúng bài đó trên điện thoại** (laptop tự cập nhật); bài trên lớp có thêm nút **"Xong rồi · nộp ảnh"** (làm trong vở rồi thì không phải qua màn đếm giờ). (2) Con thấy **"Bố mẹ đã xem ✓"**, không thấy Đạt/Chưa đạt. (3) **Đăng nhập bằng PIN 6 số** trên máy đã nhớ (PR riêng, có SQL). Làm trước phần còn lại của S3d |
| 19/10/2026 | **Bài trên lớp: ảnh HOẶC bố mẹ xác nhận trực tiếp.** Con không nộp được ảnh → bấm "Nhờ bố mẹ xem trực tiếp" → iPhone bố mẹ (tab Con nhờ, số đỏ + dòng ở "Cần bố mẹ làm") bấm **"Đã xem, cho xong"** (hoặc "Chưa được"). Xác nhận = bài xong + tự ghi **Đạt** (vẫn đổi được). **Không giới hạn** số lần (lần nào cũng cần bố mẹ bấm). Sửa luôn "nộp rồi mà đồng hồ vẫn chạy": ảnh cuối và "Xong" đi trong **cùng 1 lần gửi**; đã có ảnh mà chưa xong thì hiện nút **"Xong · đã gửi N ảnh"**; màn của con tự cập nhật mỗi 10 giây khi đang làm bài |
| 24/10/2026 | (1) **"Thêm nhanh"** ở Trang học: 1 chạm thêm cả nhóm trang cho cả 2 con, luôn luôn — **Google Meet**, **NotebookLM**, **Google Docs/Drive/Forms** (chỉ là gợi ý, thành dòng allowlist bình thường, bố mẹ gỡ được). (2) **File trên máy**: công tắc ở Luật trong nhà (mặc định TẮT) cho mở file **.html / .htm / .pdf ở bất kỳ thư mục** trong giờ học; link trong file dẫn ra web vẫn theo allowlist (extension 0.3). (3) **Phát hiện phần trang bị chặn**: extension báo khi một khung bên trong trang học bị chặn → hiện ở tab Con nhờ để bố mẹ bấm thêm |
| 24/10/2026 | **Vá bảo mật sau audit độc lập** (phụ huynh chọn qua pop-up): (1) **Đặt lại mật khẩu con = đăng xuất con khỏi mọi máy** + quên mọi trình duyệt nhớ PIN; thêm nút **"Đăng xuất con khỏi mọi máy"** ở Thêm › Các con; (2) trang đăng nhập có **"Không phải máy của con? Quên máy này"**; (3) đường dẫn quay lại sau đăng nhập không thể dẫn ra trang ngoài; (4) Google Search / YouTube **mọi tên miền quốc gia** (google.co.uk, google.de…) không thêm vào danh sách trang học được. Không đổi luật khóa/mở |
| 17/10/2026 | Thứ tự tiếp theo (phụ huynh chọn): **S3c-1 mở/khóa từ iPhone bố mẹ** (lối thoát khi kẹt) → **S4b nối extension** (khóa thật) → **S3d ngày đặc biệt + allowlist** → S3b/S3c-2 PIN trên máy con → S3e |
| 15/10/2026 | Chốt kế hoạch S3: chia S3a (xem gộp) → S3b (PIN phụ huynh **6 số**) → S3c (mở/khóa/cộng phút bằng tay **từ cả máy con bằng PIN lẫn iPhone phụ huynh**) → S3d (ngày đặc biệt, gợi ý Tin tưởng, sửa allowlist, nhật ký) → S3e (**tự xóa ảnh** quá `photo_retention_days`, phụ huynh đồng ý). **Màn chọn hồ sơ + PIN 4 số của con để sau v1** (mỗi laptop đăng nhập sẵn tài khoản của 1 con) |
| 01/11/2026 | **Thông báo đẩy (S5)**: báo iPhone bố mẹ khi con **Xin mở trang** và **Nhờ bố mẹ xem trực tiếp**; **21:45** nhắc xem gộp chỉ khi còn bài chưa xem hoặc việc con đang nhờ. Không báo cho khung bị chặn tự phát hiện. **Không** có giờ yên lặng. |
| 04/11/2026 | **Chế độ Tin tưởng + Nhật ký (S3d, PR `feature/s3d-tin-tuong`)**: gợi ý hiện trên thẻ của con ở Hôm nay (bố mẹ bấm "Chuyển…" hoặc "Để sau"), công tắc tay có xác nhận ở Thêm › Các con, trang Thêm › Nhật ký (lọc theo con + nhóm). *Phụ huynh chốt 05/11/2026:* sau khi bố mẹ đã chuyển hoặc bấm "Để sau" trong tuần, **gợi ý ẩn đến thứ Hai tuần sau** (gợi ý chỉ tính từ tuần đã trọn nên trong tuần không đổi) |
| 05/11/2026 | **Chế độ Tin tưởng**: phụ huynh chốt ngưỡng lên **90% ngày đạt / 3 tuần liên tiếp** (trả lời §16 Q4 phần lên chế độ; 70% về Khóa vẫn đề xuất). Gợi ý ẩn đến thứ Hai tuần sau khi bố mẹ đã chuyển hoặc bấm "Để sau" (chốt). |
| 07/11/2026 | **Góc bình yên bỏ PIN riêng** (theo ý kiến của 2 con: "nơi giải tỏa cảm xúc con không muốn hằng ngày vào lại phải nhập mã"). Thay quyết định Q1 (01/11): đăng nhập tài khoản của con là vào được; **không tự khóa** khi không chạm. Hệ quả nói rõ với con trong "Ai thấy gì?": ai đăng nhập bằng tài khoản con cũng vào được. Giữ nguyên: giới hạn giờ học 10'/lượt (giờ máy chủ), không trang nào cho bố mẹ xem, tín hiệu không nội dung. Bỏ nút "Xóa PIN Góc bình yên" của bố mẹ. Cột / hàm PIN cũ trong database để nguyên, không dùng (xóa chỉ khi phụ huynh đồng ý). "Xóa hết của con" chuyển vào mục gập "Dữ liệu của con", phải gõ **XÓA**. Điểm mở cho S-BY2: khóa mã hóa chữ trên máy không còn lấy từ PIN Góc bình yên được |
| 07/11/2026 | **Góp ý của con** cho app (Thích / Chưa thích / Ý tưởng, ≤ 500 ký tự, ≤ 10/ngày): nút "💡 Góp ý" ở Hôm nay + link trong Góc bình yên; **không riêng tư** (con được báo "Bố mẹ sẽ đọc"); bố mẹ đọc ở Thêm › Góp ý của con, bấm "Đã đọc"; **không** push. **Nhắc buổi tối** chuyển sang Vercel Cron (tới trong 21:00–21:59; GitHub chạy trễ tới 03:34–04:13); app không gửi nhắc ngoài 20:00–23:00 |

## Nguồn tham khảo (tra 05/10/2026)

- UCF (2018) — Wisniewski & Ghosh, 215 cặp phụ huynh–teen: https://www.ucf.edu/news/apps-keep-children-safe-online-may-counterproductive/
- U. Guelph (2019), BMC Obesity — dùng màn hình làm phần thưởng/hình phạt (trẻ 1,5–5 tuổi): https://www.newswise.com/articles/controlling-children-s-behavior-with-screen-time-leads-to-more-screen-time-study-reveals
- Joon — cơ chế quest + phụ huynh duyệt: https://joonapp.io/user-manual/how-joon-works
- Forest — phiên tập trung, allowlist, extension: https://forestapp.cc/llms-full.txt

## 19. Work-product inventory

| Deliverable | Định dạng | Ghi chú |
|---|---|---|
| PJ_LAUNCHER (file này) | Markdown | Spec v0.2 — `claude/PJ_LAUNCHER.md`; bản sao `docs/SPEC.md` |
| Bridge files cho Claude Code | Markdown ×4 | `deliverables/study-launcher/` — `CLAUDE.md`, `docs/SPEC.md`, `docs/DESIGN.md`, `docs/SETUP.md` |
| Tài liệu "Động lực & UI màn Hôm nay" (nghiên cứu + review UI) | Claude Docs | https://claude.ai/artifact/C9A8ab2fpX1Mo5tjhFnRU2 |
| Mockup màn Hôm nay mới (6 trạng thái, cho S2d) | Artifact (Design canvas) | https://claude.ai/artifact/2DvaSkgPVLEEVC1bntW8MX |
| Mockup v0.1 — 5 màn (Hôm nay, Profile+PIN, Trang khóa + xin mở, Phụ huynh giao bài, Phụ huynh duyệt + xem gộp) | Artifact (Design canvas) | https://claude.ai/artifact/LmjBU4kbFczUKae43NvFNT |
