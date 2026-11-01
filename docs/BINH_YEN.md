# Góc bình yên — Quy tắc & dữ liệu (Phase 1.5)

> **Trạng thái:** bản nháp 01/11/2026. **Chưa có code, chưa có SQL.**
> Bản này đã qua một vòng review độc lập; các điểm review sửa được đánh dấu *(review)*.
> Các câu hỏi ở §7 đã được phụ huynh chốt ngày 01/11/2026.
>
> Thiết kế trải nghiệm: hub `deliverables/study-launcher/GOC_BINH_YEN_DESIGN_v1.md` (v1.1).
> Bản mẫu bấm thử (không lưu dữ liệu): https://claude.ai/artifact/MqDzfE32PkVW3yyrPSrDVT

Góc bình yên là khu `/binh-yen` trong Study Launcher. Ở đây con gọi tên cảm xúc, làm dịu, và nếu muốn thì hiểu nguyên nhân.

Khác mọi phần còn lại của app: **dữ liệu ở đây là của con, bố mẹ không đọc nội dung.**

---

## 1. Phạm vi

| Có trong v1 | Chưa làm (ghi ra để không ai tự thêm) |
|---|---|
| Chọn ô cảm xúc → chọn từ → mức độ (khi khó chịu) → 3 gợi ý → làm → bài học | AI viết lời mentor, AI vẽ nhân vật |
| Card "Muốn hiểu vì sao?" (tùy chọn) | Picrew / nhân vật riêng |
| Bảng điều tra (Nguyên) / Bàn pha chế (An) | Bố mẹ xem báo cáo cảm xúc của con |
| Trang manga, Tập của tuần (Nguyên); khu rừng sống (An) | Chuỗi ngày, điểm, xếp hạng, đổi giờ chơi (SPEC §15) |
| "Con muốn nói chuyện" → tín hiệu cho bố mẹ | Nhúng nhạc / video bên ngoài (YouTube, Spotify…) *(review)* |
| Phát hiện câu nguy hiểm → 111 / 115 + tín hiệu "cần được quan tâm" | Công cụ theo dõi bên thứ ba (analytics, ghi màn hình, Sentry…) trên `/binh-yen` *(review)* |
| **PIN Góc bình yên riêng do con tự đặt** + tự khóa sau 5 phút *(review, Q1)* | |

**Mặc định tắt:** `by_enabled = false`. Merge PR không tự bật cho con. Bố mẹ bật khi đã nói chuyện với con *(review)*.

---

## 2. Dữ liệu

### 2.1 Nguyên tắc

- **D1. Chữ con gõ không lên máy chủ.** Gồm câu kể chuyện, "Hỏi lại cái đầu", nhật ký tối, tên nguyên nhân tự đặt. Máy chủ chỉ lưu **mã cố định** (`quad = 'red'`, `word_key = 'lo_lang'`, `cause_key = 'baitap'`).
  - **Ngoại lệ duy nhất:** thẻ "Do An thêm" (`by_child_cards`). Đây là nội dung con *muốn* bố mẹ cùng xem, và màn hình phải ghi rõ điều đó *(review)*.
- **D2. Phần thưởng tách khỏi check-in.** Con xóa check-in hoặc check-in hết hạn thì khu rừng / trang manga **không** mất. Xóa để giữ riêng tư không được làm con bị phạt *(review)*.
- **D3.** Liên kết bằng `id`; mỗi bảng có `family_id`, `child_id`, `created_at`. Mọi thời lượng (5 phút, 10 phút) tính theo **giờ máy chủ**, không theo đồng hồ máy con (CLAUDE.md) *(review)*.
- **D4.** Tham số gia đình nằm trong `family_settings`; danh sách cố định (từ, nguyên nhân, hoạt động, bài học, cụm từ an toàn) nằm trong **bảng dữ liệu**, không ghi cứng trong code *(review)*.
- **D5. Không để lại dấu vết ngoài bảng.** Route `/api/by/*` không ghi `audit_log`, không `console.log` nội dung, không đưa giá trị vào URL, và kiểm tra dữ liệu trước khi lưu (để log lỗi của Postgres không in ra dòng dữ liệu) *(review)*.
- **D6. Bản sao lưu A9 bỏ dữ liệu `by_*`.** Thêm `--exclude-table-data 'public.by_*'` vào `backup.yml`. Nếu không, bản sao lưu giữ check-in 30 ngày, kể cả những cái con đã xóa *(review)*.

