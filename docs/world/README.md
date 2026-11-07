# Thế giới tháng của An (R4)

> Bổ sung và **thay** phần "Chọn loài" ở `docs/MAN_CHINH_MOI.md` §4.1 (phụ huynh chốt 07/11/2026, sau khi hỏi An).
> An thích khoa học tự nhiên, con vật, cả trên cạn lẫn dưới nước, và các hiện tượng tự nhiên.

## Quyết định 07/11/2026

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | **Cách 2 — loài mới + lớn lên.** Lượt trồng thứ *k* (đếm từ 0) của một mảng trong tháng là thứ số *k mod 6* của mảng đó, ở mức lớn *⌊k/6⌋*. 6 lượt đầu ra 6 thứ mới; các lượt sau làm chúng lớn thêm và mở điều thú vị thứ 2, rồi thứ 3 | Thay "lượt thứ n ra loài thứ n, hết danh sách thì không vòng lại". Mỗi lượt vẫn có điều mới, và gặp lại thứ cũ giúp nhớ lâu |
| 2 | **12 thế giới / năm**, mỗi thế giới một lần trong 12 tháng: rừng nhiệt đới, biển và rạn san hô, vũ trụ, núi lửa và động đất, Bắc Cực – Nam Cực, sa mạc, đồng cỏ châu Phi, hang động, sông và đầm lầy, bầu trời và thời tiết, thế giới tí hon, khủng long | Mỗi thế giới ~33 thẻ (4 mảng × 6 + 8 con vật), mỗi thẻ 3 điều → ~1.200 điều / năm |
| 3 | **An tự chọn đầu tháng** (R4b). Tháng mới chưa chọn và còn ≥ 2 thế giới để chọn → **cây chờ An chọn** (không mất gì: chọn xong, mọi mảng đã xong từ ngày 1 mọc ngay, lấy từ mốc đã lưu). Chọn một lần cho cả tháng. Hết tháng vẫn chưa chọn → theo thứ tự trên. Chỉ còn 1 thế giới chưa dùng → tự vào, không hỏi. **Không còn gói mới** → "sắp mở", **không lặp lại** thế giới đã dùng trong 11 tháng | Thay cách cũ "chưa chọn mà có cây đầu tiên thì theo vòng" (07/11): cây đầu tiên thường mọc trước khi An kịp mở tab, nên An sẽ mất quyền chọn. Bảng `world_months` (0013) giữ lựa chọn |
| 4 | **Hình: emoji khi có, hình vẽ SVG khi không có emoji hợp** | Có sẵn trong app, không tải từ ngoài |
| 5 | Chia lát: **R4a** khung + Rừng (tháng 11) + album; **R4b** Biển + Vũ trụ + màn chọn thế giới, xong trước 1/12; sau đó mỗi tháng một gói | Mỗi gói đọc lại trước khi vào app |

## Luật (không đổi so với §4.1)

- Mảng xong trong ngày → 1 thứ của mảng đó, tối đa 1 mỗi mảng mỗi ngày:
  - Cảm xúc: đi hết một lượt Góc bình yên (có dòng `by_checkins` ngày đó).
  - Học tập: có `part1_done_at`.
  - Kỹ năng: có `part2_done_at`.
  - Vui chơi: có `free_started_at`.
- Ngày dùng thẻ: không có Học tập / Kỹ năng (không có mốc thật), vẫn có Vui chơi nếu có giờ tự do.
- Thứ mọc ở mảng Cảm xúc **giống nhau dù con thấy thế nào**. Không có cột cảm xúc nào trong `world_items`.
- Ngày không có việc (bấm "Bắt đầu giờ tự do"): hai phần rỗng tính là xong nên mọc cả Học tập, Kỹ năng và Vui chơi (đúng luật "phần không có việc = đã xong").
- "Xóa hết" ở Góc bình yên xóa lượt ghé nhưng **hoa đã mọc vẫn giữ** (D2); hoa chỉ cho biết ngày đó con đã ghé, không ghi cảm xúc. Màn "Dữ liệu của con" của An nói rõ điều này.
- Không héo, không chết, không chuỗi ngày, không điểm. Ngày bỏ lỡ chỉ là không có thứ mới.
- Con vật tự đến khi thế giới có đủ thứ chúng cần (`needs`: số thứ khác nhau có một nhãn), đến rồi ở lại.
- Đã mọc là **được lưu** (`world_items`), không tính lại. Xóa lượt ghé Góc bình yên không làm mất hoa.

## Khi nào ghi

- Máy chủ ghi khi con mở thế giới (`GET /api/world`) và ngay sau một lượt ghé Góc bình yên. Nguồn là các mốc đã lưu (`day_sessions`, `by_checkins`), nên không mất gì nếu con chưa mở thế giới.
- Đồng bộ cả **tháng trước**, nên tối ngày cuối tháng không bị mất.
- Khóa duy nhất `(child_id, local_date, pillar)`: hai lần đồng bộ cùng lúc không trồng 2 lần.

## Ai thấy gì

- Con (An) thấy ở tab **Thế giới** và một dòng ở Hôm nay.
- Bố mẹ **không có route** đọc `world_items` (mảng Cảm xúc thuộc Góc bình yên). Bảng không grant cho trình duyệt.

## Nội dung

- `lib/world/<thế giới>.ts`: chỉ **thêm** ở cuối danh sách, không xóa hay đổi mã.
- Bản đọc lại cho bố mẹ và An: `docs/world/<THẾ GIỚI>.md`, sinh bằng `scripts/world-doc.ts`. Có: [`RUNG.md`](RUNG.md), [`BIEN.md`](BIEN.md), [`VU_TRU.md`](VU_TRU.md).
- Vũ trụ gọi "vị khách" (trạm vũ trụ, tàu thăm dò, mưa sao băng, cực quang, phi hành gia Phạm Tuân…) thay cho "con vật" (`visitorWord`).
