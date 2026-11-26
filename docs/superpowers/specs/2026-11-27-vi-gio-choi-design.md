# Ví giờ chơi — kiếm giờ chơi bằng học thật (design)

- **Ngày:** 27/11/2026. Bố mẹ duyệt hướng đi trong chat Project C (00:03–00:43, 27/11): "ok đồng ý đề xuất".
- **Nguồn:** handover từ Xưởng ôn tập (E) ngày 26/11 ("Hoạt động học hằng ngày, luật 2/3, đếm chủ đề"); review mức dùng iPad của bố mẹ; hai con đã đồng ý khóa các trang không liên quan đến học.
- **Đây là đổi luật khóa/mở và luật thưởng** (DESIGN §5, SPEC §15). Bố mẹ yêu cầu rõ ràng. Luật và ví dụ mẫu dưới đây là nguồn sự thật cho các lát V1–V5.
- **Base:** `main` sau PR #112 (SQL 0029 `study_apps`, 0030).
- Tài liệu này **chưa** sửa SPEC / DESIGN / PROGRESS / CLAUDE.md. Từng lát cập nhật phần của mình, giống R8.

---

## 1. Vì sao làm

Theo thứ tự bố mẹ ưu tiên:

1. **Con còn nhiều giờ trống**, chủ yếu trên iPad: đọc truyện trên web, chat với nhân vật AI (Character.ai và các trang tương tự). Hai con đã đồng ý: các trang không liên quan đến học bị khóa; **giờ chơi phải kiếm bằng việc học thật**. Hai con **thích** ý này. Mục tiêu là động lực tự học và thói quen học.
2. **Con được chọn môn** con muốn học vào lúc đó.
3. **Luật tính đúng/sai để được giờ chơi phải chặt**: con không lách được bằng cách ngồi không, đoán mò hay làm lại tới khi đúng.

Mục tiêu phụ từ handover E: con thấy app ôn tập ở Hôm nay mà bố mẹ không phải tạo mẫu việc cho từng app; về sau đếm được chủ đề con đã làm được.

## 2. Mục tiêu · Không làm · Thất bại nếu

| Mục tiêu | Không làm (lần này) | Coi là thất bại nếu |
|---|---|---|
| Một **ví giờ chơi** duy nhất, con thấy rõ "học → kiếm phút" | App iOS / Android riêng để tự khóa iPad, Boox | Con kiếm được phút mà không học thật (ngồi không, đoán, làm lại) |
| Phút chỉ được cộng khi **máy chủ chấm** bài kiểm tra cuối phiên | Điểm số, chuỗi ngày, bảng xếp hạng, so sánh hai con (SPEC §15 vẫn cấm) | Tổng giờ chơi mỗi ngày **tăng** so với hiện nay mà con không học thêm |
| Con chọn cửa vào và chủ đề | Gia sư AI, English OS phải đổi gì (chỉ đọc nếu họ gửi được) | Bố mẹ phải bấm hoặc nhập tay nhiều hơn vài lần mỗi ngày |
| Tiêu ví được trên **laptop** (tự động), **iPad** và **Boox** (bố mẹ duyệt 1 chạm) | Đổi luật Góc bình yên, Thế giới của An, Truyện của Nguyên | Con căng thẳng vì kiểm tra; ngày khó (ốm, thi, nhiều bài) thành ngày "trắng tay" |
| Chặn hẳn Character.ai và các trang chat với nhân vật AI | Trả phí dịch vụ ngoài | Luật đổi giữa mùa thi HK1 |

## 3. Các hướng đã cân nhắc (bố mẹ chọn ②)

| Hướng | Cách chạy | Vì sao không / vì sao chọn |
|---|---|---|
| ① Thưởng thêm trên luật cũ | Giữ 45′ tự do + ngân hàng giờ nghỉ + Ôn 10′, cộng thêm phút cho phiên đạt | 3 nguồn thưởng chồng nhau, con khó hiểu; tổng giờ chơi tăng, ngược mục tiêu 1 |
| **② Ví giờ chơi tích lũy** ⭐ | Mọi phút chơi gom vào 1 ví: nạp khi học đạt + một **nền nhỏ** khi xong việc bắt buộc; con chọn lúc tiêu, dồn được tới cuối tuần | Đúng ý "tích lũy"; con tự quyết; nền nhỏ giữ ngày khó không trắng tay. **Bố mẹ chọn 27/11** |
| ③ Kiếm hoàn toàn, không nền | Mọi phút đều phải kiếm | Ngày ốm / thi / nhiều bài → 0 phút → con nản |

Bên trong ②, hai lựa chọn cách làm (quyết định của người thiết kế, xem §12):

| Chấm bài kiểm tra ở đâu | Chọn | Lý do |
|---|---|---|
| a. Trong app ôn tập (tệp .html), app gửi "đạt/không" về | ✗ | App chạy trên máy con, con sửa được kết quả trước khi gửi |
| **b. Launcher giữ ngân hàng câu, máy chủ bốc câu, chấm, giữ đáp án** | ✓ | Đáp án không bao giờ xuống máy con → không giả được. Trang `/on-tap` vẫn **không có mạng** ở Đợt 1 |

## 4. Đã chốt với bố mẹ (27/11)

