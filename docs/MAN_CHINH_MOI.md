# Màn chính mới của con — spec R0

> Trạng thái: **bản nháp chờ bố mẹ duyệt** (07/11/2026). Chỉ tài liệu, không đổi code, không đổi database.
> Nguồn: bản bấm thử hai con đã duyệt (https://claude.ai/artifact/Cr5rqxEEGdiWuMgV5TRYav), canvas (https://claude.ai/artifact/VN6NCVjHRVKuti7qGZ63og), spec biểu tượng PR #41 (`docs/BINH_YEN_BIEU_TUONG.md`), góp ý của hai con 06–07/11.
> Sau khi bố mẹ duyệt, từng lát R1–R5 sẽ cập nhật `SPEC.md` / `DESIGN.md` / `PROGRESS.md` (R0 không sửa các file đó để khỏi đụng PR #42 đang mở).

## 0. Vì sao làm

Hai con góp ý (06/11): muốn vào Góc bình yên trước rồi mới học, muốn thấy biểu đồ cảm xúc cả tuần ngay trang đầu, muốn app có đủ **cảm xúc – học tập – kỹ năng – vui chơi**, muốn có chỗ xếp nhiều bài, kỹ năng không bị khóa, và "thế giới" của mình (Nguyên: tập truyện tranh; An: khu rừng sống). Bố mẹ ưu tiên trải nghiệm của con: con không thấy thoải mái thì con sẽ không dùng.

Quyết định của bố mẹ đã có:

| Ngày | Quyết định |
|---|---|
| 07/11 | Có **Góc học tập** riêng (màn rộng để xếp bài, làm bài). |
| 07/11 | **Kỹ năng mở ngay, làm song song** với bài tập. **Giờ tự do 45' chỉ có sau khi xong cả bài tập và kỹ năng.** |
| 07/11 | **Nghỉ 10' dùng lúc nào cũng được**, vẫn 1 lần/ngày, không bắt buộc. |
| 07/11 | Trang truyện / khu rừng **có cảm xúc của con, hiện trên màn của con** (Hôm nay, Tuần). **Bố mẹ không có trang nào xem.** |
| 07/11 | Thứ tự code: R1 luật mới → R2 Góc học tập → R3–R5. |

## 1. Luật mới (R1) — thay cho DESIGN §5 hiện tại

### 1.1 Bằng lời

- **Phần 1** (bài trên lớp đến hạn + bài bổ sung) và **Phần 2** (kỹ năng) **mở cùng lúc** từ đầu ngày. Con làm theo thứ tự con muốn (SPEC §3 vốn đã cho con "quyền quyết thứ tự 2 phần").
- **Giờ tự do** bắt đầu khi **cả hai phần xong** (hoặc dùng thẻ miễn). Vẫn 45', 1 lần/ngày, dừng ở 00:00.
- **Nghỉ 10'**: con bấm lúc nào cũng được **trước khi có giờ tự do**, 1 lần/ngày, mở mọi trang trong 10'. Không bấm cũng không sao: không còn bước "mời nghỉ" chặn đường.
- Vẫn giữ: 1 việc có giờ tối thiểu chạy một lúc; Xong sớm hơn 20' bị từ chối; bài trên lớp cần ảnh hoặc bố mẹ xác nhận; override mới nhất thắng; mọi khoảng mở dừng ở 00:00; fail-closed.

### 1.2 Bảng ưu tiên mới (từ trên xuống, gặp đúng thì dừng)

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

Khác bản cũ: **BREAK lên trên LOCK_P1** (nghỉ được cả khi chưa xong Phần 1); **bỏ BREAK_OFFER** (không còn bước mời nghỉ); `part2.locked` luôn `false`. Tên status giữ nguyên để extension và trang bố mẹ ít phải đổi.

### 1.3 Mốc ghi lười (milestones)

| Mốc | Ghi khi | Ghi chú |
|---|---|---|
| `part1_done_at` | Phần 1 có việc và đã xong hết; **hoặc** Phần 1 rỗng và giờ tự do vừa bắt đầu | Phần 1 rỗng chưa chốt sớm: bài bố mẹ giao trước lúc có giờ tự do vẫn khóa lại (giữ quyết định 14/10, đổi mốc chốt từ "bấm/bỏ nghỉ" sang "bắt đầu giờ tự do") |
| `part2_done_at` | Phần 2 có việc và đã xong hết (**không cần Phần 1 xong trước**); **hoặc** Phần 2 rỗng và giờ tự do vừa bắt đầu | Kỹ năng bố mẹ bật thêm sau mốc này: hiện ra, không khóa lại (giống bài giao thêm sau Phần 1) |
| `free_started_at` | Cả hai phần xong và **không** đang bị bố mẹ khóa tay | Như cũ: đang khóa tay thì hoãn |
| `break_skipped` | Không ghi nữa | Cột giữ nguyên, ngày cũ vẫn đọc được |

**"Ngày đạt"** (tuần, Tin tưởng): `part1_done_at` **và** `part2_done_at` đều có, đều trước giờ ngủ; hoặc dùng thẻ; hoặc ngày ốm/nghỉ lễ. Ngày cũ luôn có Phần 1 trước Phần 2 nên kết quả các tuần đã qua **không đổi**.

### 1.4 Ví dụ đáp án (bố mẹ xác nhận → thành bài kiểm tra Vitest ở R1)

Ngày mẫu: 2 bài trên lớp đến hạn (Toán, Anh), 1 bài bổ sung 20', 2 kỹ năng 20'. Nghỉ 10', giờ tự do 45', giờ ngủ 21:30.

| # | Tình huống | Đáp án đề xuất |
|---|---|---|
| E1 | 17:00 chưa làm gì, con bấm Bắt đầu kỹ năng "Đọc sách" | **Được** (bản cũ: từ chối). Máy vẫn khóa (LOCK_P1) |
| E2 | Xong cả 2 kỹ năng, bài trên lớp mới xong 1/2 | Khóa (LOCK_P1), chưa có giờ tự do |
| E3 | Xong hết Phần 1, kỹ năng 1/2 | Khóa (LOCK_P2). Không có bước mời nghỉ |
| E4 | 19:00 xong việc cuối cùng (bất kể phần nào) | Giờ tự do 19:00–19:45; 19:45:00 khóa đến hết ngày |
| E5 | 17:05 chưa làm gì, bấm Nghỉ | Mở mọi trang 17:05–17:15; 17:15:00 khóa lại (LOCK_P1) |
| E6 | Đã nghỉ rồi, bấm Nghỉ lần 2 | Từ chối: "Hôm nay con đã nghỉ rồi" |
| E7 | Đang chạy đồng hồ kỹ năng, bấm Nghỉ | **Từ chối**: "Bấm Xong việc đang làm trước" (để 10' nghỉ không tính vào 20' của kỹ năng) — *cần bố mẹ chốt* |
| E8 | Đang nghỉ, bấm Bắt đầu / Xong một việc | **Từ chối**: "Đang nghỉ — bấm Học tiếp để làm tiếp". Bấm Học tiếp → hết nghỉ ngay, làm tiếp được — *cần bố mẹ chốt* |
| E9 | Cả ngày không nghỉ | Không sao; xong hết → giờ tự do luôn |
| E10 | Đã có giờ tự do, bấm Nghỉ | Từ chối (nút ẩn) |
| E11 | 23:55 bấm Nghỉ | Mở đến 00:00, không cộng sang hôm sau |
| E12 | Bố mẹ đang khóa tay, con bấm Nghỉ | Từ chối (nút ẩn): "Bố mẹ đang khóa máy" |
| E13 | Máy đang mở sẵn (Tin tưởng / ngày ốm / bố mẹ mở) | Nút Nghỉ ẩn (không tốn lượt nghỉ) |
| E14 | Ngày không có kỹ năng; 18:00 xong Phần 1 | Giờ tự do 18:00–18:45 |
| E15 | 06:00 chưa có bài trên lớp, không có bài bổ sung; 07:00 con xong kỹ năng | Giờ tự do 07:00. Bài bố mẹ giao lúc 17:00 hiện ra, **không khóa lại** — *giống hiện nay* (bản cũ con chỉ cần bỏ qua nghỉ là có kết quả tương tự) |
| E16 | Như E15 nhưng bố mẹ giao bài lúc 06:30 (trước khi con xong kỹ năng) | Khóa lại (LOCK_P1) đến khi xong bài đó |
| E17 | Bố mẹ giao thêm bài sau khi con xong Phần 1, kỹ năng chưa xong | Bài hiện ra, **không chặn** giờ tự do (như cũ) |
| E18 | Xong kỹ năng 18:00, xong bài trên lớp 22:00 | Giờ tự do 22:00–22:45. **Không** tính "ngày đạt" (Phần 1 sau 21:30) |
| E19 | Ngày không có bài đến hạn, có bài "Sắp tới" | Theo cài đặt `homework_min_upcoming` (hiện = 1: phải làm trước 1 bài mới đủ Phần 1) — *cần bố mẹ chốt, xem §1.5* |
| E20 | Có bài đến hạn, con bấm "+ Làm trước" bài tuần sau | Không bắt buộc, không chặn giờ tự do; xong sớm ≥ 2 ngày được ★ (chỉ ghi nhận) |
| E21 | Thẻ miễn | Như cũ: dùng được khi còn thẻ và chưa có giờ tự do, không dùng khi bố mẹ khóa tay |

### 1.5 Ba điểm cần bố mẹ chốt trước khi code R1

1. **E7 – nghỉ khi đang chạy đồng hồ:** đề xuất **từ chối** (phút tối thiểu = giờ Xong − giờ Bắt đầu, nếu cho nghỉ giữa chừng thì 10' nghỉ được tính là 10' kỹ năng). Cách khác: cho nghỉ, đồng hồ việc dừng lại (phải thêm cột, phức tạp hơn).
2. **E8 – trong lúc nghỉ:** đề xuất khóa các nút việc, chỉ còn "Học tiếp".
3. **E19 – "Làm trước" ngày không có bài đến hạn:** bản bấm thử để "Làm trước" hoàn toàn tùy ý. Luật hiện tại (chốt 17/10) bắt làm trước 1 bài vào ngày không có bài đến hạn. Không cần sửa code: bố mẹ chọn **giữ 1** hoặc **đặt 0** trong Thêm › Luật trong nhà.

### 1.6 Ảnh hưởng khi code R1 (không SQL)

| Chỗ | Đổi gì |
|---|---|
| `lib/dayState.ts` | Bảng ưu tiên §1.2, mốc §1.3, "ngày đạt", diễn giải 1/2/8/15 viết lại; bỏ `BREAK_OFFER`; `break.state` = `offer` khi còn lượt và chưa có giờ tự do |
| `lib/today/rules.ts` | `decideStart`: bỏ chặn Phần 2; chặn khi đang nghỉ (E8). `decideBreak`: cho nghỉ khi E5, từ chối E6/E7/E10/E12/E13 |
| `/api/day/break` | Bỏ `skip`; `start` / `end` giữ nguyên |
| `lib/today/view.ts`, `today-screen.tsx`, `lib/today/week.ts` | Chữ banner; bỏ "🔒 mở khi xong Phần 1"; kế hoạch được xếp cả kỹ năng |
| `lib/parent/overview.ts` | Nhãn: LOCK_P1 "Đang học", LOCK_P2 "Còn kỹ năng"; bỏ nhãn BREAK_OFFER |
| `lib/binhYen/studyCap.ts` | Chỉ sửa chú thích (giờ nghỉ là máy mở → không giới hạn 10' Góc bình yên, như cũ) |
| Extension | **Không đổi logic**: extension chỉ đọc `open` + `openUntil`. Nghỉ giữa giờ học = một khoảng mở bình thường. Không cần cài lại |
| Tài liệu | DESIGN §5, SPEC §2.6 (dòng "Phần 2 không bấm Bắt đầu được…"), SPEC §3 sơ đồ luồng, SPEC §18 log |
| Test | Mỗi dòng bảng §1.2 + E1–E21 + biên: đúng giây hết 10', hết 45', qua 00:00; ngày cũ (có `break_skipped`) vẫn tính đạt như trước |

## 2. Khung màn của con (R2)

### 2.1 Năm tab dưới cùng (điện thoại) / cột trái (laptop)

| Tab | Nguyên | An | Nội dung |
|---|---|---|---|
| 1 | Hôm nay | Hôm nay | Trang đầu (§2.2) |
| 2 | Góc học tập | Góc học tập | §3 |
| 3 | Góc bình yên | Góc bình yên | Như hiện tại (S-BY1, không PIN sau #42) |
| 4 | Tập của tuần | Khu rừng | §5 / §4 |
| 5 | Góp ý | Góp ý | Thích / Chưa thích / Ý tưởng (#42) |

Dòng "Con đang ở: Hôm nay › Góc học tập › Toán" ở đầu mỗi màn; nút quay lại luôn cùng chỗ. Nút cao ≥ 44px. Màu Nguyên `#2F5D9E`, An `#B85A1C`.

### 2.2 Trang Hôm nay (thứ tự từ trên xuống)

1. **Chào + nút Góc bình yên to nhất** ("Hôm nay con thấy thế nào?"). Chỉ là lời mời, **không bao giờ chặn** việc học.
2. **Biểu đồ cảm xúc tuần** (T2 → hôm nay): mỗi ngày một ô màu vùng (đỏ/vàng/xanh dương/xanh lá) + biểu tượng từ. Ngày không ghé = ô trống, không có chữ trách.
3. **Bốn mảng hôm nay**: Cảm xúc · Học tập · Kỹ năng · Vui chơi — mỗi mảng một thẻ: đã làm gì, còn gì, nút đi tiếp ("Vào Góc học tập", "Bắt đầu kỹ năng").
4. **Trạng thái máy + đồng hồ** (khóa / đang nghỉ đến … / giờ tự do đến …), nút Nghỉ 10' (khi được phép, §1.4), nút thẻ miễn (như cũ).
5. **Thế giới của con**: Nguyên — trang truyện hôm nay (khung vẽ thêm theo mảng đã xong); An — khu rừng thu nhỏ, bấm vào mở tab Khu rừng.

Không có điểm, streak, bảng xếp hạng; không so sánh hai con (SPEC §15).

## 3. Góc học tập (R2, không SQL)

| Phần | Luật |
|---|---|
| Danh sách bên trái | Nhóm: Bài trên lớp · Bài bổ sung · Kỹ năng · Làm trước ★. Kéo ⋮⋮ hoặc ↑↓ để xếp; thứ tự lưu vào `day_plans` qua `/api/day/plan` (đã có, chỉ để hiển thị, **không đổi khóa/mở**). Kỹ năng nay xếp được cùng bài tập |
| Khung làm bài bên phải | Đề bài / file bố mẹ đính kèm (`homework_items.photo_paths`, đọc qua route file đã có), đồng hồ (giờ server), nộp ảnh / nhờ bố mẹ xem (như #21, #23), nút Xong |
| Chế độ tập trung | Ẩn danh sách, chỉ còn khung làm bài. Chỉ ở trình duyệt, không ghi gì |
| Nghỉ 10' | Nút ở cuối danh sách, theo §1.4 |
| "Làm trước" | Bài "Sắp tới" có nút "+ Làm trước"; luật bắt buộc theo §1.5 điểm 3 |

Màn rộng ≥ 1024px: 2 cột; hẹp hơn: danh sách → bấm vào bài mở khung làm bài toàn màn.

## 4. Khu rừng sống của An (R4)

### 4.1 Luật dữ liệu

- **Cây mọc theo mảng xong trong ngày**: Cảm xúc (ghé Góc bình yên và chọn cảm xúc), Học tập (Phần 1 xong), Kỹ năng (Phần 2 xong), Vui chơi (có giờ tự do). Mỗi mảng xong = 1 lượt trồng của mảng đó.
- **Loài cây**: mỗi mảng có danh sách loài cố định, theo thứ tự; lượt trồng thứ *n* của mảng ra loài thứ *n* (vòng lại khi hết). Loài đã có thì cây đó lớn thêm ("đã trồng 3 lần").
- **Cây Cảm xúc không phụ thuộc con thấy gì**: ghé là có cây, không có cây "buồn" hay "giận" → người đứng sau màn hình không đoán được cảm xúc từ khu rừng.
- **Con vật đến theo sinh thái**: mỗi con vật có điều kiện theo đặc điểm cây đang có (ong khi có hoa, sóc khi có cây có hạt, ếch khi có ao…). Đã đến thì ở lại.
- **Không có mất mát**: ngày bỏ lỡ chỉ là không có cây mới. Không héo, không chết, không chuỗi ngày.
- **Thẻ loài**: tên, ảnh/biểu tượng, một điều thú vị có thật, "Nhiệm vụ ngoài đời" (tùy chọn), "Tối nay dạy cả nhà". v1 chỉ hiển thị, **không lưu** đã làm nhiệm vụ hay chưa.
- **Danh sách loài chỉ được thêm, không đổi thứ tự / không xóa** (nếu không khu rừng cũ sẽ tự đổi).

### 4.2 Nguồn dữ liệu và lưu trữ

Khu rừng **tính lại từ dữ liệu đã có** (`day_sessions` cho Học tập / Kỹ năng / Vui chơi, `by_checkins` cho Cảm xúc) + danh mục loài trong code (`lib/world/forest.ts`). **Không cần bảng mới.**

*Điểm chờ hỏi An (trước R4):* khu rừng gom **cả năm** hay mỗi **mùa / tháng** một khu rừng mới (khu rừng cũ vào "album")? Đề xuất: mỗi tháng một khu rừng, album giữ 12 tháng (khớp hạn giữ dữ liệu Góc bình yên 12 tháng).

## 5. Tập của tuần — Nguyên (R5)

### 5.1 Luật dữ liệu

- **Một tập = một tuần (T2–CN)**. Bìa: "Tập *n*", tên nhân vật, mục lục 7 ngày (biểu tượng từ cảm xúc).
- **Một trang = một ngày**, ghép từ mã cố định, không chữ tự do:

| Khung | Có khi | Nội dung |
|---|---|---|
| A · Mở đầu | Ghé Góc bình yên | Mặt nhân vật theo vùng, bóng thoại theo vùng (danh sách câu cố định), chữ hiệu ứng, "Hồ sơ … · *từ cảm xúc*" |
| B · Cách xử lý | Có hoạt động đã chọn | Biểu tượng + tên hoạt động (hoặc "Gọi tên là đủ cho hôm nay") |
| C · Nhiệm vụ học | Phần 1 xong | "XONG!" + bài hôm nay |
| D · Kỹ năng | Phần 2 xong | Tên kỹ năng + số phút |
| E · Giờ tự do | Có giờ tự do | Nhân vật cười + **hoạt động chọn từ danh sách** (Vẽ / Đọc truyện / Nghe nhạc / Ra ngoài / …) |

- Khung chưa có = ô trống nhẹ ("đang vẽ…" hôm nay; "hôm nay chưa xong — không sao" ngày cũ). Không trách.
- **Tối Chủ nhật tập đóng lại**, lên **kệ truyện**; mở lại xem được. Kệ giữ 12 tháng (cùng hạn Góc bình yên).

### 5.2 Nguồn dữ liệu và lưu trữ

Tính lại từ `by_checkins` + `day_sessions` + `task_runs`. **Có thể cần 1 cột** cho khung E: hoạt động giờ tự do con chọn (mã cố định), ví dụ `day_sessions.free_activity_key` ghi qua route server. Chốt ở R5.

## 6. Nhân vật & biểu tượng (R3)

Theo `docs/BINH_YEN_BIEU_TUONG.md` (PR #41). Nhân vật dùng chung cho Góc bình yên, trang truyện (Nguyên) và khu rừng (An). Cần 1 cột lưu nhân vật (đề xuất `profiles.avatar jsonb`, chỉ mã: kiểu tóc, màu, mắt, da, áo, phụ kiện, tên ≤ 24 ký tự) — trả lời 3 câu hỏi mở của #41 trước R3.

## 7. Riêng tư — ai thấy gì

| Dữ liệu | Con | Bố mẹ |
|---|---|---|
| Cảm xúc (vùng, từ, mức), hoạt động chọn | Thấy ở Góc bình yên, Hôm nay (biểu đồ tuần), Tập của tuần, khu rừng (chỉ "đã ghé") | **Không có trang nào**, không route nào cho bố mẹ đọc. Chỉ tín hiệu không nội dung như hiện nay |
| Việc học, kỹ năng, giờ tự do | Thấy | Thấy (như hiện nay) |
| Thứ tự xếp bài, chế độ tập trung | Thấy | Không cần (thứ tự lưu `day_plans`, bố mẹ đọc được theo RLS hiện tại — không đổi) |
| Nhân vật | Thấy | Thấy biểu tượng con chọn (như `profiles.icon`) |

- Dữ liệu cảm xúc tới màn Hôm nay / Tuần **chỉ qua route server của phiên con** (`requireChild`), service_role phía server; `by_checkins` vẫn không grant cho trình duyệt.
- **Sửa "Ai thấy gì?"** trong Góc bình yên (vẫn 3–5 dòng), thêm ý: *"Cảm xúc con chọn cũng hiện ở trang Hôm nay và Tập của tuần / Khu rừng trên máy của con — ai đứng cạnh màn hình con cũng thấy được."*
- Không chữ tự do mới ở R1–R5. Chữ con viết vẫn để S-BY2 (mã hóa, chỉ trên laptop riêng).

## 8. Quyết định khó đổi về sau (one-way door)

| # | Quyết định | Vì sao khó đổi | Chốt |
|---|---|---|---|
| 1 | Bảng ưu tiên §1.2 (nghỉ lên trên LOCK_P1, bỏ BREAK_OFFER) | Đụng luật khóa/mở, thống kê tuần, Tin tưởng | Bố mẹ quyết 07/11; ví dụ E1–E21 chờ xác nhận |
| 2 | "Ngày đạt" cần cả 2 mốc trước giờ ngủ | Đổi định nghĩa làm đổi tiến độ Tin tưởng | Đề xuất; ngày cũ không đổi kết quả |
| 3 | Thế giới của con **tính lại từ dữ liệu**, không chụp lại | Nếu sau này cần giữ lâu hơn 12 tháng phải thêm bảng chụp | Đề xuất; thêm bảng sau vẫn được (chỉ thêm) |
| 4 | Danh sách loài cây / câu thoại chỉ thêm, không sửa thứ tự | Sửa thứ tự làm đổi khu rừng / truyện cũ | Đề xuất (quy tắc cho người viết code) |
| 5 | Cảm xúc hiện trên màn của con, bố mẹ không có trang xem | Thêm trang cho bố mẹ sau = phá lời hứa với con | Bố mẹ quyết 07/11 |
| 6 | Tên status giữ nguyên | Đổi tên phải sửa extension + trang bố mẹ | Đề xuất |

## 9. Chia lát

| Lát | Nội dung | Database | Xong khi |
|---|---|---|---|
| R0 | Spec này + review độc lập | Không | Bố mẹ duyệt E1–E21 và 3 điểm §1.5 |
| R1 | Luật mới §1 (app + test; extension không đổi) | Không | Test E1–E21 xanh; preview: bắt đầu kỹ năng trước bài tập, nghỉ lúc 17:05 |
| R2 | Khung 5 tab + Hôm nay mới + Góc học tập | Không | Hai con bấm thử preview trên laptop + iPhone |
| R3 | Nhân vật + biểu tượng (#41) | 1 cột `profiles` | Con tạo nhân vật, thấy ở Góc bình yên |
| R4 | Khu rừng sống (An) | Không (đề xuất) | An mở khu rừng, bấm cây / con vật ra thẻ loài |
| R5 | Tập của tuần (Nguyên) | Có thể 1 cột | Nguyên lật trang tuần này + tập cũ trên kệ |

Mỗi lát 1 PR, bố mẹ thử preview rồi mới merge. R1 nên vào trước R2 vì R2 hiển thị theo luật mới.

## 10. Ngoài phạm vi (không làm ở R0–R5)

Điểm, streak, bảng xếp hạng, đổi điểm lấy giờ chơi · so sánh hai con · trang cho bố mẹ xem cảm xúc · chữ tự do (để S-BY2) · Picrew / dịch vụ bên ngoài nhận dữ liệu của con · lưu trạng thái nhiệm vụ ngoài đời của khu rừng.