### 2.2 Bảng đề xuất (chưa phải SQL)

| Bảng | Mục đích | Cột chính |
|---|---|---|
| `by_checkins` | Mỗi lượt con đi hết | `quad`, `word_key`, `intensity` (1–5, chỉ khi khó chịu), `activity_key`, `cause_key` (mã cố định hoặc `custom`), `understood_at`, `local_date`, **`client_run_id` unique** (bấm Xong 2 lần chỉ tạo 1 dòng) |
| `by_rewards` | Phần thưởng đã mở, không có nội dung cảm xúc | `local_date`, `reward_key` (loài cây / trang). **Unique `(child_id, local_date)`** khi giới hạn 1/ngày, để hai lượt cùng lúc không mở 2 lần |
| `by_sessions` | Phiên Góc bình yên do máy chủ giữ (PIN, tự khóa 5', giới hạn 10' trong giờ học) | `token_hash`, `device_id`, `started_at`, `last_seen_at`, `ended_at` |
| `by_signals` | Tín hiệu cho bố mẹ, **không có nội dung** | `kind` (`want_talk` · `needs_care`), `to_parent_id` (null = cả hai), `created_at`, `seen_at`, `seen_by` |
| `by_child_cards` | Thẻ "Do An thêm" (ngoại lệ D1) | `title` ≤ 80, `fact` ≤ 300 ký tự, `status` (`pending` · `checked`) |
| `by_catalog` | Danh sách cố định cho từng con | `kind` (word · cause · activity · lesson · risk_phrase), `key`, `label`, `child_id` (null = cả hai), `weight`/`data` (jsonb), `retired` |
| `profiles` (thêm cột) | PIN Góc bình yên của con | `by_pin_hash`, `by_pin_failed_count`, `by_pin_locked_until`, `by_pin_reset_at` |
| `family_settings` (thêm cột) | Tham số | `by_enabled` (mặc định **false**), `by_study_minutes` (10, **≥ 5**), `by_idle_lock_minutes` (5, **2–15**), `by_daily_rewards` (1, ≥ 1) |

Giá trị kiểu `quad`, `kind`, `status` được kiểm ở route máy chủ và bằng `by_catalog`, **không** dùng CHECK cố định. Muốn thêm giá trị sau này thì chỉ cần thêm dòng, không phải sửa ràng buộc (giữ luật "migration chỉ thêm") *(review)*.

**Dữ liệu chỉ ở trên máy con:** câu kể, "Hỏi lại cái đầu", nhật ký tối, tên nguyên nhân tự đặt.
- **Mã hóa** bằng khóa sinh từ PIN Góc bình yên của con (Q2). **Chỉ trên laptop riêng**: iPad dùng chung không lưu chữ (Q3).
- Mã hóa bằng PIN 6 số chặn được người xem lướt, nhưng không chặn được người rành kỹ thuật cố tình dò. Phải nói rõ điều này với con *(review)*.

---

## 3. Ai được làm gì

**Con không có quyền đọc trực tiếp các bảng `by_*`.** Mọi đọc / ghi đi qua route `/api/by/*`. Route kiểm tra **phiên Góc bình yên** (`by_sessions`) ở máy chủ trước.

Lý do: phiên đăng nhập thường của con kéo dài và trình duyệt đọc được. Nếu bảng mở quyền đọc, ai cầm máy đang đăng nhập đều truy vấn thẳng được, bỏ qua PIN Góc bình yên *(review)*.

