# Góc bình yên — Quy tắc & dữ liệu (Phase 1.5)

> **Trạng thái:** bản nháp 01/11/2026 · **chưa có code, chưa có SQL**.
> Các ô **⏳ Chờ bố mẹ** là chỗ phụ huynh cần chốt trước khi viết migration.
>
> Thiết kế trải nghiệm: hub `deliverables/study-launcher/GOC_BINH_YEN_DESIGN_v1.md` (v1.1).
> Bản mẫu bấm thử (không lưu dữ liệu): https://claude.ai/artifact/MqDzfE32PkVW3yyrPSrDVT

Góc bình yên là khu `/binh-yen` trong Study Launcher. Con dùng nó để gọi tên cảm xúc, làm dịu, và (nếu muốn) hiểu nguyên nhân.

Tài liệu này khác mọi phần khác của app ở một điểm: **dữ liệu là của con, bố mẹ không đọc được nội dung**.

---

## 1. Phạm vi

| Có trong v1 | Chưa làm (ghi để không ai tự thêm) |
|---|---|
| Chọn ô cảm xúc → chọn từ → mức độ (khó chịu) → gợi ý 3 hoạt động → làm → bài học | AI viết lời mentor, AI vẽ nhân vật |
| Card "Muốn hiểu vì sao?" (tùy chọn): chạm chọn nguyên nhân | Picrew / nhân vật riêng |
| Bảng điều tra (Nguyên) / Bàn pha chế (An): tự gom nguyên nhân | Mã hóa nhật ký bằng mật khẩu con (bản 2) |
| Phần thưởng: trang manga tự ghép, Tập của tuần (Nguyên); khu rừng sống (An) | Chuỗi ngày, điểm, xếp hạng, đổi giờ chơi (SPEC §15) |
| Nút "Con muốn nói chuyện" → tín hiệu cho bố mẹ | Bố mẹ xem báo cáo cảm xúc của con |
| Phát hiện câu nguy hiểm khi con gõ chữ → 111 + tín hiệu "cần được quan tâm" | |
| PIN mỗi lần vào + tự khóa sau 5 phút không dùng | |

---

## 2. Dữ liệu

### 2.1 Nguyên tắc

- **D1. Không có cột chữ tự do trên máy chủ.** Mọi thứ con *gõ* đều ở lại trên máy, gồm: câu kể chuyện, "Hỏi lại cái đầu", nhật ký tối, nguyên nhân tự đặt tên. Máy chủ chỉ lưu **mã cố định**, ví dụ `quad = 'red'`, `word_key = 'lo_lang'`, `cause_key = 'baitap'`.
- **D2. Thứ gì tính được thì không lưu.** Số loài cây, trang manga, Tập của tuần, Bảng điều tra đều tính lại từ check-in.
- **D3.** Liên kết bằng `id`. Mỗi bảng có `family_id`, `child_id`, `created_at`. Ngày tính theo giờ máy chủ, cột `local_date` theo `Asia/Ho_Chi_Minh`, giống phần còn lại của app.
- **D4.** Tham số gia đình (10 phút, 5 phút, bật/tắt) nằm trong `family_settings`, không ghi cứng trong code.

### 2.2 Bảng đề xuất

Chỉ là đề xuất, chưa phải SQL.

**`by_checkins`**: mỗi lần con đi hết một lượt.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid | |
| `family_id`, `child_id` | uuid | FK `(child_id, family_id)` → profiles, giống 0004/0005 |
| `local_date` | date | |
| `quad` | text enum | `red` · `yellow` · `blue` · `green` |
| `word_key` | text | Mã trong danh sách từ cố định (§5.0) |
| `intensity` | smallint null | 1–5; chỉ có khi cảm xúc khó chịu |
| `activity_key` | text null | Hoạt động con đã làm (mã cố định) |
| `cause_key` | text null | Mã nguyên nhân cố định, hoặc `custom` (tên con tự đặt ở lại trên máy) |
| `understood_at` | timestamptz null | Con đã mở card "Muốn hiểu vì sao?" và lưu |
| `reward_granted` | boolean | Lần này có mở phần thưởng không (R4) |
| `created_at` | timestamptz | |