| # | Quyết định |
|---|---|
| D1 | Hướng ② Ví giờ chơi. Ví **thay** giờ tự do 45′ cố định và Ôn 10′ (Ôn 10′ đang cộng tay từ 25/11, dừng khi ví bật) |
| D2 | Phiên học 1 chủ đề **≥ 20′** + kiểm tra đạt **≥ 60%** → **+8′**; phiên **≥ 45′** + đạt → **+15′** (không cộng thành 8 + 15) |
| D3 | Kiểm tra cuối phiên: **5 câu** = 3 câu chủ đề vừa học + 2 câu chủ đề cũ, bốc ngẫu nhiên; đạt = **≥ 3/5 ở lần trả lời đầu**. Không đạt → +0′; học thêm ≥ 10′ thì được 1 bài kiểm tra khác (câu mới) |
| D4 | App chưa có ngân hàng câu (English OS, App Toán hiện nay): đủ 20′ → +8′, **tối đa 1 phiên/ngày** kiểu này |
| D5 | Nền **+20′** khi xong việc bắt buộc. Kiếm tối đa **60′/ngày**. Ví tối đa **120′**. Tiêu tối đa **60′/ngày T2–T6**, **120′/ngày T7–CN**. Hết hạn **23:59 CN**, giữ sang tuần sau tối đa **30′** |
| D6 | Chỉ tiêu được **sau khi xong việc bắt buộc**; mỗi lần ≥ 5′; không tiêu trong giờ ngủ / khóa đêm; dừng sớm thì cất phần còn lại |
| D7 | Ngân hàng giờ nghỉ (R8b) **giữ** cho nghỉ ngắn giữa giờ; phút nghỉ chưa dùng **đổ vào ví** thay vì cộng vào giờ tự do |
| D8 | Chủ đề con đã "làm được" chỉ thưởng **một nửa** (khi có trạng thái kỹ năng, Đợt 2) |
| D9 | **iPad:** Screen Time kiểu "chỉ mở trang đã duyệt" (giống laptop), **gỡ Chrome**, chỉ dùng Safari. "Luôn cho phép": Zalo (cả ngày), Tin nhắn, Điện thoại, **Spotify**, Launcher, app học, Google Docs/Drive/Meet. Trang truyện: giới hạn 1′/ngày, mở bằng ví. Tiêu ví theo **khối 15′**, bố mẹ duyệt "Xin thêm giờ" |
| D10 | **Boox:** khóa hết, chỉ mở khi đã xong bài; tiêu ví qua Google Family Link (nếu Boox nhận) hoặc bố mẹ giữ máy |
| D11 | **Character.ai và các trang chat nhân vật AI: chặn hẳn**, không mở bằng ví. Character.AI đã bỏ chat mở cho người dưới 18 từ 25/11/2025 |
| D12 | **Spotify** luôn mở (iPad + laptop) để con nghe nhạc khi học. Không dùng YouTube / YouTube Music cho nhạc |
| D13 | **Bắt đầu sau thi HK1.** Trước đó chỉ làm phần chặn Character.ai + Spotify (V1) và bản bấm thử cho 2 con |
| D14 | Ba cửa vào mỗi ngày: **Tiếng Anh · Toán · Ôn chủ đề**; xong **2/3** là đủ phần hoạt động (ý bố mẹ 26/11, handover E). Con tự chọn |

## 5. Luật bằng lời

### 5.1 Việc bắt buộc của ngày

- Việc bắt buộc = **Phần 1 + Phần 2 như hôm nay** (bài trên lớp đến hạn, bài bổ sung, kỹ năng; luật R1 giữ nguyên).
- Từ lát V4: bài bổ sung có gắn **cửa vào** (`door`) được thay bằng nhóm **Hoạt động**: xong khi đủ `doors_required` (mặc định 2) cửa **khác nhau** đã xong hôm nay. Một cửa xong = một phiên ≥ tối thiểu của cửa (mặc định 20′) như bài bổ sung hôm nay.
- "Xong việc bắt buộc" = có **cả hai mốc** `part1_done_at` và `part2_done_at` (như hôm nay), hoặc dùng thẻ miễn.

### 5.2 Phiên học

- Một phiên = một `task_run` có **chủ đề**: app ôn tập (`study_apps`) con chọn, hoặc app của môn (English OS, App Toán). Có hai cách bắt đầu:
  - **Việc mẫu** (bài bổ sung hôm nay, sau V4 là cửa vào): con chọn chủ đề lúc bấm Bắt đầu. Mặc định chọn sẵn app trong `deep_link` của mẫu (`/on-tap/<slug>`), hoặc app của môn.
  - **Phiên tự chọn** (từ V3): bất kỳ lúc nào, kể cả T7–CN và ngày lễ không có mẫu việc, con bấm "Học một chủ đề" ở Góc học tập hoặc `/on-tap`, chọn chủ đề. Phiên này **không** tính vào việc bắt buộc, chỉ để kiếm phút. Đây là chỗ con "chọn môn muốn học lúc đó" (ưu tiên 2).
- Mẫu việc **không phải môn học** (kỹ năng như nhạc cụ, thể thao, nếu sau này có) không kiếm phút và không dùng suất "không kiểm tra". Hiện chưa có mẫu kỹ năng nào.
- **Phút phiên** = thời gian từ Bắt đầu đến Xong theo **giờ máy chủ**, **trừ** các khoảng: đang nghỉ (R8b), đang PLAY, một khối tiêu ví iPad / Boox (từ lúc ghi `spend` đến + số phút), bố mẹ đang mở máy. Tối đa `break_run_cap_minutes` (180′). Giống cách R8b tính giờ tập trung.
- Đang có việc có giờ chạy thì **không** bắt đầu PLAY hay tiêu ví iPad / Boox được, và ngược lại (giống luật nghỉ R8b).
- Mỗi lúc vẫn chỉ 1 việc có giờ chạy.
- Bài trên lớp **không** là phiên kiếm phút: không có tối thiểu và không kiểm tra được. Bài trên lớp chỉ góp vào "xong việc bắt buộc" (nền +20′).
- Lượt "Làm thêm" (R8a) của một việc đã xong vẫn là phiên kiếm phút bình thường.