| Dữ liệu | Con (qua route, có phiên BY) | Anh/chị/em | Bố mẹ (trang web) |
|---|---|---|---|
| `by_checkins`, `by_rewards` | Xem, tạo, xóa của mình | ❌ | **❌ không grant, không policy** |
| `by_sessions` | — (chỉ máy chủ) | ❌ | ❌ |
| `by_signals` | Tạo; xem trạng thái "bố mẹ đã thấy chưa" | ❌ | Xem; **chỉ sửa được `seen_at`, `seen_by` = chính mình**; không xóa *(review)* |
| `by_child_cards` | Tạo, xem | ❌ | Xem; chỉ sửa `status` |
| `by_catalog` | Xem (qua route) | — | Sửa (như allowlist) |
| `family_settings.by_*` | Xem | — | Sửa, trong giới hạn min/max |
| Dữ liệu trên máy | Có | Không thấy trong app | Không |

**Test bắt buộc trong `supabase/tests/`:**
- không policy nào trên `by_checkins` / `by_rewards` nhắc tới `parent`;
- role `authenticated` không có grant trên `by_checkins`, `by_rewards`, `by_sessions`.

**Xuất / xóa toàn bộ dữ liệu** chỉ làm được **từ trong phiên Góc bình yên của con**. Không có nút cho bố mẹ *(review)*.

### "🔒 Ai thấy gì?": những điều phải nói thật với con

1. Bố mẹ **không** xem được cảm xúc, nguyên nhân, chữ con viết.
2. Bố mẹ **có** nhận tín hiệu khi:
   - con bấm "muốn nói chuyện";
   - con viết điều cho thấy con không an toàn. Tín hiệu này **không kèm chữ**, nhưng bố mẹ sẽ biết là đã có chuyện như vậy *(review)*.
3. Thẻ "Do An thêm" là để bố mẹ cùng xem.
4. Chữ con viết chỉ nằm trên laptop của con, được khóa bằng PIN của con. Xóa dữ liệu trình duyệt là mất.
5. **Về kỹ thuật, quản trị hệ thống (bố mẹ) vẫn có thể mở bảng dữ liệu.** Bố mẹ hứa không làm vậy, và hệ thống không có trang nào cho bố mẹ xem.
6. Nếu bố mẹ xóa PIN Góc bình yên: dữ liệu trên máy bị xóa theo, và con được báo ngay lần mở sau.

---

## 4. Một lần ghé

```
[PIN Góc bình yên] → chọn ô → chọn từ → (khó chịu: mức 1–5) → 3 gợi ý → làm → XONG
                                                                              │
                                     lưu by_checkins (client_run_id) + xét by_rewards (R4)
                                                                              ▼
                                        Phần thưởng + bài học → (tùy chọn) "Muốn hiểu vì sao?"
```

- **Bỏ giữa chừng** (đóng tab, tự khóa, đổi người) thì không lưu gì.
- **"Con muốn nói chuyện"** và **màn an toàn** nằm **ngoài mọi cài đặt và đồng hồ**:
  - vẫn hiện khi `by_enabled = false`;
  - không bị tự khóa 5' che mất;
  - không bị giới hạn 10' đẩy ra *(review)*.

---

## 5. Quy tắc + ví dụ chuẩn

> Ví dụ chuẩn = đáp án bố mẹ xác nhận. Test kiểm theo đáp án này.
> Cột "Bản mẫu" là kết quả chạy code bản mẫu ngày 01/11. 🔴 = bản mẫu sai, 🟡 = đề xuất chỉnh.

### R1. Gợi ý 3 hoạt động

Ô cảm xúc cho biết kiểu chăm sóc. Từ cụ thể và nguyên nhân cộng thêm trọng số. Lấy 3 hoạt động hợp nhất.

**Khó chịu + mức 4–5 → "Nhắn bố mẹ" đứng đầu.**