**`by_signals`**: tín hiệu cho bố mẹ, **không có nội dung**.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id`, `family_id`, `child_id` | uuid | |
| `kind` | text enum | `want_talk` (con bấm) · `needs_care` (phát hiện câu nguy hiểm) |
| `created_at` | timestamptz | |
| `seen_at`, `seen_by` | timestamptz, uuid null | Bố mẹ bấm "Đã thấy" |

**`by_child_cards`** (An): thẻ "Do An thêm". Đây là nội dung con **muốn** bố mẹ cùng xem.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id`, `family_id`, `child_id` | uuid | |
| `title`, `fact` | text | Giới hạn 80 / 300 ký tự; chạy kiểm tra an toàn (R3) trước khi gửi |
| `status` | text enum | `pending` · `checked` (bố mẹ đã cùng xem) |
| `created_at`, `checked_at` | timestamptz | |

**Thêm cột vào `family_settings`** (đề xuất):

| Cột | Mặc định |
|---|---|
| `by_enabled` | `true` |
| `by_study_minutes` | `10` |
| `by_idle_lock_minutes` | `5` |
| `by_daily_rewards` | `1` |

**Dữ liệu chỉ ở trên máy con** (`localStorage`, có khóa theo `child_id`):
- câu kể chuyện;
- "Hỏi lại cái đầu";
- nhật ký tối;
- tên nguyên nhân tự đặt;
- bản nháp.

> Không có bảng cho "Viết rồi buông" hay nội dung "Hỏi lại cái đầu": các nội dung này không lưu ở đâu cả.

---

## 3. Ai được làm gì

Kiểm tra ở database (RLS), không chỉ ẩn nút. Con **không** ghi trực tiếp: mọi thao tác đi qua route máy chủ, giống phần còn lại của app (CLAUDE.md).

| Dữ liệu | Con (chính mình) | Anh/chị/em | Bố mẹ (trang web) | Route máy chủ |
|---|---|---|---|---|
| `by_checkins` | Xem ✅ · tạo/xóa qua route | ❌ | **❌ không có policy nào** | Ghi sau khi kiểm tra phiên PIN còn hạn |
| `by_signals` | Xem của mình | ❌ | Xem + bấm "Đã thấy" | Tạo khi con bấm hoặc khi phát hiện câu nguy hiểm |
| `by_child_cards` | Xem | ❌ | Xem + đánh dấu `checked` | Tạo khi An thêm |
| Dữ liệu trên máy | Có | Không thấy trong app (khóa theo `child_id` + PIN) | Không | Không bao giờ nhận |
| `family_settings.by_*` | Xem | — | Sửa | — |

**⚠️ Nói thật với con (bắt buộc ghi trong màn "🔒 Ai thấy gì?"):** "chặn bố mẹ" ở đây là chặn **trang web của bố mẹ**, không phải chặn tuyệt đối. Hiện có 3 đường bố mẹ *về kỹ thuật* vẫn đọc được `by_checkins`:

1. Bố mẹ là quản trị Supabase, nên xem được bảng trong trang quản trị.
2. Bố mẹ đặt lại được mật khẩu / PIN của con (DESIGN §2), rồi đăng nhập như con.
3. Bản sao lưu hằng tuần (A9) được mã hóa bằng cụm mật khẩu của bố mẹ.

Vì vậy, lời hứa với con là **lời hứa của bố mẹ**, có hệ thống hỗ trợ. Những gì riêng tư nhất (chữ con viết) thì **không bao giờ lên máy chủ** (D1). Chỉ mã hóa bằng mật khẩu con (bản 2) mới chặn được cả 3 đường trên.

---

## 4. Một lần ghé: các bước

```
[PIN] → chọn ô → chọn từ → (khó chịu: mức độ 1–5) → 3 gợi ý → làm hoạt động → XONG
                                                                      │
                                         lưu by_checkins, xét phần thưởng (R4)
                                                                      ▼
                                    Phần thưởng + bài học → (tùy chọn) "Muốn hiểu vì sao?"
                                                                      │
                                                     lưu cause_key, understood_at (cùng dòng)
```

- **Bỏ giữa chừng** (đóng tab, hết 5 phút tự khóa, đổi sang anh/chị/em) thì **không lưu gì**. Chỉ khi bấm "Xong" ở hoạt động mới tạo dòng mới.
- **"Con muốn nói chuyện"** bấm được ở mọi bước, kể cả màn chính. Bấm là tạo `by_signals(want_talk)` ngay, không cần đi hết lượt.
- **Câu nguy hiểm** bị phát hiện ở bất kỳ ô gõ chữ nào thì dừng lượt, hiện màn an toàn (R3).
- Con **xóa** một check-in của mình qua route. ⏳ Xóa hẳn hay xóa mềm: xem §7 (Q4).