### 5.3 Kiểm tra nhanh (cuối phiên)

- Con bấm **Xong**. Nếu phút ≥ bậc thấp nhất (20′) **và** chủ đề có ngân hàng câu → máy chủ tạo một **lượt kiểm tra**.
- Máy chủ bốc **5 câu**:
  - 3 câu từ ngân hàng của chủ đề vừa học.
  - 2 câu từ **chủ đề khác** mà con đã có phiên trong 30 ngày qua (bất kỳ môn). Không đủ thì bốc thêm từ chủ đề vừa học.
  - Tránh câu con đã gặp trong 7 ngày qua, nếu ngân hàng còn đủ câu.
- Câu gửi xuống **không kèm đáp án**. Con trả lời cả 5 câu rồi bấm Nộp **một lần**. Hết **10′** mà chưa nộp → chấm phần đã trả lời, câu trống tính sai.
- Máy chủ chấm. **Đạt** khi đúng ≥ `quiz_pass` (3) trên `quiz_size` (5).
- Đạt → cộng phút theo bậc (§5.4). Không đạt → +0′. Màn hiện câu nào sai + lời giải (nếu ngân hàng có), **không** hiện điểm số kiểu "60 điểm".
- **Thử lại:** tối đa **2 lượt kiểm tra mỗi phiên**. Lượt 2 chỉ mở sau khi con bấm "Học thêm" và học thêm ≥ 10′. Lượt 2 dùng câu mới.
- **"Học thêm"** tạo một **đoạn mới**: một `task_run` mới cùng chủ đề, có `session_run_id` trỏ về lượt đầu (giống R8a "Làm thêm"). Lượt đầu **không** bị mở lại: `done_at` giữ nguyên, nên mốc phần, việc đã xong và ngân hàng giờ nghỉ không đổi. Phút của phiên = tổng phút các đoạn (theo luật trừ ở §5.2); thời gian làm kiểm tra và khoảng nghỉ giữa hai đoạn **không** tính. Bậc thưởng của lượt 2 tính theo tổng đó.
- Phiên < 20′: không kiểm tra, +0′ (vẫn ghi phút như hôm nay).
- Chủ đề **không có ngân hàng câu**: không kiểm tra; phiên ≥ 20′ được +8′ nếu hôm nay chưa có phiên "không kiểm tra" nào được cộng (D4). Phiên ≥ 45′ không kiểm tra vẫn chỉ được +8′.

### 5.4 Bậc thưởng

- `tiers` mặc định `[[20, 8], [45, 15]]`: phiên đạt được phút của **bậc cao nhất** mà phút phiên ≥ mốc.
- D8 (Đợt 2): chủ đề đã "làm được" → phút bậc × 0,5, làm tròn xuống.
- **Trần kiếm ngày** (`earn_cap_day`, 60′) tính trên: phút từ phiên + phút nghỉ chưa dùng (D7). **Nền không tính** vào trần. Vượt trần → chỉ cộng phần còn lại; màn hiện "Hôm nay con đã kiếm đủ 60′".
- **Trần ví** (`balance_cap`, 120′): vượt thì phần dư mất; màn hiện "Ví đầy".

### 5.5 Nạp nền và phút nghỉ chưa dùng

- Lần đọc đầu tiên thấy **xong việc bắt buộc** (cùng chỗ đang ghi mốc phần) → ghi 1 dòng `base` +20′ cho ngày đó (một lần mỗi ngày).
- Cùng lúc đó → ghi 1 dòng `break_leftover` = phút còn trong ngân hàng giờ nghỉ (nếu > 0), trong trần kiếm ngày. Từ lúc này ngân hàng giờ nghỉ không tích thêm cho ngày đó, vì con đã tiêu được ví.
- Ngày **không có việc nào** (cả hai phần rỗng; ví dụ ngày lễ không có mẫu việc): nền ghi ở lần đọc đầu tiên **sau khóa đêm**. Không cần nút "Bắt đầu giờ tự do" nữa, vì ví là số dư chứ không phải đồng hồ chạy.
- **Thẻ miễn**: coi như xong việc bắt buộc hôm nay → nền +20′. Vẫn tối đa 1 thẻ/tuần, không dùng sau khi đã xong việc bắt buộc.

### 5.6 Tiêu ví

| Máy | Con bấm | Máy chủ làm | Hoàn lại |
|---|---|---|---|
| **Laptop** | "Chơi" → chọn 15′ / 30′ / 45′ / tất cả (trong trần) | Ghi lượt tiêu `spend` (−phút định dùng); máy mở đến hết (`PLAY`) | Bấm "Dừng chơi", bố mẹ khóa tay, tới giờ dừng chơi → phần chưa dùng ghi `refund`. Phút đã dùng làm tròn **lên** |
| **iPad** | "Dùng 15′ trên iPad" | Ghi `spend` −15′, đánh dấu máy `ipad`; báo đẩy bố mẹ "Nguyên dùng 15′ ví cho iPad · còn X′" | Không tự hoàn (Launcher không biết bố mẹ đã duyệt Screen Time chưa). Bố mẹ bấm **"Chưa duyệt · hoàn lại"** trong hôm nay |
| **Boox** | "Dùng 15′ trên Boox" | Như iPad, máy `boox` | Như iPad |