| # | Ai | Cảm xúc · nguyên nhân · mức | Bản mẫu | Đáp án đề xuất |
|---|---|---|---|---|
| 1 | Nguyên | tức giận · điện thoại · 3 | Nhảy 1 bài, Thở cho dịu, Hỏi lại cái đầu | giữ |
| 2 | Nguyên | lo lắng · bài tập · 2 | Hỏi lại cái đầu, Thở cho dịu, Nhảy 1 bài | giữ |
| 3 | Nguyên | lo lắng · bài tập · **5** | **Nhắn bố mẹ**, Hỏi lại cái đầu, Thở cho dịu | giữ |
| 4 | Nguyên | cô đơn · bạn bè · 3 | Kể cho 1 người, Nhắn bố mẹ, Thở cho dịu | giữ |
| 5 | Nguyên | mệt · ngủ ít · 2 | Thở, Kể cho 1 người, Nhắn bố mẹ | 🟡 Thở, **Nghỉ / ngủ sớm** (hoạt động mới), Kể cho 1 người |
| 6 | Nguyên | chán · — · 2 | Kể cho 1 người, Nhắn bố mẹ, Thở | 🔴 **Nhảy 1 bài**, Kể cho 1 người, Giữ khoảnh khắc |
| 7 | Nguyên | tự hào · được vẽ | Kể cho 1 người, 3 bằng chứng, 3 điều biết ơn | 🟡 **Giữ khoảnh khắc**, Kể cho 1 người, 3 điều biết ơn |
| 8 | An | tức giận · với chị Nguyên · **4** | **Nhắn bố mẹ**, Đo nhịp tim, Núi lửa trong lọ | giữ |
| 9 | An | lo lắng · bài tập · 2 | Đo nhịp tim, Lọ bình tĩnh, Bong bóng chậm | giữ |
| 10 | An | buồn · bạn bè · 3 | Kể cho 1 người, Nhắn bố mẹ, Quan sát bầu trời | giữ |
| 11 | An | chán · tivi · 2 | Câu hỏi tò mò, Kể cho 1 người, Núi lửa trong lọ | giữ |
| 12 | An | tò mò · khám phá | Câu hỏi tò mò, Kể cho 1 người, Quan sát bầu trời | giữ |

"Nhảy 1 bài": con tự bật nhạc bằng thứ con có. App **không** nhúng hay mở link nhạc bên ngoài.

### R2. Bài học "lần sau"

Câu 1 bình thường hóa cảm xúc. Câu 2 là bài học theo nguyên nhân. **Cùng một nguyên nhân thì cảm xúc dễ chịu và khó chịu có bài học khác nhau.**

| # | Cảm xúc · nguyên nhân | Bản mẫu (câu 2) | Đáp án đề xuất |
|---|---|---|---|
| 1 | lo lắng · bài tập | "Áp lực bài vở… Chia nhỏ ra…" | giữ |
| 2 | mệt · ngủ ít | "Thiếu ngủ thì cảm xúc dễ bùng — không phải con tệ, là pin yếu…" | giữ |
| 3 | **tự hào · bài tập** | 🔴 "Áp lực bài vở…" | "Con vừa thấy cố gắng của mình được đền đáp. Lần sau gặp bài khó, nhớ lại cảm giác hôm nay." |
| 4 | **biết ơn · gia đình** | 🔴 "Người thân làm mình buồn nhất…" | "Biết ơn người thân mà nói ra thì cả hai cùng ấm lòng. Thử nói một câu cảm ơn hôm nay." |
| 5 | bình yên · ngoài trời | Câu chung cho cảm xúc dễ chịu | giữ |
| 6 | chán · — | Câu chung cho cảm xúc khó chịu | giữ |

→ Khi build: bảng bài học **2 chiều** (nguyên nhân × dễ chịu/khó chịu) trong `by_catalog`. Claude soạn, bố mẹ duyệt.

### R3. An toàn

- Chạy **trên máy con**, trên mọi ô gõ chữ (kể cả chữ không lưu).
- Kiểm tra **trong lúc gõ** (sau khi ngừng gõ ~1 giây), không chỉ lúc bấm nút. Con gõ rồi bỏ dở vẫn được kiểm tra *(review)*.

**Lỗi bản mẫu:**
- Cách so khớp bỏ dấu biến "tự tử" thành `tu tu`.
- Vì vậy "**từ từ**" và "**tư tư**ởng" đều bị báo nhầm.
- Danh sách cũng thiếu nhiều cách nói *(review)*:
  - teencode: "mún chết", "ko mun song";
  - tiếng Anh: "kms", "kill myself", "unalive";
  - chữ cách nhau;
  - cách nói nhẹ: "muốn biến mất", "không muốn tồn tại", "ngủ luôn không dậy".