---

## 5. Quy tắc + ví dụ chuẩn

> **Ví dụ chuẩn** là đáp án do bố mẹ xác nhận. Test sẽ kiểm theo đáp án này, không theo kết quả code đang chạy ra.
> Cột "Bản mẫu cho ra" được chạy từ code bản mẫu ngày 01/11. Dòng 🔴 là chỗ bản mẫu **sai**, cần sửa trước khi build.

### 5.0 Danh sách cố định

- **Ô:** đỏ (khó chịu, nhiều năng lượng) · lam (khó chịu, ít năng lượng) · vàng (dễ chịu, nhiều năng lượng) · lục (dễ chịu, ít năng lượng).
- **Từ:** khoảng 5–6 từ mỗi ô, như trong bản mẫu. Từ mới là việc của bố mẹ (dữ liệu, không phải code).
- **Nguyên nhân Nguyên:** trường lớp, bạn bè, gia đình, bài tập/kiểm tra, điện thoại/mạng xã hội, ngủ ít, đói/mệt, được vẽ, vận động, nghe nhạc, đọc truyện, thời tiết, + tự đặt.
- **Nguyên nhân An:** ở trường, bạn bè, gia đình, bài tập/kiểm tra, tivi/điện thoại, ngủ ít, đói/mệt, chơi ngoài trời, con vật, khám phá điều mới, vận động, với chị Nguyên, + tự đặt.

### R1. Gợi ý 3 hoạt động

**Định nghĩa:**
- Ô cảm xúc cho biết kiểu chăm sóc cần có. Từ cụ thể và nguyên nhân cộng thêm điểm cho từng kiểu.
- Chọn 3 hoạt động hợp nhất trong danh sách của con đó.
- **Khó chịu + mức 4–5 thì "Nhắn bố mẹ" luôn đứng đầu.**

| # | Ai | Cảm xúc · nguyên nhân · mức | Bản mẫu cho ra | Đề xuất đáp án | ⏳ |
|---|---|---|---|---|---|
| 1 | Nguyên | tức giận · điện thoại · 3 | Nhảy 1 bài, Thở cho dịu, Hỏi lại cái đầu | giữ nguyên | |
| 2 | Nguyên | lo lắng · bài tập · 2 | Hỏi lại cái đầu, Thở cho dịu, Nhảy 1 bài | giữ nguyên | |
| 3 | Nguyên | lo lắng · bài tập · **5** | **Nhắn bố mẹ**, Hỏi lại cái đầu, Thở cho dịu | giữ nguyên (biên: mức 5) | |
| 4 | Nguyên | cô đơn · bạn bè · 3 | Kể cho 1 người, Nhắn bố mẹ, Thở cho dịu | giữ nguyên | |
| 5 | Nguyên | mệt · ngủ ít · 2 | Thở cho dịu, Kể cho 1 người, Nhắn bố mẹ | 🟡 Thở, **Nghỉ/ngủ sớm** (hoạt động mới), Kể cho 1 người | |
| 6 | Nguyên | chán · (không chọn) · 2 | Kể cho 1 người, Nhắn bố mẹ, Thở cho dịu | 🔴 **Nhảy 1 bài**, Kể cho 1 người, Giữ khoảnh khắc ("chán" cần vận động/sáng tạo, không phải nhắn bố mẹ) | |
| 7 | Nguyên | tự hào · được vẽ | Kể cho 1 người, 3 bằng chứng, 3 điều biết ơn | 🟡 **Giữ khoảnh khắc**, Kể cho 1 người, 3 điều biết ơn | |
| 8 | An | tức giận · với chị Nguyên · **4** | **Nhắn bố mẹ**, Đo nhịp tim, Núi lửa trong lọ | giữ nguyên | |
| 9 | An | lo lắng · bài tập · 2 | Đo nhịp tim, Lọ bình tĩnh, Bong bóng chậm | giữ nguyên | |
| 10 | An | buồn · bạn bè · 3 | Kể cho 1 người, Nhắn bố mẹ, Quan sát bầu trời | giữ nguyên | |
| 11 | An | chán · tivi/điện thoại · 2 | Câu hỏi tò mò, Kể cho 1 người, Núi lửa trong lọ | giữ nguyên | |
| 12 | An | tò mò · khám phá | Câu hỏi tò mò, Kể cho 1 người, Quan sát bầu trời | giữ nguyên | |