- Điều kiện tiêu: đã xong việc bắt buộc; còn ≥ số phút muốn dùng; chưa vượt trần tiêu ngày (T2–T6 60′, T7–CN 120′; tính **tiêu ròng** = tiêu − hoàn); không có việc có giờ đang chạy; trước **giờ dừng chơi**; trên laptop còn ≥ 5′ trước giờ dừng chơi. Trên laptop chỉ 1 lượt chơi chạy một lúc.
- **Giờ dừng chơi** = `profiles.bedtime` của con (hiện cả hai con 22:30), không bao giờ muộn hơn khóa đêm / 00:00. Lượt chơi laptop bị cắt ở giờ này; iPad / Boox không tiêu được sau giờ này. *Bố mẹ xác nhận 27/11 — xem §13 O7.* Đây là thay đổi so với hiện nay: giờ tự do 45′ đang chạy được tới 00:00.
- Laptop đang mở vì lý do khác (Tin tưởng, ngày ốm, bố mẹ mở): **ẩn** nút "Chơi" trên laptop; iPad / Boox vẫn tiêu được.
- **Luật cho bố mẹ (một câu):** *có yêu cầu "Xin thêm giờ" trên iPad / Boox mà không có thông báo ví đi kèm thì không duyệt.*

### 5.7 Tuần và hạn dùng

- Tuần T2–CN, giờ VN. Lần đọc đầu tiên trong tuần mới: ghi `carry` (giữ tối đa `carry_max` 30′) và `expire` (phần còn lại, số âm) cho tuần cũ. Không cần cron.
- Tổng kết tuần tối T6 (đã có) thêm 1 dòng: "Tuần này con học N chủ đề, kiếm X′, tiêu Y′". Không xếp hạng, không so sánh hai con, không chuỗi ngày.

### 5.8 Bật / tắt và giữ luật cũ

- Ví bật theo **từng con** từ ngày `enabled_from` (bố mẹ đặt ở **Thêm › Ví giờ chơi**). Trước ngày đó, hoặc khi để trống: **luật cũ nguyên vẹn** (45′ tự do, ngân hàng giờ nghỉ cộng vào giờ tự do, FREE_READY).
- Ngày ví bật, `free_minutes` không còn tác dụng cho con đó; cột giữ nguyên (không xóa).
- "Ngày đạt" (tuần, Tin tưởng) **không đổi**: có cả hai mốc trước giờ ngủ, hoặc thẻ, hoặc ốm / lễ.

### 5.9 Chặn hẳn (Character.ai) và nhạc

- Thêm danh sách **"Luôn chặn"** của gia đình (dữ liệu, bố mẹ sửa được). Mặc định: `character.ai` (kèm `c.ai`). Builder đề xuất thêm vài trang chat nhân vật AI phổ biến vào PR để bố mẹ duyệt.
- Extension chặn danh sách này **cả khi máy mở** (`PLAY`, Tin tưởng, ngày ốm, bố mẹ mở). Hiện nay extension chỉ chặn `translate.goog` khi khóa, còn lúc mở thì "không có luật nào" (`extension/src/core/rules.ts`), nên cần một bản extension mới (0.4).
- Extension 0.4 gửi số phiên bản khi hỏi máy chủ. Trang **Thiết bị** của bố mẹ hiện dòng cảnh báo cho máy chạy bản cũ hoặc chưa rõ bản: "Extension cũ: lúc chơi chưa chặn Character.ai — cài lại bản mới". **Không** khóa máy chỉ vì extension cũ (không đổi luật khóa/mở); khoảng hở này chấp nhận đến khi bố mẹ cài lại.
- Trang học (allowlist) có nút Thêm nhanh **Spotify** (trang nghe nhạc web). Không thêm YouTube / YouTube Music.

## 6. Máy trạng thái (thay hàng 5, 6, 10 của DESIGN §5 khi ví bật)

| # | Điều kiện | Status | open |
|---|---|---|---|
| 1–2 | Override mới nhất còn hiệu lực | LOCK_OVERRIDE / OPEN_OVERRIDE | như cũ |
| 3 | Tin tưởng | OPEN_TRUST | ✓ |
| 4 | Ngày ốm | OPEN_SICK | ✓ |
| 5′ | Có lượt chơi laptop chưa kết thúc, `now < started_at + planned` | **PLAY** | ✓ đến hết lượt (cắt ở giờ dừng chơi, khóa đêm, 00:00) |
| 7 | Đang nghỉ (R8b), chỉ trước khi xong việc bắt buộc | BREAK | như cũ |
| 8 | Phần 1 chưa xong | LOCK_P1 | ✗ |
| 9 | Phần 2 chưa xong | LOCK_P2 | ✗ |
| 10′ | Đã xong việc bắt buộc (hoặc cả hai phần rỗng, hoặc thẻ) | **PLAY_READY** | ✗ (con tiêu ví thì sang PLAY) |
| — | Khóa đêm | LOCK_NIGHT | ✗ (như 23/11; PLAY bị cắt lúc khóa đêm bắt đầu) |

- Extension vẫn chỉ đọc `open` / `openUntil` + allowlist + danh sách luôn chặn.
- `computeDayState` vẫn là hàm thuần. Đầu vào thêm `wallet`: cài đặt của con, các dòng ví từ đầu tuần (kèm `carry` đầu tuần), lượt chơi laptop hôm nay. Đầu ra thêm:

```ts
wallet: {
  enabled: boolean
  balance: number            // phút, ≥ 0
  earnedToday: number        // phiên + phút nghỉ chưa dùng (không gồm nền)
  earnCap: number
  spentToday: number         // tiêu ròng
  spendCap: number           // theo thứ trong tuần
  canSpend: { laptop: boolean; ipad: boolean; boox: boolean; maxLaptopMinutes: number }
  play: { startedAt; plannedMinutes; endsAt } | null
  expiresAt: string          // 23:59 CN
  carryMax: number
} | null                     // null khi ví chưa bật cho con
```

- Ghi dữ liệu (nền, phút nghỉ chưa dùng, carry/expire, hoàn khi hết lượt chơi) làm ở lần đọc, **idempotent**, như cách đang ghi mốc phần. Cộng phút phiên làm ở route nộp kiểm tra / route Xong.

## 7. Dữ liệu (đề xuất; builder chốt tên cột)

Theo luật migration: chỉ thêm, idempotent, grant + RLS cùng file, có test RLS.

| Bảng | Cột chính | Ai đọc / ghi |
|---|---|---|
| `play_wallet_settings` | `child_id` (pk), `family_id`, `enabled_from date null`, `base_minutes 20`, `earn_cap_day 60`, `balance_cap 120`, `spend_cap_weekday 60`, `spend_cap_weekend 120`, `carry_max 30`, `tiers jsonb [[20,8],[45,15]]`, `unverified_per_day 1`, `quiz_size 5`, `quiz_pass 3`, `device_block_minutes 15` | Bố mẹ đọc/ghi (cả nhà); con đọc của mình |
| `wallet_entries` | `id`, `family_id`, `child_id`, `local_date`, `week_start`, `kind` (`earn_session` / `earn_unverified` / `base` / `break_leftover` / `spend` / `refund` / `carry` / `expire` / `parent_adjust`), `minutes int` (có dấu), `device` (`laptop`/`ipad`/`boox`, cho `spend`), `run_id`, `attempt_id`, `spend_id` (cho `refund`), `planned_minutes`, `started_at`, `ended_at`, `note`, `created_by`, `created_at` | Chỉ máy chủ ghi. Con đọc của mình; bố mẹ đọc cả nhà. Chỉ thêm dòng, không sửa số (`ended_at` của `spend` là cột duy nhất được cập nhật) |
| `quiz_items` | `id`, `family_id`, `study_app_id`, `skill_code`, `stem`, `kind` (`mcq` / `number` / `text`), `choices jsonb`, `answer jsonb`, `explanation`, `version` | **Không grant cho con**, kể cả select (đáp án). Bố mẹ tải lên qua route; máy chủ đọc bằng service_role |
| `quiz_attempts` | `id`, `family_id`, `child_id`, `run_id`, `seq` (1–2), `item_ids uuid[]`, `answers jsonb`, `correct int`, `passed bool`, `started_at`, `submitted_at`, `expires_at` | Chỉ máy chủ ghi; con đọc của mình (không có đáp án) |
| `task_runs` | thêm `topic_app_id` (→ `study_apps`), `topic_label` | như cũ |
| `task_templates` | thêm `door` (`english` / `math` / `review` / null) | như cũ (V4) |
| `family_settings` | thêm `doors_required 2` (V4) | như cũ |
| `review_plans` (V4) | `child_id`, `title`, `exam_date`, `active`, `schedule jsonb` (thứ → `study_app_id`) | Bố mẹ ghi; con đọc của mình |
| Luôn chặn | bảng mới **hoặc** nhóm mới trong `allowlist_entries` (builder chọn) | Bố mẹ ghi; extension nhận qua `/api/ext/state` |

Idempotency: chỉ mục duy nhất cho (`child_id`, `local_date`, `kind`) khi `kind ∈ {base, break_leftover}`; (`attempt_id`) cho `earn_session`; (`spend_id`) cho `refund`; (`child_id`, `week_start`, `kind`) cho `carry` / `expire`.

**Định dạng ngân hàng câu** (Xưởng xuất, bố mẹ tải lên cùng tệp .html ở **Thêm › App ôn tập**): tệp `<slug>.cau-hoi.json`

```json
{
  "goi": "lap-pt-toan-9",
  "phien_ban": "2026-12-10",
  "cau": [
    { "id": "cd-05", "ky_nang": "T9.DS.LAPPT.CD2", "loai": "mcq",
      "de": "…", "lua_chon": ["…", "…", "…", "…"], "dap_an": 2, "loi_giai": "…" },
    { "id": "ht-11", "ky_nang": "T9.HH.HTL.2", "loai": "number",
      "de": "…", "dap_an": 12.5, "sai_so": 0.01, "loi_giai": "…" }
  ]
}
```

- `loai`: `mcq` (một đáp án đúng; `dap_an` là **chỉ số đếm từ 0** trong `lua_chon`, ví dụ `2` = lựa chọn thứ ba), `number` (so trong `sai_so`), `text` (so khớp sau khi bỏ dấu cách / hoa thường; hạn chế dùng).
- Lúc hiện câu, máy chủ **xáo thứ tự lựa chọn** và tự đổi lại khi chấm.
- Kiểm khi tải lên: `goi` trùng `slug` của app; mỗi câu có `id` duy nhất, `ky_nang`, đáp án hợp lệ; ≥ 10 câu mỗi gói (để bốc không lặp). Sai → từ chối cả tệp, báo dòng sai.
- Chữ và công thức: chữ thường + Unicode (², √, ≤). Không HTML, không ảnh ở Đợt 1.