**2 mức:**

| Mức | Khi nào | Con thấy | Bố mẹ nhận |
|---|---|---|---|
| **Mạnh** | Cụm rõ nghĩa, khớp nguyên từ | Màn an toàn: **111** (trò chuyện) + **115** (nguy hiểm ngay) + nút nói với bố mẹ | `needs_care` ngay |
| **Hỏi lại** | Cụm dễ trùng nghĩa | "Con có đang nghĩ đến việc làm đau mình không?" — **Có**: như mức Mạnh · **Không**: tiếp tục | Chỉ khi con chọn "Có" |

**Tín hiệu không được lặng lẽ thất bại** *(review)*:
1. Gửi không được (mất mạng) thì thử lại. Nói với con: "Chưa gửi được cho bố mẹ, hãy tìm bố mẹ trực tiếp hoặc gọi 111."
2. Con thấy trạng thái tín hiệu: *đã gửi* / *bố mẹ đã thấy*.
3. Bố mẹ chưa bấm "Đã thấy" sau 10 phút (Q5): nhắc lại, gửi cho cả hai bố mẹ.
   - ⚠️ Thông báo đẩy (S5) **chưa làm**. Trước khi bật Góc bình yên cần có ít nhất **một kênh chắc chắn tới bố mẹ**.

**Dấu hiệu lặp lại, không cần chữ** *(review)*: 3 lần mức 5 trong 7 ngày thì hiện cho **con** lời nhắn 111 + "nói với bố mẹ". Quy tắc này chạy trên máy con và không tự báo bố mẹ (Q4).

| # | Con gõ | Đáp án |
|---|---|---|
| 1 | "con muốn chết" | Mạnh |
| 2 | "con muon chet" | Mạnh |
| 3 | "mún chết quá" | Mạnh |
| 4 | "kms" | Mạnh |
| 5 | "không ai cần mình" | Mạnh |
| 6 | "từ từ thôi" | Không gì |
| 7 | "ôn tư tưởng Hồ Chí Minh" | Không gì |
| 8 | "bài khó quá chết mất" | Không gì |
| 9 | "cắt tay vào giấy" | Hỏi lại |
| 10 | "muốn biến mất khỏi lớp này" | Hỏi lại |

Bộ thử ≥ 50 câu nằm trong spike S3. Cụm từ lưu trong `by_catalog`; bố mẹ duyệt danh sách.

### R4. Phần thưởng

- Mỗi lượt **hoàn thành** được tính.
- Mở tối đa `by_daily_rewards` (1) lần mỗi ngày.
- Phần thưởng **không phụ thuộc cảm xúc** (buồn cũng như vui), để con không phải giả vui.
- Đã mở thì giữ mãi, kể cả khi check-in bị xóa (D2).

| # | Tình huống | Đáp án |
|---|---|---|
| 1 | Lượt đầu tiên trong ngày | Mở 1 loài cây / 1 trang |
| 2 | Lượt thứ 3 cùng ngày | Không mở thêm: "Hôm nay khu rừng đã có cây mới rồi, mai nhé" |
| 3 | Nguyên chọn "buồn" | Vẫn có trang manga như mọi ngày |
| 4 | 23:59 rồi 00:01 | Hai ngày khác nhau, cả hai được mở |
| 5 | Con xóa check-in hôm qua | Cây hôm qua vẫn còn |
| 6 | Bấm Xong 2 lần khi mạng chậm | 1 check-in, 1 phần thưởng |

### R5. Giờ học