### R2. Bài học "lần sau"

**Định nghĩa:**
- Câu 1 là bình thường hóa cảm xúc. Với cảm xúc dễ chịu thì là "đáng giữ".
- Câu 2 là bài học theo nguyên nhân.
- **Cảm xúc dễ chịu và khó chịu có bài học khác nhau cho cùng một nguyên nhân.**

| # | Cảm xúc · nguyên nhân | Bản mẫu cho ra (câu 2) | Đề xuất đáp án | ⏳ |
|---|---|---|---|---|
| 1 | lo lắng · bài tập | "Áp lực bài vở dễ làm đầu nghĩ 'mình không làm nổi'. Chia nhỏ ra…" | giữ nguyên | |
| 2 | mệt · ngủ ít | "Thiếu ngủ thì cảm xúc dễ bùng — không phải con tệ, là pin yếu…" | giữ nguyên | |
| 3 | **tự hào · bài tập** | 🔴 "Áp lực bài vở dễ làm đầu nghĩ 'mình không làm nổi'…" (sai: con đang tự hào) | "Con vừa thấy cố gắng của mình được đền đáp. Lần sau gặp bài khó, nhớ lại cảm giác hôm nay." | |
| 4 | **biết ơn · gia đình** | 🔴 "Người thân làm mình buồn nhất vì mình yêu họ nhất…" (sai) | "Biết ơn người thân mà nói ra thì cả hai cùng ấm lòng. Thử nói một câu cảm ơn hôm nay." | |
| 5 | bình yên · chơi ngoài trời | "Giữ lấy điều vừa mang lại cảm giác này — lần sau mệt mỏi, nhớ dành thời gian cho nó." | giữ nguyên (câu chung cho dễ chịu) | |
| 6 | chán · (không chọn) | "Gọi tên được cảm xúc và nguyên nhân là đã hiểu mình hơn một chút…" | giữ nguyên (câu chung cho khó chịu) | |

→ Khi build cần có bảng bài học **2 chiều** (nguyên nhân × dễ chịu/khó chịu) cho mọi nguyên nhân cố định. Claude soạn, bố mẹ duyệt cả bảng.

### R3. An toàn: phát hiện câu nguy hiểm

**Định nghĩa:**
- Chạy **trên máy con**, trên mọi ô gõ chữ (kể cả chữ không lưu) trước khi lưu hoặc gửi.
- Khớp thì dừng lượt và hiện màn an toàn: lời nhắn nhẹ + **Tổng đài 111** + nút "Con muốn nói chuyện với bố mẹ".
- Máy chủ nhận `needs_care`, **không kèm chữ**.

**Lỗi bản mẫu phát hiện khi làm ví dụ:**
- Bản mẫu bỏ dấu rồi tìm chuỗi con, nên "tự tử" → `tu tu`, khớp cả "**từ từ**" và "**tư tư**ởng".
- Hệ quả: báo nhầm rất thường xuyên, con thấy phiền và bố mẹ hoảng.

**Đề xuất 2 mức:**

| Mức | Khi nào | Con thấy | Bố mẹ nhận |
|---|---|---|---|
| **Mạnh** | Cụm rõ nghĩa, khớp nguyên từ: "muốn chết", "tự tử" (có dấu), "không muốn sống", "tự làm đau mình", "muon chet", "khong muon song"… | Màn an toàn | `needs_care` ngay |
| **Cần hỏi lại** | Cụm dễ trùng nghĩa: "tu tu" không dấu, "cắt tay", "chết mất"… | Câu hỏi nhẹ: "Con có đang nghĩ đến việc làm đau mình không?" → **Có**: như mức mạnh · **Không**: tiếp tục | Chỉ khi con chọn "Có" |

| # | Con gõ | Đáp án đề xuất | ⏳ |
|---|---|---|---|
| 1 | "con muốn chết" | Mạnh → 111 + `needs_care` | |
| 2 | "con muon chet" (không dấu) | Mạnh | |
| 3 | "từ từ thôi" | Không gì cả | |
| 4 | "ôn tư tưởng Hồ Chí Minh" | Không gì cả | |
| 5 | "bài khó quá chết mất" | Không gì cả (cách nói thường ngày) | |
| 6 | "cắt tay vào giấy" | Cần hỏi lại | |
| 7 | "tu tu" (không dấu, đứng riêng) | Cần hỏi lại | |
| 8 | "không ai cần mình" | Mạnh | |