## 8. API (đề xuất)

| Route | Ai | Làm gì |
|---|---|---|
| `POST /api/tasks/start` (có sẵn) | con | Thêm `topic_app_id` (không bắt buộc) |
| `POST /api/tasks/finish` (có sẵn) | con | Như cũ; nếu ví bật và phiên đủ điều kiện → trả `quiz: {attemptId, items[] không đáp án, expiresAt}`, hoặc ghi `earn_unverified` |
| `POST /api/quiz/submit` | con | Nộp 1 lần; chấm; ghi `earn_session`; trả kết quả từng câu + lời giải |
| `POST /api/quiz/more` | con | "Học thêm": mở lại đồng hồ của phiên (lượt 2 chỉ được tạo sau ≥ 10′) |
| `POST /api/wallet/spend` | con | `{device, minutes}`; kiểm điều kiện §5.6; laptop → PLAY; iPad/Boox → báo đẩy bố mẹ |
| `POST /api/wallet/stop` | con | Dừng lượt chơi laptop, ghi `refund` |
| `POST /api/admin/wallet/refund` | bố mẹ | Hoàn một lượt `spend` iPad/Boox **của hôm nay** |
| `POST /api/admin/wallet/adjust` | bố mẹ | ± phút, bắt buộc có ghi chú; ghi `audit_log` |
| `PUT /api/admin/wallet/settings` | bố mẹ | Sửa `play_wallet_settings` của một con; ghi `audit_log` |
| `POST /api/admin/study-apps/:id/questions` | bố mẹ | Tải `*.cau-hoi.json`, thay ngân hàng câu của app (giữ `version`) |

Mọi route con: kiểm phiên của con, máy chủ ghi bằng service_role, con không có quyền ghi bảng nghiệp vụ (như hiện nay).

## 9. Chống lách

| Cách lách | Chặn bằng |
|---|---|
| Mở app rồi ngồi không 20′ | Phải qua bài kiểm tra; 2 câu từ chủ đề cũ. Đợt 2: phút chỉ tính khi app báo có hoạt động |
| Đoán mò trắc nghiệm | Cần 3/5; 4 lựa chọn → đoán bừa đạt ≈ 10%; tối đa 2 lượt/phiên, lượt 2 sau 10′ học thêm |
| Làm lại tới khi đúng | Chỉ tính lần nộp đầu; câu lượt 2 khác lượt 1; tránh câu đã gặp 7 ngày |
| Sửa kết quả trong app / devtools | Đáp án chỉ nằm ở máy chủ; app không gửi "đạt" |
| Chỉ chọn chủ đề dễ đã thuộc | 2 câu từ chủ đề cũ; Đợt 2: chủ đề đã làm được chỉ ×0,5 |
| Sửa đồng hồ máy | Mọi thời lượng theo giờ máy chủ |
| Xin thêm giờ iPad mà không tiêu ví | Luật một câu cho bố mẹ (§5.6) |
| Mở Character.ai lúc đang chơi trên laptop | Danh sách luôn chặn chạy cả khi mở |
| Cài lại Chrome trên iPad | Screen Time: Ask to Buy / chặn cài app (bố mẹ cài, §11) |

## 10. Ví dụ mẫu (nguồn sự thật cho test)

Giả định: ví bật, cài đặt mặc định, ngày thường (T3), ví đầu ngày 0′.

