# Màn chính mới của con — spec R0

> Trạng thái: **bố mẹ đã duyệt** (07/11/2026; sửa luật nghỉ + ngày không có việc theo ý bố mẹ cùng ngày). Chỉ tài liệu, không đổi code, không đổi database.
> Nguồn: bản bấm thử hai con đã duyệt (https://claude.ai/artifact/Cr5rqxEEGdiWuMgV5TRYav), canvas (https://claude.ai/artifact/VN6NCVjHRVKuti7qGZ63og), spec biểu tượng PR #41 (`docs/BINH_YEN_BIEU_TUONG.md`), góp ý của hai con 06–07/11.
> Đã qua 1 lượt review độc lập (07/11, 21 điểm, đã sửa vào bản này).
> Sau khi bố mẹ duyệt, từng lát R1–R5 cập nhật `SPEC.md` / `DESIGN.md` / `PROGRESS.md`. R0 không sửa các file đó để khỏi đụng PR #42 đang mở.

## 0. Vì sao làm

Góp ý của hai con (06/11):
- Muốn vào Góc bình yên trước rồi mới học.
- Muốn thấy biểu đồ cảm xúc cả tuần ngay trang đầu.
- Muốn app có đủ **cảm xúc – học tập – kỹ năng – vui chơi**.
- Muốn có chỗ xếp nhiều bài, và kỹ năng không bị khóa.
- Muốn có "thế giới" của mình: Nguyên là tập truyện tranh, An là khu rừng sống.

Bố mẹ ưu tiên trải nghiệm của con: con không thấy thoải mái thì con sẽ không dùng.

| Ngày | Quyết định của bố mẹ |
|---|---|
| 07/11 | Có **Góc học tập** riêng (màn rộng để xếp bài, làm bài). |
| 07/11 | **Kỹ năng mở ngay, làm song song** với bài tập. **Giờ tự do 45' chỉ có sau khi xong cả bài tập và kỹ năng.** |
| 07/11 | **Nghỉ 10' sau khi xong một trong hai phần** (xong bài tập *hoặc* xong kỹ năng, phần nào xong trước cũng được), vẫn 1 lần/ngày, không bắt buộc. Bố mẹ sửa lại 07/11: không phải "lúc nào cũng được". |
| 07/11 | Ngày không có bài đến hạn: **giữ bắt buộc làm trước 1 bài** (`homework_min_upcoming = 1`). |
| 07/11 | Làm bài trên lớp trong lúc chạy đồng hồ kỹ năng: **chấp nhận, ghi là giới hạn đã biết**. |
| 07/11 | Trang truyện / khu rừng **có cảm xúc của con, hiện trên màn của con** (Hôm nay, Tuần). **Bố mẹ không có trang nào để xem.** |
| 07/11 | Thứ tự code: R1 luật mới → R2 Góc học tập → R3–R5. |
| 07/11 | Ngày **không có việc nào** (không bài, không bổ sung, không kỹ năng): **con bấm "Bắt đầu giờ tự do"** thì 45' mới tính. Lý do: extension hỏi máy chủ cả lúc 00:00, tự bắt đầu thì 45' trôi mất lúc con ngủ. |

## 1. Luật mới (R1) — thay DESIGN §5 hiện tại

### 1.1 Bằng lời

- **Phần 1** (bài trên lớp đến hạn + bài bổ sung) và **Phần 2** (kỹ năng) **mở cùng lúc** từ đầu ngày. Con tự chọn thứ tự. SPEC §3 vốn đã cho con "quyền quyết thứ tự 2 phần".
- **Giờ tự do** bắt đầu khi **cả hai phần xong**, hoặc khi con dùng thẻ miễn. Vẫn 45', 1 lần/ngày, dừng ở 00:00.
- **Nghỉ 10'**:
  - Mở khi con **xong Phần 1 hoặc xong Phần 2** (phần nào trước cũng được) và **chưa có giờ tự do**. Vẫn 1 lần/ngày. Trong 10' đó máy mở mọi trang.
  - Ngày không có bài tập và bài bổ sung (Phần 1 rỗng) thì nghỉ được ngay, như cũ.
  - Ngày không có kỹ năng (Phần 2 rỗng) thì vẫn nghỉ **sau khi xong bài tập**, như cũ. Phần 2 rỗng không tự mở nghỉ.
  - Không nghỉ cũng không sao: không còn bước "mời nghỉ" chặn đường.
  - Nút Nghỉ ẩn khi `break_minutes = 0`.
- **Giữ nguyên:**
  - Mỗi lúc chỉ chạy 1 việc có giờ tối thiểu.
  - Bấm Xong sớm hơn 20' thì bị từ chối.
  - Bài trên lớp cần ảnh hoặc bố mẹ xác nhận.
  - Override mới nhất thắng.
  - Mọi khoảng mở dừng ở 00:00.
  - Fail-closed.

### 1.2 Bảng ưu tiên mới (xét từ trên xuống, gặp điều kiện đúng thì dừng)

| # | Điều kiện | Status | Máy |
|---|---|---|---|
| 1–2 | Override mới nhất còn hiệu lực | LOCK_OVERRIDE / OPEN_OVERRIDE | khóa / mở đến `until` |
| 3 | Chế độ Tin tưởng | OPEN_TRUST | mở |
| 4 | Ngày ốm | OPEN_SICK | mở |
| 5 | Đã có giờ tự do và hết 45' | LOCK_END | khóa |
| 6 | Đang giờ tự do | FREE | mở đến hết 45' |
| 7 | **Đang nghỉ** (đã bấm, chưa hết 10', chưa bấm Học tiếp) | BREAK | mở đến hết nghỉ |
| 8 | Phần 1 chưa xong | LOCK_P1 | khóa |
| 9 | Phần 1 xong, kỹ năng chưa xong | LOCK_P2 | khóa |
| 10 | Cả hai phần không có việc nào, con chưa bấm "Bắt đầu giờ tự do" | FREE_READY | khóa |

Khác bản cũ:
- **BREAK lên trên LOCK_P1**: con xong kỹ năng trước thì nghỉ được dù bài tập chưa xong.
- **Bỏ BREAK_OFFER** khỏi danh sách status. TypeScript sẽ báo mọi chỗ còn dùng nó.
- `part2.locked` luôn `false`.
- Các tên status khác giữ nguyên. Extension không phụ thuộc tên status (chỉ đọc `open` / `openUntil`).

### 1.3 Mốc ghi lười (milestones)

| Mốc | Ghi khi | Ghi chú |
|---|---|---|
| `part1_done_at` | Phần 1 có việc và đã xong hết; **hoặc** Phần 1 rỗng **và Phần 2 vừa xong**; **hoặc** ngày không có việc nào và con bấm "Bắt đầu giờ tự do" | Có khóa tay hay không thì cũng ghi. **Không bao giờ ghi do dùng thẻ.** Phần 1 rỗng chưa được chốt sớm, nên bài bố mẹ giao trước lúc đó vẫn khóa lại (giữ quyết định 14/10; mốc chốt đổi từ "bấm/bỏ nghỉ" sang "phần kia xong") |
| `part2_done_at` | Phần 2 có việc và đã xong hết (**không cần Phần 1 xong trước**); **hoặc** Phần 2 rỗng **và Phần 1 vừa xong** | Như trên. Kỹ năng bố mẹ bật thêm sau mốc này vẫn hiện ra nhưng không khóa lại, giống bài giao thêm sau Phần 1 (diễn giải 13 thêm vế cho Phần 2) |
| `free_started_at` | Có cả 2 mốc trên và bố mẹ **không** đang khóa tay; hoặc con dùng thẻ | Như cũ: đang khóa tay thì hoãn, hết khóa mới bắt đầu |
| `break_skipped` | Không ghi nữa | Cột giữ nguyên. Dòng có `break_skipped = true` (ngày cũ, hoặc chính ngày R1 lên) = **hôm đó đã hết lượt nghỉ** |

**"Ngày đạt"** (dùng cho thống kê tuần và chế độ Tin tưởng) khi có một trong ba:
- Có **cả** `part1_done_at` lẫn `part2_done_at`, cả hai trước giờ ngủ.
- Dùng thẻ.
- Ngày ốm hoặc nghỉ lễ.

Không cần luật riêng cho ngày cũ: đã kiểm lịch sử code, từ lần chạy thật đầu tiên (PR #4) mọi dòng có `part2_done_at` đều có `part1_done_at`. Tiến độ Tin tưởng và tổng kết các tuần đã qua **không đổi**. (Bản trước của spec đề xuất "dòng cũ tính theo luật cũ" — bỏ, vì với luật mới nó sẽ tính "đạt" cho ngày con xong kỹ năng mà bỏ bài tập.)

### 1.4 Ví dụ đáp án (bố mẹ xác nhận → thành bài kiểm tra Vitest ở R1)

**Ngày mẫu:** 2 bài trên lớp đến hạn (Toán, Anh), 1 bài bổ sung 20', 2 kỹ năng 20'. Nghỉ 10', giờ tự do 45', giờ ngủ 21:30.

| # | Tình huống | Đáp án đề xuất |
|---|---|---|
| E1 | 17:00 chưa làm gì, con bấm Bắt đầu kỹ năng "Đọc sách" | **Được** (bản cũ: từ chối). Máy vẫn khóa (LOCK_P1) |
| E2 | Xong cả 2 kỹ năng, bài trên lớp mới xong 1/2 | Khóa (LOCK_P1), chưa có giờ tự do |
| E3 | Xong hết Phần 1, kỹ năng mới 1/2 | Khóa (LOCK_P2). Không có bước mời nghỉ |
| E4 | 19:00 xong việc cuối cùng (của phần nào cũng vậy) | Giờ tự do 19:00–19:45. Đúng 19:45:00 khóa đến hết ngày |
| E5 | 17:05 chưa xong phần nào, bấm Nghỉ | **Từ chối** (nút ẩn): "Xong bài tập hoặc xong kỹ năng là được nghỉ" |
| E5b | 17:40 xong cả 2 kỹ năng, bài tập chưa xong, bấm Nghỉ | Mở mọi trang 17:40–17:50. Đúng 17:50:00 khóa lại (LOCK_P1) |
| E5c | 18:30 xong Phần 1, kỹ năng chưa xong, bấm Nghỉ | Mở 18:30–18:40, rồi khóa (LOCK_P2) — giống hiện nay |
| E5d | Ngày không có bài trên lớp, không có bài bổ sung | Nghỉ được ngay từ đầu ngày (Phần 1 rỗng = xong), như hiện nay |
| E5e | Ngày không có kỹ năng, 06:00 bài tập chưa xong | **Chưa** nghỉ được; xong bài tập là có giờ tự do luôn (như hiện nay) |
| E6 | Đã nghỉ rồi, bấm Nghỉ lần 2 | Từ chối: "Hôm nay con đã nghỉ rồi" |
| E7 | Đã xong Phần 1, đang chạy đồng hồ kỹ năng, bấm Nghỉ | **Từ chối**: "Bấm Xong việc đang làm trước". Để 10' nghỉ không tính vào 20' của kỹ năng (áp dụng mặc định, bố mẹ đổi được) |
| E8 | Đang nghỉ, con bấm Bắt đầu, Xong, nộp ảnh (cả nộp qua QR bằng điện thoại) hoặc nhờ bố mẹ xem | **Từ chối**: "Đang nghỉ — bấm Học tiếp để làm tiếp". Bấm Học tiếp thì hết nghỉ ngay và làm tiếp được. Xếp thứ tự bài vẫn được (áp dụng mặc định, bố mẹ đổi được) |
| E9 | Cả ngày không nghỉ | Không sao; xong hết thì có giờ tự do luôn |
| E10 | Đã có giờ tự do, bấm Nghỉ | Từ chối (nút ẩn) |
| E11 | 23:55 bấm Nghỉ | Mở đến 00:00, không cộng sang hôm sau |
| E12 | Bố mẹ đang khóa tay, con bấm Nghỉ | Từ chối (nút ẩn): "Bố mẹ đang khóa máy" |
| E13 | Máy đang mở sẵn (Tin tưởng / ngày ốm / bố mẹ mở) | Nút Nghỉ ẩn, không tốn lượt nghỉ |
| E14 | Ngày không có kỹ năng; 18:00 xong Phần 1 | Giờ tự do 18:00–18:45 |
| E15 | 06:00 chưa có bài trên lớp, không có bài bổ sung; 07:00 con xong kỹ năng | Giờ tự do từ 07:00. Bài bố mẹ giao lúc 17:00 hiện ra nhưng **không khóa lại**. *Giống hiện nay*: bản cũ con chỉ cần bỏ qua nghỉ là có kết quả tương tự |
| E16 | Như E15, nhưng bố mẹ giao bài lúc 06:30 (trước khi con xong kỹ năng) | Khóa lại (LOCK_P1) đến khi xong bài đó |
| E17 | Bố mẹ giao thêm bài sau khi con xong Phần 1, kỹ năng chưa xong | Bài hiện ra, **không chặn** giờ tự do (như cũ) |
| E18 | Xong kỹ năng 18:00, xong bài trên lớp 22:00 | Giờ tự do 22:00–22:45. **Không** tính "ngày đạt" vì Phần 1 xong sau 21:30 |
| E19 | Ngày không có bài đến hạn, có bài "Sắp tới" | Theo cài đặt `homework_min_upcoming` = 1: phải làm trước 1 bài mới đủ Phần 1 (**bố mẹ chốt giữ 07/11**) |
| E20 | Có bài đến hạn, con bấm "+ Làm trước" bài tuần sau | Không bắt buộc, không chặn giờ tự do. Xong sớm ≥ 2 ngày thì được ★ (chỉ ghi nhận) |
| E21 | Thẻ miễn | Như cũ: dùng được khi còn thẻ và chưa có giờ tự do, không dùng được khi bố mẹ khóa tay. Dùng thẻ **không** ghi mốc Phần 1 / Phần 2 |
| E22 | Con đang nghỉ, bố mẹ bấm xác nhận bài cuối cùng (cả 2 phần thành xong) | Giờ tự do bắt đầu ngay; phần nghỉ còn lại bỏ, không cộng thêm (FREE ở dòng 6, trên BREAK) |
| E23 | Ngày không có kỹ năng, 20:00 xong Phần 1, bố mẹ khóa tay đến 22:00 | Mốc Phần 1 / Phần 2 ghi lúc 20:00, nên **vẫn đạt**. Giờ tự do hoãn, 22:00–22:45 |
| E24 | Ngày cũ có `break_skipped = true` | Hết lượt nghỉ hôm đó. Ngày đạt tính như trước |
| E25 | Ngày không có việc nào; 00:00 extension hỏi máy chủ | Vẫn khóa (FREE_READY), không tự bắt đầu giờ tự do. Con bấm "Bắt đầu giờ tự do" lúc 15:00 → 15:00–15:45. Bố mẹ giao bài trước lúc con bấm → khóa lại đến khi xong bài. Nút này không hiện khi bố mẹ đang mở/khóa tay hay ngày ốm; ngày này không mời dùng thẻ miễn |

### 1.5 Đã chốt / mặc định (07/11)

1. **Nghỉ 10'** mở khi xong Phần 1 **hoặc** Phần 2 (bố mẹ sửa lại 07/11, xem E5–E5d).
2. **E7 + E8 — nghỉ và đồng hồ việc** (áp dụng mặc định, bố mẹ chưa chọn khác):
   - Không cho nghỉ khi đang chạy đồng hồ một việc (ví dụ đã xong kỹ năng, đang làm bài bổ sung 20').
   - Trong lúc nghỉ, các nút việc tạm khóa.
   - Lý do: phút tối thiểu = giờ Xong − giờ Bắt đầu. Nếu cho nghỉ giữa chừng thì 10' nghỉ cũng được tính vào 20' của việc đang làm.
3. **E19 — "Làm trước":** giữ bắt buộc 1 bài vào ngày không có bài đến hạn (`homework_min_upcoming = 1`, không đổi code). Bố mẹ chốt 07/11.
4. **Làm bài trên lớp trong lúc chạy đồng hồ kỹ năng:** chấp nhận, ghi là giới hạn đã biết, vì bài trên lớp vẫn cần ảnh hoặc bố mẹ xem. Bố mẹ chốt 07/11.
5. **Ghi nhận:** Phần 2 nay có thể xong từ sáng sớm. Kỹ năng bố mẹ bật thêm sau đó không tính cho hôm đó (như E15, E17). Nếu sau này muốn "giờ tự do không trước HH:MM", đó sẽ là một tham số trong `family_settings`, không ghi cứng trong code.

### 1.6 Những chỗ phải sửa khi code R1 (không SQL)

| Chỗ | Đổi gì |
|---|---|
| `lib/dayState.ts` | Bảng §1.2, mốc §1.3, "ngày đạt" (một luật, không nhánh dòng cũ). Bỏ `BREAK_OFFER` khỏi `Status`, thêm `FREE_READY` + `free.canStart` + route `/api/day/free`. Thêm `break.canStart` (cùng điều kiện với `decideBreak`). Viết lại diễn giải 1, 2, 7, 8, 13, 15, 20 trong phần đầu file |
| `lib/today/service.ts` `persistMilestones` | Bỏ giả định "giờ tự do bắt đầu cùng lúc Phần 2 xong". Ghi các mốc trong 1 transaction cho mọi thứ tự (Phần 1 xong sau cùng, Phần 2 xong sau cùng, phần rỗng) |
| `lib/today/rules.ts` | `decideStart`: bỏ chặn Phần 2; chặn khi đang nghỉ (E8). `decideFinish`, nộp ảnh, nhờ bố mẹ xem: chặn khi đang nghỉ. `decideBreak`: E5–E7, E10–E13; từ chối khi `break_minutes ≤ 0` |
| `/api/day/break` | Bỏ `skip` (client cũ gọi sẽ nhận lỗi 400); `start` / `end` giữ nguyên |
| `/api/tasks/finish`, `/api/tasks/proof`, route nộp qua QR, `/api/tasks/confirm-request` | Gọi luật "đang nghỉ" ở trên |
| `lib/binhYen/studyCap.ts` + `lib/binhYen/session.ts` | `isStudyTime` đổi thành "chưa xong **cả hai** phần". Nếu giữ như cũ, xong kỹ năng trước là Góc bình yên hết giới hạn 10' dù vẫn đang giờ học |
| `lib/today/view.ts`, `app/today/today-screen.tsx`, blocked view | Chữ banner; bỏ bước "Nghỉ" kiểu bậc thang; bỏ "🔒 mở khi xong Phần 1"; thẻ "việc tiếp theo" không ẩn theo trạng thái nghỉ |
| `lib/today/week.ts` | Kế hoạch được xếp cả kỹ năng; sửa chú thích "Phần 2 trước giờ ngủ" |
| `lib/parent/overview.ts` | LOCK_P1 "Đang học", LOCK_P2 "Còn kỹ năng"; bỏ nhãn BREAK_OFFER |
| Extension | **Không đổi**, không cần cài lại. Extension chỉ đọc `open` + `openUntil`. Nghỉ giữa giờ học là một khoảng mở bình thường. Lỗi máy chủ vẫn → khóa |
| Test | Vitest: mỗi dòng §1.2, E1–E24, biên (đúng giây hết 10' / 45', qua 00:00, `break_minutes = 0`). Sửa `tests/todayRules`, `specialDay`, `week`, `parentOverview`, `binhYenCheckin`, `e2e/flow.spec.ts` (đoạn bỏ qua nghỉ) |
| Tài liệu | DESIGN §5; SPEC §2.6 (dòng "Phần 2 không bấm Bắt đầu được…"); sơ đồ luồng SPEC §3; log SPEC §18 |

## 2. Khung màn của con (R2)

### 2.1 Năm tab (thanh dưới trên điện thoại / cột trái trên laptop)

| Tab | Nguyên | An | Nội dung |
|---|---|---|---|
| 1 | Hôm nay | Hôm nay | Trang đầu (§2.2) |
| 2 | Góc học tập | Góc học tập | §3 |
| 3 | Góc bình yên | Góc bình yên | Như hiện tại (S-BY1, không PIN sau #42) |
| 4 | Tập của tuần | Khu rừng | §5 / §4 |
| 5 | Góp ý | Góp ý | Thích / Chưa thích / Ý tưởng (#42) |

- Đầu mỗi màn có dòng "Con đang ở: Hôm nay › Góc học tập › Toán".
- Nút quay lại luôn ở cùng một chỗ.
- Nút cao ≥ 44px. Màu Nguyên `#2F5D9E`, An `#B85A1C`.

### 2.2 Trang Hôm nay (từ trên xuống)

1. **Lời chào + nút Góc bình yên to nhất** ("Hôm nay con thấy thế nào?"). Đây chỉ là lời mời, **không bao giờ chặn** việc học.
2. **Biểu đồ cảm xúc tuần** (từ thứ Hai đến hôm nay):
   - Mỗi ngày một ô mang màu vùng (đỏ / vàng / xanh dương / xanh lá) và biểu tượng của từ con chọn.
   - Ngày không ghé thì ô trống, không có chữ trách.
3. **Bốn mảng hôm nay**: Cảm xúc · Học tập · Kỹ năng · Vui chơi. Mỗi mảng là một thẻ ghi đã làm gì, còn gì, kèm nút đi tiếp ("Vào Góc học tập", "Bắt đầu kỹ năng").
4. **Trạng thái máy + đồng hồ** (khóa / đang nghỉ đến … / giờ tự do đến …). Nút Nghỉ 10' hiện khi `break.canStart`; nút thẻ miễn như cũ.
5. **Thế giới của con**:
   - Nguyên: trang truyện hôm nay, khung được vẽ thêm theo mảng đã xong.
   - An: khu rừng thu nhỏ; bấm vào mở tab Khu rừng.

Không có điểm, streak, bảng xếp hạng; không so sánh hai con (SPEC §15).

## 3. Góc học tập (R2, không SQL)

| Phần | Luật |
|---|---|
| Danh sách bên trái | Nhóm: Bài trên lớp · Bài bổ sung · Kỹ năng · Làm trước ★. Kéo ⋮⋮ hoặc bấm ↑↓ để xếp. Thứ tự lưu vào `day_plans` qua `/api/day/plan` (đã có); chỉ để hiển thị, **không đổi khóa/mở**. Kỹ năng nay xếp được cùng bài tập |
| Khung làm bài bên phải | Đề bài / file bố mẹ đính kèm (`homework_items.photo_paths`, đọc qua route file đã có); đồng hồ theo giờ server; nộp ảnh / nhờ bố mẹ xem (như #21, #23); nút Xong |
| Chế độ tập trung | Ẩn danh sách, chỉ còn khung làm bài. Chỉ chạy trên trình duyệt, không ghi gì |
| Nghỉ 10' | Nút ở cuối danh sách; hiện khi đã xong một phần (§1.1, §1.4) |
| "Làm trước" | Bài "Sắp tới" có nút "+ Làm trước"; ngày không có bài đến hạn vẫn bắt buộc 1 bài (§1.5 điểm 3) |

Màn rộng ≥ 1024px chia 2 cột. Màn hẹp hơn: hiện danh sách, bấm vào bài thì khung làm bài mở toàn màn.

## 4. Khu rừng sống của An (R4)

### 4.1 Luật

- **Mảng xong trong ngày → 1 cây của mảng đó.** Tối đa 1 cây mỗi mảng mỗi ngày:

  | Mảng | Có cây khi |
  |---|---|
  | Cảm xúc | Đi hết một lượt ở Góc bình yên. Theo `by_daily_rewards`, hiện là 1/ngày |
  | Học tập | Có `part1_done_at` |
  | Kỹ năng | Có `part2_done_at` |
  | Vui chơi | Có giờ tự do |

- **Ngày đặc biệt:**
  - Học tập / Kỹ năng **chỉ** có cây khi có mốc thật. Ngày dùng thẻ không có cây Học tập / Kỹ năng, nhưng vẫn có cây Vui chơi.
  - Ngày ốm / Tin tưởng / nghỉ lễ: tính theo mốc thật như ngày thường.
  - Phần rỗng được chốt (§1.3) tính là xong.
- **Chọn loài:**
  - Mỗi mảng có danh sách loài theo thứ tự. Lượt trồng thứ *n* của mảng ra loài thứ *n*.
  - Hết danh sách thì **không vòng lại**: các loài đã có lớn thêm ("đã trồng 3 lần").
  - Loài được chọn **lưu lại ngay lúc trồng** (§4.2), nên thêm loài mới vào danh sách không làm đổi cây cũ.
- **Cây Cảm xúc không phụ thuộc con thấy gì.** Ghé là có cây; không có cây "buồn" hay "giận". Người đứng sau màn hình không đoán được cảm xúc từ khu rừng (giống BINH_YEN R4).
- **Con vật đến theo sinh thái.** Mỗi con vật có điều kiện theo đặc điểm của các cây đang có (ong khi có hoa, sóc khi có cây có hạt, ếch khi có ao…). Đã đến thì ở lại.
- **Không có mất mát.** Ngày bỏ lỡ chỉ là không có cây mới. Không héo, không chết, không chuỗi ngày.
- **Thẻ loài:**
  - Gồm tên, hình, một điều thú vị có thật, "Nhiệm vụ ngoài đời" (tùy chọn), "Tối nay dạy cả nhà".
  - v1 chỉ hiển thị, **không lưu** việc đã làm nhiệm vụ hay chưa.
  - Hình đóng gói sẵn trong app, **không** lấy từ trang ngoài (để máy con không gửi yêu cầu tới bên thứ ba).

### 4.2 Lưu ở đâu (sửa theo review)

Không thể tính lại khu rừng từ `by_checkins`. Khi con xóa check-in, hoặc check-in hết hạn 12 tháng, cây sẽ mất và mọi cây sau đổi loài. Như vậy là phạt con vì giữ riêng tư (BINH_YEN D2).

→ **R4 thêm 1 bảng `world_items`.** Bảng này thay cho `by_rewards` dự kiến trong BINH_YEN §2.2.

| Cột | Ý nghĩa |
|---|---|
| `family_id`, `child_id`, `local_date`, `pillar` (`feel` / `study` / `skill` / `play`) | Cây của mảng nào, ngày nào |
| `world_key` | Thế giới của tháng đó (rừng / biển / vũ trụ…) |
| `item_key` | Mã loài (hoặc mã trang truyện) |
| `variant` | Số thứ tự câu thoại / kiểu (§5) |
| `created_at` | |

- Khóa duy nhất `(child_id, local_date, pillar)`, nên hai lượt cùng lúc không trồng 2 cây.
- **Không có cột cảm xúc nào.**
- Ghi bằng route server lúc mảng xong. Bảng này chỉ thêm dòng; xóa check-in không xóa `world_items`.
- **Không grant cho trình duyệt** (giống `by_checkins`); con đọc qua route của phiên con. Mảng `feel` cũng thuộc dữ liệu Góc bình yên nên bố mẹ không đọc.
- Danh sách loài, con vật, điều thú vị nằm trong `lib/world/` (bảng dữ liệu để sau, như `by_catalog`). Danh sách **chỉ thêm**, không xóa mã.

**Bố mẹ chốt 07/11: mỗi tháng một thế giới mới** — khu rừng, biển, vũ trụ… (tháng theo lịch, giờ Việt Nam). Thế giới tháng cũ vào **album**, mở lại xem được.
- Mỗi thế giới có danh sách "loài" riêng theo 4 mảng (rừng: cây / con vật; biển: san hô / cá…; vũ trụ: hành tinh / sao…), cùng luật §4.1: đếm lượt trồng **trong tháng**, không vòng lại, mã đã chọn được lưu.
- `world_items` thêm cột `world_key` (mã thế giới của tháng, ghi lúc trồng), nên đổi thứ tự thế giới sau này không làm đổi album cũ.
- Thế giới của tháng chọn thế nào (con chọn đầu tháng hay theo vòng cố định): hỏi An trước R4.

## 5. Tập của tuần — Nguyên (R5)

### 5.1 Luật

- **Một tập = một tuần (T2–CN).**
  - Tập đánh số từ 1, bắt đầu từ tuần đầu tiên Nguyên dùng màn mới.
  - Bìa gồm "Tập *n*", tên nhân vật, mục lục 7 ngày.
  - Tập **đóng lúc 00:00 thứ Hai** và lên **kệ truyện**. Tối CN tập vẫn mở (cùng lúc với tổng kết tuần).
- **Một trang = một ngày**, ghép từ mã cố định, không có chữ tự do:

| Khung | Có khi | Nội dung |
|---|---|---|
| A · Mở đầu | Đi hết một lượt Góc bình yên (dòng `feel` trong `world_items`) | Nhân vật + bóng thoại (câu số `variant`) + chữ hiệu ứng. **Vùng và từ cảm xúc lấy từ check-in nếu còn**: khi đó mặt, câu thoại theo vùng, "Hồ sơ … · *từ*". Check-in đã xóa / hết hạn thì khung vẫn còn, chỉ hiện "Hôm nay con đã ghé" với mặt bình thường |
| B · Cách xử lý | Check-in còn và có hoạt động đã chọn | Biểu tượng + tên hoạt động, hoặc "Gọi tên là đủ cho hôm nay" |
| C · Nhiệm vụ học | Có `part1_done_at` | "XONG!" + số bài đã xong hôm đó. Phần 1 rỗng: "Hôm nay không có bài" |
| D · Kỹ năng | Có `part2_done_at` | Tên kỹ năng + số phút. Tên lấy theo mẫu việc hiện tại: đổi tên mẫu thì trang cũ cũng đổi (chấp nhận) |
| E · Giờ tự do | Có giờ tự do | Nhân vật cười + **hoạt động chọn từ danh sách** (Vẽ / Đọc truyện / Nghe nhạc / Ra ngoài / …) |

- Khung chưa có thì để ô trống nhẹ: "đang vẽ…" cho hôm nay, "hôm nay chưa xong — không sao" cho ngày cũ. Không trách.
- **Câu thoại:** danh sách theo vùng, chỉ thêm. `variant` được chọn lúc ghi và lưu lại, nên thêm câu mới không làm đổi trang cũ.

### 5.2 Lưu ở đâu

- Dùng `world_items` (R4) + `day_sessions` + `task_runs` + `by_checkins` (chỉ để hiện vùng / từ khi check-in còn).
- Khung E cần lưu hoạt động giờ tự do con chọn (mã cố định).
  - Đề xuất: `day_sessions.free_activity_key`, ghi qua route server. Cột này bố mẹ **đọc được** (theo RLS `day_sessions` hiện tại) — chỉ là hoạt động vui chơi, không phải cảm xúc.
  - Chốt ở R5.

## 6. Nhân vật & biểu tượng (R3)

Theo `docs/BINH_YEN_BIEU_TUONG.md` (PR #41). Nhân vật dùng chung cho Góc bình yên, trang truyện (Nguyên) và khu rừng (An).

- Cần 1 cột: đề xuất `profiles.avatar jsonb`, chỉ chứa mã (kiểu tóc, màu, mắt, da, áo, phụ kiện).
- **Tên nhân vật (≤ 24 ký tự) là ngoại lệ chữ tự do duy nhất.** Cả nhà đọc được (giống tên hiển thị). Màn tạo nhân vật ghi rõ: "Tên này cả nhà đều thấy".
- Trả lời 3 câu hỏi mở của #41 trước khi làm R3.

## 7. Riêng tư — ai thấy gì

| Dữ liệu | Con | Bố mẹ |
|---|---|---|
| Cảm xúc (vùng, từ, mức), hoạt động Góc bình yên | Thấy ở Góc bình yên, Hôm nay (biểu đồ tuần), Tập của tuần (khung A/B) | **Không có trang hay route nào** cho bố mẹ đọc. Chỉ tín hiệu không nội dung như hiện nay |
| Cây / trang đã mở (`world_items`) | Thấy | Không đọc |
| Việc học, kỹ năng, giờ tự do, hoạt động giờ tự do | Thấy | Thấy (như hiện nay) |
| Thứ tự xếp bài (`day_plans`) | Thấy | Đọc được theo RLS hiện tại (không đổi) |
| Nhân vật + tên nhân vật | Thấy | Thấy |

- Dữ liệu cảm xúc tới Hôm nay / Tuần **chỉ qua route server của phiên con** (`requireChild`).
  - **Không** đưa vào `DayState`, `todayView` hay tổng kết tuần, vì trang bố mẹ dùng lại các hàm này.
  - `by_checkins` và `world_items` vẫn không grant cho trình duyệt.
- **Nói thật với con trong "Ai thấy gì?"** (vẫn 3–5 dòng), thêm ý: *"Cảm xúc con chọn hiện ở Hôm nay và Tập của tuần / Khu rừng trên máy con. Ai đứng cạnh màn hình, hoặc đăng nhập bằng tài khoản của con, cũng thấy được."*
  - Lý do: Góc bình yên đã bỏ PIN riêng (#42) và bố mẹ biết mã đăng nhập của con. "Bố mẹ không có trang xem" là đúng, nhưng không phải là khóa kỹ thuật. Đây là lời hứa của gia đình.
- R1–R5 không thêm chữ tự do nào ngoài tên nhân vật. Chữ con viết vẫn để S-BY2 (mã hóa, chỉ trên laptop riêng).

## 8. Quyết định khó đổi về sau

| # | Quyết định | Vì sao khó đổi | Trạng thái |
|---|---|---|---|
| 1 | Bảng ưu tiên §1.2 (nghỉ lên trên LOCK_P1, bỏ BREAK_OFFER) | Đụng luật khóa/mở, thống kê tuần, Tin tưởng | Bố mẹ quyết và duyệt ví dụ 07/11 |
| 2 | "Ngày đạt" cần cả 2 mốc trước giờ ngủ | Đổi định nghĩa là đổi tiến độ Tin tưởng | Bố mẹ duyệt 07/11; các tuần đã qua không đổi (đã kiểm dữ liệu) |
| 3 | Cây / trang đã mở **được lưu** (`world_items`), không tính lại; cảm xúc trong trang chỉ hiện khi check-in còn | Tính lại thì xóa check-in làm mất phần thưởng | Đề xuất (theo BINH_YEN D2) |
| 4 | Danh sách loài / câu thoại chỉ thêm, không xóa mã; mã đã chọn được lưu | Xóa mã làm vỡ khu rừng / truyện cũ | Đề xuất |
| 5 | Cảm xúc hiện trên màn của con; bố mẹ không có trang xem (lời hứa, không phải khóa kỹ thuật) | Thêm trang cho bố mẹ sau này = phá lời hứa với con | Bố mẹ quyết 07/11 |
| 6 | Bỏ BREAK_OFFER, giữ các tên status khác | Extension không phụ thuộc; trang bố mẹ đổi nhãn | Đề xuất |

## 9. Chia lát

| Lát | Nội dung | Database | Xong khi |
|---|---|---|---|
| R0 | Spec này + review độc lập | Không | Bố mẹ duyệt bảng E1–E25 (đã "ok" 07/11) |
| R1 | Luật mới §1 (app + test; extension không đổi) | Không | Test E1–E25 xanh; trên preview bắt đầu được kỹ năng trước bài tập; xong kỹ năng thì nghỉ được dù bài tập chưa xong |
| R2 | Khung 5 tab + Hôm nay mới + Góc học tập | Không | Hai con bấm thử preview trên laptop + iPhone |
| R3 | Nhân vật + biểu tượng (#41) | 1 cột `profiles.avatar` | Con tạo nhân vật và thấy nó ở Góc bình yên |
| R4 | Khu rừng sống (An) | 1 bảng `world_items` | An mở khu rừng, bấm cây / con vật ra thẻ loài |
| R5 | Tập của tuần (Nguyên) | Có thể 1 cột `day_sessions.free_activity_key` | Nguyên lật trang tuần này và xem tập cũ trên kệ |

Mỗi lát là 1 PR; bố mẹ thử preview rồi mới merge. R1 vào trước R2 vì R2 hiển thị theo luật mới.

## 10. Ngoài phạm vi (không làm ở R0–R5)

- Điểm, streak, bảng xếp hạng, đổi điểm lấy giờ chơi.
- So sánh hai con.
- Trang cho bố mẹ xem cảm xúc.
- Chữ tự do (để S-BY2), trừ tên nhân vật.
- Picrew hay dịch vụ bên ngoài nhận dữ liệu của con; hình lấy từ trang ngoài.
- Lưu trạng thái nhiệm vụ ngoài đời của khu rừng.