Danh sách cụm từ: Claude soạn, bố mẹ duyệt, lưu dạng dữ liệu. Thêm test cho tiếng lóng thường gặp ở tuổi teen.

### R4. Phần thưởng (khu rừng, trang manga)

**Định nghĩa:**
- Mỗi lượt **hoàn thành** được tính.
- **Tối đa `by_daily_rewards` (mặc định 1) lần mở thưởng mỗi ngày**, để không "cày" Góc bình yên cho rừng to.
- **Phần thưởng không phụ thuộc cảm xúc nào**: buồn hay vui đều như nhau, để con không phải giả vui.

| # | Tình huống | Đáp án đề xuất | ⏳ |
|---|---|---|---|
| 1 | An hoàn thành lượt đầu tiên hôm nay | Mở 1 loài cây; `reward_granted = true` | |
| 2 | An hoàn thành lượt thứ 3 cùng ngày | Không mở thêm; lời nhắn "Hôm nay khu rừng đã có cây mới rồi, mai nhé" | |
| 3 | Nguyên chọn "buồn", làm xong | Trang manga hôm nay tạo như mọi ngày (không thưởng ít hơn) | |
| 4 | Lượt hoàn thành lúc 23:59, lượt tiếp 00:01 | Hai ngày khác nhau, cả hai đều được mở | |
| 5 | Bỏ giữa chừng | Không tính | |

### R5. Dùng trong giờ học

**Định nghĩa:**
- Mở được cả khi máy đang khóa, vì `/binh-yen` nằm trên tên miền Launcher (đã có trong allowlist) — **không đổi luật khóa**.
- Trong giờ học, mỗi lần ở tối đa `by_study_minutes` (10 phút). Hết giờ: lời nhắn "Quay lại học nhé, lúc nào cần thì vào lại", rồi tự về màn Hôm nay.
- **"Con muốn nói chuyện" và màn an toàn không bao giờ bị giới hạn giờ.**

| # | Tình huống | Đáp án đề xuất | ⏳ |
|---|---|---|---|
| 1 | Giờ học, con vào lúc 19:00 | Tự về Hôm nay lúc 19:10 | |
| 2 | Giờ tự do / đã xong bài | Không giới hạn | |
| 3 | Con vào lại ngay sau khi bị đẩy ra | ⏳ Q3 | |
| 4 | Đang ở màn an toàn khi hết 10 phút | Không đẩy ra | |

### R6. Khóa trên iPad dùng chung

- Phiên Góc bình yên **riêng**, ngắn hơn phiên đăng nhập thường: phải gõ PIN của con khi vào; sau `by_idle_lock_minutes` (5 phút) không chạm thì khóa lại.
- Dùng lại PIN 6 số có sẵn (0005), gồm cả luật sai 5 lần khóa 15 phút.
- Chọn sang tên anh/chị/em thì xóa mọi bản nháp chưa lưu trên màn hình.

---

## 6. Ca khó (edge cases)

| Ca | Xử lý đề xuất |
|---|---|
| iPad dùng chung, An mở nhầm tên chị | PIN chặn; không có PIN thì không vào được |
| Dữ liệu "chỉ trên máy" trên iPad dùng chung | Khóa theo `child_id`, app chỉ hiện của người đang mở PIN. ⏳ Q2: có cho lưu chữ trên iPad không |
| Mất mạng khi bấm "Xong" | Báo "chưa lưu được, thử lại"; không xếp hàng ngầm |
| Con xóa trình duyệt / đổi máy | Chữ riêng tư mất (nói trước với con); check-in trên máy chủ còn |
| Bấm "Xong" 2 lần (mạng chậm) | Route chống trùng: một mã lượt chỉ tạo 1 dòng |
| Bố mẹ đặt lại PIN của con | Ghi `audit_log` như hiện nay; ⏳ Q5: có báo cho con biết không |
| Con muốn xóa hết dữ liệu Góc bình yên | Nút "Xóa hết của con" qua route (⏳ Q4) |
| Con lớn lên / rời app | Xuất / xóa toàn bộ theo `child_id` |
| Push "con muốn nói chuyện" | Nội dung push chung chung: "Nguyên muốn nói chuyện với bố mẹ", không kèm cảm xúc |
| Bản sao lưu A9 chứa check-in | Đã mã hóa; ghi trong màn "Ai thấy gì?" (§3) |
| Từ / nguyên nhân bị bỏ khỏi danh sách sau này | Giữ mã cũ trong dữ liệu; danh sách hiển thị có cờ `retired` (không xóa) |