| # | Diễn biến | Kết quả |
|---|---|---|
| W1 | Ôn "Hệ thức lượng" 47′ → kiểm tra 4/5 | +15′ (`earn_session`) |
| W2 | English OS 22′ (không có ngân hàng câu) | +8′ (`earn_unverified`) |
| W3 | Thêm một phiên English OS 30′ cùng ngày | +0′ (đã dùng suất không kiểm tra) |
| W4 | Toán gói 25′ → 2/5 → Học thêm 12′ (phiên 37′) → lượt 2: 3/5 | Lượt 1 +0′; lượt 2 +8′ (bậc 20) |
| W5 | Phiên 15′ bấm Xong | Không kiểm tra, +0′ |
| W6 | Bốn phiên đạt 45′+ (15 × 4 = 60), rồi phiên đạt thứ 5 | Phiên 5: +0′, "đã kiếm đủ 60′" |
| W7 | Xong bài trên lớp + 2 cửa; ngân hàng giờ nghỉ còn 10′ | `base` +20′, `break_leftover` +10′ (trong trần 60′) |
| W8 | Ví 115′, phiên đạt +15′ | Ví 120′, 10′ mất, "Ví đầy" |
| W9 | 20:00 chơi laptop 30′, 20:12 bấm Dừng | Tiêu 30′, hoàn 18′; PLAY 20:00–20:12 |
| W10 | 20:00 chơi 30′, 20:10 bố mẹ khóa tay | PLAY kết thúc 20:10, hoàn 20′, LOCK_OVERRIDE |
| W11 | Giờ dừng chơi 22:30; 22:20 mở màn Chơi | Chỉ cho chọn tối đa 10′; 22:26 thì không cho chơi (còn < 5′) |
| W11b | Đang chạy Ôn 30′ dở, bấm "Dùng 15′ trên iPad" | Từ chối: "Con đang học — bấm Xong trước" |
| W11c | 20:00 bắt đầu Ôn; 20:10–20:25 bố mẹ mở máy 15′; 20:50 Xong | Phút phiên = 50 − 15 = 35′ → bậc 20 (+8′ nếu đạt) |
| W11e | 19:55 "Dùng 15′ trên iPad"; 20:00 bấm Bắt đầu Ôn | Từ chối đến 20:10: "Con đang dùng giờ chơi trên iPad" |
| W11d | Ôn 25′ → 2/5 → "Học thêm" 22′ → lượt 2: 4/5 | Phiên 47′ (không tính thời gian làm kiểm tra) → +15′; lượt đầu vẫn là lượt đã xong |
| W12 | T3 đã tiêu ròng 60′ | Nút Chơi / Dùng trên iPad tắt: "Hôm nay đã chơi đủ" |
| W13 | T7 đã tiêu 60′, ví còn 50′ | Còn tiêu được 50′ (trần T7 = 120′) |
| W14 | 21:00 "Dùng 15′ trên iPad" | −15′, báo đẩy bố mẹ; không hoàn tự động |
| W15 | Bố mẹ bấm "Chưa duyệt · hoàn lại" cho W14 lúc 21:20 | +15′ `refund` |
| W16 | CN 23:59 ví 70′; T2 lần đọc đầu | `carry` 30′ ghi cho tuần mới, `expire` −40′ cho tuần cũ |
| W17 | Ngày lễ, không có việc nào; 07:05 con mở máy | `base` +20′; PLAY_READY |
| W18 | Dùng thẻ miễn lúc 18:00 (chưa xong việc) | Coi như xong; `base` +20′; PLAY_READY |
| W19 | Chưa xong việc bắt buộc, ví 40′ | Không tiêu được; nghỉ R8b như cũ |
| W20 | Ngày ốm | OPEN_SICK; ví vẫn kiếm được; nút Chơi laptop ẩn; iPad tiêu được |
| W21 | `enabled_from` = 15/12; hôm nay 10/12 | Luật cũ: 45′ tự do, FREE / LOCK_END |
| W22 | Đang PLAY, mở `character.ai` | Bị chặn |
| W23 | Kiểm tra mở lúc 19:00, 19:10 chưa nộp, đã trả lời 3 câu (2 đúng) | Chấm 2/5, không đạt |

## 11. Việc bố mẹ cài trên máy (không cần code)

**iPad** (Screen Time, mỗi con):
1. Nội dung & Quyền riêng tư → Nội dung web → **Chỉ trang web được phép**: chép danh sách Trang học của laptop + `google.com` + các trang truyện con hay đọc.
2. Giới hạn ứng dụng → thêm **trang truyện** (Safari) + nhóm Trò chơi / Giải trí: **1′/ngày**, bật "Chặn khi hết giới hạn".
3. **Không bao giờ cho phép**: `character.ai`, `c.ai` và các trang tương tự.
4. **Luôn cho phép**: Zalo, Tin nhắn, Điện thoại, Spotify, Launcher (màn hình chính), Google Docs/Drive/Meet, Ghi chú, Camera, app học.
5. Gỡ Chrome và trình duyệt khác; bật hỏi trước khi cài app để con không cài lại.
6. Downtime đêm khớp giờ ngủ của con.
7. Thử: mở một trang truyện → "Xin thêm giờ" → iPhone bố mẹ nhận được yêu cầu.

*Lưu ý:* "Ask to Browse" (con xin mở trang mới) có trong Safari từ iPadOS 27. Bản cũ hơn thì bố mẹ nhập mật mã Screen Time ngay trên iPad để duyệt trang mới.

**Boox:** thử Google Family Link (~10′). Được → khóa máy, tiêu ví = bố mẹ cho "thêm giờ" 15′. Không được → bố mẹ giữ máy, đưa máy khi con tiêu ví.

## 12. Những gì người thiết kế tự quyết (bố mẹ xem lại khi đọc)

| # | Quyết định | Lý do |
|---|---|---|
| C1 | Launcher giữ ngân hàng câu và chấm bài (§3 b), thay vì app tự chấm | Không giả được kết quả; `/on-tap` vẫn không có mạng ở Đợt 1 |
| C2 | Bài trên lớp không kiếm phút, chỉ góp vào nền | Không có tối thiểu, không kiểm tra được |
| C3 | Trần kiếm 60′ gồm cả phút nghỉ chưa dùng; nền ngoài trần | Tránh thưởng hai lần cho cùng một giờ học (phiên được +15′ **và** ngân hàng giờ nghỉ +10′) |
| C4 | Kiểm tra có hạn 10′; câu trống tính sai | Không để lượt kiểm tra mở cả đêm |
| C5 | Phút chơi đã dùng làm tròn lên | Đơn giản, có lợi cho luật hơn cho con một chút |
| C6 | iPad / Boox không tự hoàn; bố mẹ bấm hoàn trong ngày | Launcher không đọc được Screen Time |
| C7 | Ngày ốm / Tin tưởng vẫn kiếm được ví | Học là học; laptop đã mở nên không cần tiêu |
| C8 | Thẻ miễn = xong việc bắt buộc (+ nền) | Giữ ý nghĩa thẻ là "hôm nay được miễn" |
| C9 | Ví bật theo từng con, có ngày bắt đầu; luật cũ chạy song song đến ngày đó | Bật sau thi HK1, có thể bật Nguyên trước |
| C10 | Chọn chủ đề + phiên tự chọn đưa lên V3 (không đợi V4) | Không có thì gần như mọi phiên là "không kiểm tra" và T7–CN không có cách kiếm phút |
| C11 | Phút phiên trừ khoảng đang chơi / nghỉ / tiêu iPad / bố mẹ mở; đang học thì không tiêu ví, đang chơi thì không bắt đầu học | Chặn "bấm Bắt đầu rồi đi chơi 45′" |
| C12 | "Học thêm" là đoạn mới nối vào phiên, không mở lại lượt cũ | Không làm lệch mốc phần, R8a, R8b |
| C13 | Extension cũ chỉ bị cảnh báo, không bị khóa | Không đổi luật khóa/mở |
| C14 | `dap_an` của trắc nghiệm đếm từ 0; máy chủ xáo lựa chọn | Hợp đồng rõ với E; con không học thuộc vị trí đáp án |