- Vào được khi máy khóa, vì Launcher đã có trong allowlist. **Không đổi luật khóa.**
- Giờ học: mỗi lần tối đa `by_study_minutes` (10'), tính bằng **giờ máy chủ** qua `by_sessions`. Hết giờ thì về màn Hôm nay.
- "Muốn nói chuyện" và màn an toàn không bị giới hạn.

| # | Tình huống | Đáp án |
|---|---|---|
| 1 | Giờ học, vào 19:00 | Về Hôm nay lúc 19:10 |
| 2 | Giờ tự do / đã xong bài | Không giới hạn |
| 3 | Vào lại ngay sau khi bị đẩy ra | Được (Q6) |
| 4 | Đang ở màn an toàn lúc hết 10' | Không đẩy ra |
| 5 | Đổi giờ máy con | Không ảnh hưởng (giờ máy chủ) |

### R6. PIN Góc bình yên

- **PIN riêng do con tự đặt** (Q1), khác PIN đăng nhập mà bố mẹ đặt.
  - Lý do: bố mẹ biết PIN đăng nhập, nên dùng chung thì bố mẹ mở được Góc bình yên trên máy con bất cứ lúc nào *(review)*.
- Sai 5 lần thì khóa 15'.
- Quên PIN: bố mẹ chỉ có thể **xóa** PIN Góc bình yên. Xóa PIN thì xóa luôn dữ liệu trên máy và báo con. Check-in trên máy chủ giữ nguyên; con đặt PIN mới là thấy lại.
- Tự khóa sau `by_idle_lock_minutes` không chạm, tính ở máy chủ (`by_sessions.last_seen_at`).
- **iPad dùng chung:**
  - Đổi người phải gõ PIN của người kia.
  - Đổi người thì xóa bản nháp trên màn hình.
  - Thêm cờ `pin_devices.shared` để app biết máy nào là máy dùng chung (để không lưu chữ trên máy dùng chung, Q3).

---

## 6. Ca khó

| Ca | Xử lý |
|---|---|
| An mở nhầm tên chị trên iPad | PIN Góc bình yên chặn |
| Bố mẹ mở Góc bình yên trên máy con | Cần PIN của con; bố mẹ chỉ xóa được PIN (và con sẽ biết) |
| Mất mạng khi bấm Xong | "Chưa lưu được, thử lại"; với tín hiệu thì luôn thử lại + báo con |
| Con xóa dữ liệu trình duyệt / đổi máy | Mất chữ riêng tư (nói trước); check-in + phần thưởng còn |
| Con muốn xóa hết | Nút "Xóa hết của con" trong phiên Góc bình yên, xóa hẳn (Q7) |
| `want_talk` khi chính bố/mẹ là nguyên nhân | Con chọn được gửi cho ai (mặc định: cả hai) |
| Bố mẹ tắt `by_enabled` | Khu bị ẩn, nhưng nút "Muốn nói chuyện" + màn an toàn vẫn còn ở Hôm nay |
| Từ / nguyên nhân bị bỏ khỏi danh sách | Đặt cờ `retired`, không xóa |
| Thông báo đẩy "con muốn nói chuyện" | Nội dung chung chung, không kèm cảm xúc |

---

## 7. Quyết định đã chốt (phụ huynh, 01/11/2026)

| # | Câu hỏi | Đã chốt |
|---|---|---|
| Q1 | PIN mở Góc bình yên | **Con tự đặt PIN riêng.** Bố mẹ chỉ xóa được; xóa thì chữ trên máy bị xóa và con được báo |
| Q2 | Mã hóa chữ trên máy | **Có**, bằng khóa sinh từ PIN Góc bình yên của con |
| Q3 | Lưu chữ trên iPad dùng chung | **Không.** Chỉ lưu trên laptop riêng; trên iPad, viết xong là buông |
| Q4 | Bố mẹ thấy con số nào không | **Không.** Chỉ thấy tín hiệu con gửi và `needs_care` |
| Q5 | Nhắc lại `needs_care` khi chưa ai thấy | Sau **10 phút** |
| Q6 | Giới hạn số lần vào trong giờ học | **Không giới hạn số lần**, mỗi lần tối đa 10'; xem lại sau 2 tuần |
| Q7 | Xóa, giữ dữ liệu | Con xóa thì **xóa hẳn**; tự xóa sau **12 tháng** |

---

## 8. Đề xuất ghi SPEC §18 (chưa ghi; chờ duyệt)

> | 01/11/2026 | **Góc bình yên** (`/binh-yen`; thiết kế: hub GOC_BINH_YEN_DESIGN v1.1; quy tắc: `docs/BINH_YEN.md`). Không bắt buộc, không gắn mở khóa, **mặc định tắt**. Bố mẹ **không đọc** dữ liệu cảm xúc, chỉ nhận tín hiệu không nội dung. PIN Góc bình yên do con đặt. **Ngoại lệ có chủ ý với §15:** đếm lượt để mở loài cây / trang manga, tối đa 1/ngày, không phụ thuộc cảm xúc, không đổi giờ chơi, không chuỗi ngày, không so sánh 2 con. "Khu rừng" và "giao diện theo tuổi" (v2) làm sớm **chỉ trong Góc bình yên**. Bản sao lưu bỏ dữ liệu `by_*`. |

## 9. Cần thử trước (spike)

| # | Thử gì | Đạt khi |
|---|---|---|
| S1 | Phiên Góc bình yên do máy chủ giữ, tự khóa 5' trên iPad Safari (cả khi app chạy nền) | Mở lại sau 6' thì phải gõ PIN |
| S2 | Lưu chữ mã hóa theo PIN con trên Edge / Chrome | Đúng PIN thì đọc được; sai PIN hoặc người khác thì không |
| S3 | Bộ phát hiện an toàn 2 mức với ≥ 50 câu | Mọi câu "Mạnh" đều bắt được; câu thường ngày không báo nhầm |
| S4 | Một kênh chắc chắn tới bố mẹ (thông báo đẩy iPhone, hoặc tạm dùng email) | Tín hiệu tới trong ≤ 1 phút |

### Kết quả spike (01/11/2026)

| # | Kết quả | Ghi chú |
|---|---|---|
| S2 | ✅ **Đạt.** Code: `lib/binhYen/vault.ts`; 8 test: đúng PIN mở được, sai PIN không mở, đem sang tài khoản anh/chị/em không mở, sửa 1 byte bị phát hiện, xóa PIN là xóa hết, dữ liệu hỏng không làm sập | PBKDF2 600.000 vòng: mở khóa ≈ 0,1 giây trên máy chủ; trên laptop của con cần đo lại khi build S-BY2. Giới hạn đã nói với con: PIN 6 số chặn được xem lướt, không chặn được người rành kỹ thuật cố tình dò |
| S3 | ✅ **Đạt.** Code: `lib/binhYen/safety.ts`; **66 câu thử**: 28 câu Mạnh, 11 câu Hỏi lại, 25 câu thường ngày, tất cả đúng | Phát hiện mới: tiếng Việt hay nói quá kiểu "**cười / nóng / sợ muốn chết**" → không báo; "**mệt / chán / buồn / đau… muốn chết**" → hỏi lại con; "**con / mình muốn chết**" → Mạnh. Bắt được cả chữ kéo dài ("chếttt"), chữ cách nhau ("m u ố n c h ế t"), teencode, vài cụm tiếng Anh. "tu tu" không dấu → hỏi lại (vì có thể là "từ từ") |
| S1 | ⏳ Chưa làm — cần iPad thật | Làm cùng lát S-BY0 |
| S4 | 🔵 Đang chờ bố mẹ thử thông báo đẩy (PR #32 + SETUP A10) | |

## 10. Lát build dự kiến

1. **S-BY0:** PIN Góc bình yên + `by_sessions` + `by_signals` + trang bố mẹ "Đã thấy" + kênh báo (S4). Có nút "Con muốn nói chuyện" ở màn Hôm nay. Cần có trước mọi thứ khác.
2. **S-BY1:** chọn ô → từ → mức → 3 gợi ý (R1) → hoạt động → Xong → `by_checkins` + test quyền. Chưa có ô gõ chữ.
3. **S-BY2:** ô gõ chữ + R3 (cùng lát, bắt buộc) + chữ mã hóa trên máy.
4. **S-BY3:** hiểu nguyên nhân + bài học R2 + Bảng điều tra / Bàn pha chế.
5. **S-BY4:** phần thưởng R4 (khu rừng An, trang manga Nguyên).