---

## 7. Quyết định khó đổi (⏳ chờ bố mẹ chốt trước khi viết SQL)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Bố mẹ có thấy **bất kỳ con số nào** về Góc bình yên không (vd "con ghé 5 lần tuần này")? | **Không.** Chỉ tín hiệu con chủ động gửi. Con số cũng là thông tin; nếu cần, để con tự kể ở Tổng kết tuần |
| Q2 | Trên **iPad dùng chung**, có lưu chữ con viết (câu kể, nhật ký) không? | **Không lưu trên iPad**; chỉ lưu trên laptop riêng của từng con. iPad vẫn dùng đủ, chữ viết xong là buông |
| Q3 | Giờ học: giới hạn số lần vào? | **Không giới hạn số lần**, chỉ 10'/lần; bố mẹ xem lại sau 2 tuần dùng thử |
| Q4 | Con xóa check-in: xóa hẳn hay giữ bản ẩn? | **Xóa hẳn** (riêng tư hơn lịch sử) |
| Q5 | Bố mẹ đặt lại PIN của con: có báo cho con không? | **Có**, lần mở Góc bình yên sau sẽ hiện "PIN vừa được bố mẹ đổi lúc …" (giữ lòng tin) |
| Q6 | Giữ check-in bao lâu? | **12 tháng** rồi tự xóa; con xóa sớm được |

---

## 8. Đề xuất ghi vào SPEC §18 (chưa ghi; chờ bố mẹ duyệt)

> | 01/11/2026 | **Góc bình yên** (khu `/binh-yen`, thiết kế: hub GOC_BINH_YEN_DESIGN v1.1, quy tắc: `docs/BINH_YEN.md`). Không bắt buộc, không gắn mở khóa; bố mẹ **không đọc** dữ liệu cảm xúc, chỉ nhận tín hiệu không nội dung. **Ngoại lệ có chủ ý với §15:** có đếm lượt ghé để mở loài cây / trang manga, nhưng tối đa 1 lần/ngày, không phụ thuộc cảm xúc, không đổi ra giờ chơi, không chuỗi ngày, không so sánh 2 con. "Khu rừng" và "giao diện theo tuổi" (v2 trong §15) làm sớm **chỉ trong Góc bình yên**. |

---

## 9. Cần thử trước (spike) — trước khi build lát đầu

| # | Thử gì | Đạt khi |
|---|---|---|
| S1 | Phiên PIN ngắn cho `/binh-yen` trên iPad Safari: tự khóa sau 5 phút, cả khi app nằm nền rồi mở lại | Mở lại sau 6 phút thì phải gõ PIN |
| S2 | Lưu chữ trên máy theo `child_id` (laptop Edge/Chrome), sống qua khởi động lại; xóa dữ liệu trình duyệt thì mất | Đúng như mô tả; con được báo trước |
| S3 | Bộ phát hiện an toàn 2 mức (R3) với ~50 câu thử: có dấu, không dấu, tiếng lóng, câu bình thường dễ trùng | Mọi câu mức "Mạnh" đều bắt được; câu bình thường không báo nhầm |

## 10. Lát build dự kiến (sau khi chốt §7 + spike)

- **S-BY1 (bộ khung):** PIN → chọn ô → từ → mức độ → 3 gợi ý (R1) → 1–2 hoạt động → Xong → lưu `by_checkins`; RLS bố mẹ không đọc; test RLS; nút "Con muốn nói chuyện" + `by_signals` + trang bố mẹ "Đã thấy". **Chưa có ô gõ chữ**, nên chưa cần R3.
- **S-BY2:** ô gõ chữ + R3 (cùng lát, bắt buộc) + dữ liệu chỉ trên máy.
- **S-BY3:** card hiểu nguyên nhân + bài học R2 + Bảng điều tra / Bàn pha chế.
- **S-BY4:** phần thưởng R4 (khu rừng An, trang manga Nguyên).