## 13. Còn mở (mặc định để tắt, không chặn V1–V3)

| # | Câu hỏi | Mặc định đến khi bố mẹ chốt |
|---|---|---|
| O1 | Mỗi cửa vào phải có ≥ N ngày/tuần? | Tắt (N = 0) |
| O2 | Mùa thi: "Ôn chủ đề" bắt buộc từ K ngày trước ngày thi? | Tắt (K = 0) |
| O3 | Con số riêng cho An (lớp 6), khác Nguyên? | Cùng mặc định; bố mẹ sửa được ở cài đặt từng con |
| O4 | Ngày thi HK1 của từng con (để đặt `enabled_from` và đợt ôn) | — |
| O5 | "Làm được" một kỹ năng = đúng ở 2 ngày khác nhau? (Đợt 2) | Theo đề xuất của E |
| O6 | Kết quả học Toán lâu dài lưu ở Launcher hay App Toán (Đợt 2) | Launcher cho HK2 |
| O7 | Giờ dừng chơi = giờ ngủ 22:30 (đề xuất) hay 00:00 như giờ tự do hiện nay? | 22:30 — **chờ bố mẹ xác nhận** |

## 14. Lát build

| Lát | Nội dung | SQL | Khi |
|---|---|---|---|
| **V0** | Tài liệu này | Không | 27/11 |
| **V1** | Danh sách "Luôn chặn" (mặc định `character.ai`, `c.ai`) chạy cả khi máy mở → extension 0.4; nút Thêm nhanh **Spotify** | Có (danh sách luôn chặn) | Trước thi, **làm ngay** |
| **P** | Bản bấm thử cho 2 con: thẻ Ví ở Hôm nay, kiểm tra 5 câu, "Chơi" / "Dùng trên iPad" | Không (artifact) | Trong tuần thi, không đổi app thật |
| **V2** | Lõi ví: 2 bảng ví, `computeDayState` PLAY / PLAY_READY, nền, phút nghỉ chưa dùng, tiêu laptop / iPad / Boox, hoàn, trần, carry / expire, `earn_unverified`, thẻ Ví ở Hôm nay, trang cài đặt bố mẹ, báo đẩy | Có | Sau thi |
| **V3** | Kiểm tra nhanh: `quiz_items` + tải ngân hàng câu, `quiz_attempts`, bốc / chấm / thưởng, "Học thêm"; **chọn chủ đề** khi bắt đầu việc mẫu + **phiên tự chọn** (§5.2) | Có | Sau thi; **bật ví sau khi V3 merge** (không có V3 thì mỗi ngày chỉ kiếm được 20 + 8 = 28′, ít hơn 45′ hiện nay) |
| **V4** | 3 cửa vào + 2/3 + đợt ôn (gán gói theo thứ) + chọn chủ đề | Có | HK2 |
| **V5** (Đợt 2) | Phiếu kết quả từ app (route riêng, CSP chỉ mở đúng route đó), trạng thái kỹ năng 4 mức, bản đồ chủ đề, ×0,5 cho chủ đề đã làm được, phút theo hoạt động | Có | HK2 |

Mỗi lát 1 PR thẳng vào `main`. Lát đổi luật cập nhật SPEC §18, DESIGN §5/§6, PROGRESS, CLAUDE.md (phần Key decisions).

## 15. Gửi lại Xưởng ôn tập (E)

- **Đợt 1 E cần làm:** xuất `<slug>.cau-hoi.json` (định dạng §7; `dap_an` trắc nghiệm đếm từ 0) cho các gói Lập PT, Hệ thức lượng, Ước và bội và gói HK1 mới; ≥ 10 câu mỗi gói, mỗi câu có mã kỹ năng; kiểm đáp án độc lập (0 lỗi). Tệp .html **không** cần gửi gì và vẫn chạy không có mạng.
- **Nhiệm vụ khi mở app** (V4): `/on-tap/<slug>?nhiem_vu=<run_id>`; app chỉ dùng tham số này để hiện "đang tính giờ", không bắt buộc.
- **Phiếu kết quả** (V5, Đợt 2): giữ bản nháp hợp đồng của E (mục 6 handover) với 3 sửa: (1) route `POST /api/on-tap/phieu`, CSP `connect-src` chỉ đúng URL đó; (2) phiếu bắt buộc kèm `nhiem_vu` = `run_id` đang chạy của con; (3) phiếu **không** cộng phút, chỉ để tính trạng thái kỹ năng và phút có hoạt động.
- **Trạng thái kỹ năng** (V5): chưa học · đang học · làm được · cần ôn lại, theo mã kỹ năng của bản đồ chương trình E.
