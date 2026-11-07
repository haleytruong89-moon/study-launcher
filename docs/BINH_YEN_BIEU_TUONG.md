# Góc bình yên — Biểu tượng & nhân vật (spec bổ sung)

> **Trạng thái:** bản nháp 07/11/2026, chờ bố mẹ duyệt. **Chưa code.**
> **Vì sao có file này:** bản mẫu hai con đã thử (https://claude.ai/artifact/MqDzfE32PkVW3yyrPSrDVT)
> có khuôn mặt nhân vật, tạo nhân vật và hình nhỏ cho từng nút. `BINH_YEN.md` §1 lại xếp
> "Picrew / nhân vật riêng" vào cột *Chưa làm*. Vì vậy lát S-BY1 làm ô của Nguyên bằng
> **biểu tượng tập hồ sơ** thay cho khuôn mặt.
> **Bố mẹ chốt (07/11/2026, theo ý cả Nguyên và An):** làm đủ 4 phần A–D dưới đây.
> File này **thay** dòng "Picrew / nhân vật riêng" trong `BINH_YEN.md` §1. Khi PR "bỏ PIN" merge xong
> sẽ sửa luôn §1.

Không đổi các luật đã chốt:
- Không điểm, không chuỗi ngày, không xếp hạng.
- Bố mẹ không xem nội dung cảm xúc.
- Không ảnh chụp con.
- Không dịch vụ bên ngoài nhận dữ liệu của con.

---

## A. Khuôn mặt nhân vật ở 4 ô cảm xúc

| | Nguyên (thám tử) | An (nhà khoa học) |
|---|---|---|
| 4 ô | **Khuôn mặt nhân vật của con**, mỗi ô một biểu cảm: đỏ = giận, vàng = cười, lam = buồn/lim dim, lục = bình thản. Thay biểu tượng tập hồ sơ | Giữ **núi lửa / mặt trời / biển sâu / khu rừng**, vẽ lại to và đẹp hơn |
| Nhân vật xuất hiện ở | 4 ô · trang manga mỗi ngày (khung lớn) · bìa "Tập của tuần" · lời chào | Lời chào · đứng trong khu rừng · thẻ loài vừa mở |
| Chưa tạo nhân vật | Dùng **nhân vật mặc định** của bản mẫu, có dòng nhỏ "Hình tạm — chạm để tạo nhân vật của con" | Như Nguyên, mặc định là nhà thám hiểm (áo khoác, kính lúp) |

Biểu cảm theo ô (lấy từ bản mẫu):

| Ô | Biểu cảm | Mắt |
|---|---|---|
| Đỏ | giận | sắc |
| Vàng | cười | cười híp |
| Lam | buồn | lim dim |
| Lục | bình thản | tròn |

**Tiêu chí nghiệm thu**
- Nguyên mở Góc bình yên → 4 ô hiện khuôn mặt nhân vật của Nguyên, đúng biểu cảm từng ô. Không còn biểu tượng tập hồ sơ.
- Đổi nhân vật xong → 4 ô và trang manga đổi theo ngay lần mở sau.
- Mỗi khuôn mặt có `alt` rỗng; tên ô vẫn là chữ, để máy đọc màn hình đọc được.

## B. Con tự tạo nhân vật của mình

**Bản 1 — tạo ngay trong app** (giống bản mẫu, không tải ảnh lên):

| Phần | Lựa chọn (bản mẫu) |
|---|---|
| Kiểu tóc | Dài · Ngắn · Đuôi ngựa · Hai bím · Rối, xù |
| Màu tóc | 11 màu (trắng, bạc, đen, nâu, hồng, xanh lá, xanh dương, đỏ, tím, vàng, xám) |
| Mắt / màu mắt | Tròn to · Sắc · Cười híp · Lim dim / 8 màu |
| Màu da | 3 tông |
| Trang phục / màu | Đồng phục blazer · Hoodie · Áo khoác thám tử · Kimono · Áo choàng (+ **Áo thám hiểm** cho An) / 10 màu |
| Đạo cụ | Không · Sách · Kính lúp · Bút vẽ · Ô · Mèo (+ **Ống nhòm** cho An) |
| Phụ kiện | Không · Nơ · Kẹp lá · Mũ thám tử · Kính · Tai nghe · Băng đô |
| Tên nhân vật | Tùy chọn, ≤ 24 ký tự (dùng trên bìa tập / biển tên khu rừng) |

- Biểu cảm **không** chọn tay: app tự đổi theo ô (mục A).
- Màn tạo nhân vật có xem trước 4 biểu cảm cùng lúc. Nút **Lưu**, nút **Về mặc định**.
- Con muốn thêm kiểu tóc, áo, đạo cụ → góp ý qua nút **Góp ý**. Bố mẹ duyệt rồi Claude thêm vào danh sách.

**Bản 2 — nhập nhân vật Picrew (để sau bản 1):**
- Con tạo nhân vật trên Picrew, tải ảnh về máy, rồi nhập vào 4 ô biểu cảm.
- Chỉ nhận PNG/JPG ≤ 1 MB, là hình vẽ, **không phải ảnh chụp con**.
- Mỗi người tạo trên Picrew có điều khoản dùng ảnh riêng. Bố mẹ xem điều khoản của mẫu con chọn trước khi nhập.
- Cần thêm chỗ lưu ảnh nên sẽ có file SQL riêng ở lát đó.

**Dữ liệu (bản 1)**
- Nhân vật chỉ là **một bộ mã lựa chọn** (vd `hair: "long"`, `hairColor: "den"`), không có ảnh. Máy chủ kiểm từng mã theo danh sách cố định.
- *Đề xuất, chờ bố mẹ chốt:* lưu cạnh **biểu tượng riêng của con** (`profiles`). Bố mẹ cũng thấy được nhân vật, giống biểu tượng hiện tại. Nhân vật là tranh, không phải cảm xúc, nên không cần giấu như lượt ghé.
- Lựa chọn khác: lưu trong khu Góc bình yên (bố mẹ không thấy).
- Lát code sẽ có 1 file SQL nhỏ: thêm 1 cột, con chỉ ghi qua route máy chủ.

**Tiêu chí nghiệm thu**
- Con tạo nhân vật → Lưu → mở lại app trên máy khác vẫn thấy đúng nhân vật.
- Gửi mã không có trong danh sách (vd tự sửa yêu cầu) → máy chủ từ chối, không lưu.
- Con không ghi được vào database trực tiếp (chỉ qua route).
- Anh/chị em không sửa được nhân vật của nhau.

## C. Hình nhỏ cho từng từ, hoạt động, nguyên nhân

- Dùng **emoji**, cùng kiểu với bộ 24 biểu tượng con đang chọn ở màn Hôm nay. Không cần tải hình về.
- Laptop Windows và iPad vẽ emoji hơi khác nhau. Chấp nhận ở bản này.
- Danh sách dưới là **bản nháp để con sửa**: con muốn đổi hình nào thì nói, hoặc gửi Góp ý.

**24 từ cảm xúc**

| Ô | Từ → hình |
|---|---|
| Đỏ | tức giận 😠 · bực bội 😤 · lo lắng 😟 · căng thẳng 😣 · hoảng 😱 · ghen tị 😒 |
| Vàng | vui 😊 · hào hứng 🤩 · tự hào 🏅 · tò mò 🧐 · phấn khích 🥳 · tràn năng lượng ⚡ |
| Lam | buồn 😢 · chán 😑 · mệt 😪 · cô đơn 😶 · thất vọng 😞 · tủi thân 🥺 |
| Lục | bình yên 😌 · thư thái 🍃 · biết ơn 🙏 · nhẹ nhõm 😮‍💨 · an toàn 🤗 · mãn nguyện ☺️ |

**Hoạt động**

| Hoạt động → hình | |
|---|---|
| Hỏi lại cái đầu 🧠 · Thở cho dịu lại 🌬️ · Nghỉ một chút 🛌 · Nhảy theo một bài nhạc 💃 · Nhắn bố mẹ 💬 · Kể cho một người 🗣️ · 3 bằng chứng 🔍 · 3 điều biết ơn 💛 · Giữ khoảnh khắc 📸 | chung / Nguyên |
| Đo nhịp tim 💓 · Lọ bình tĩnh 🫙 · Núi lửa trong lọ 🌋 · Thổi bong bóng 🫧 · Thở như cá voi 🐋 · Thí nghiệm cơ thể 🧍 · Quan sát bầu trời 🌙 · Quan sát như nhà khoa học 🔬 · Câu hỏi tò mò ❓ · Viết rồi buông 🎈 · Nhảy như con vật 🦘 | An |

**Nguyên nhân** (cho lát S-BY3 "Muốn hiểu vì sao?", lấy đúng bản mẫu)

| Nguyên | An |
|---|---|
| 🏫 Trường lớp · 👥 Bạn bè · 🏠 Gia đình · 📚 Bài tập, kiểm tra · 📱 Điện thoại, mạng xã hội · 😴 Ngủ ít · 🍜 Đói, mệt · 🎨 Được vẽ · 🏃 Vận động · 🎵 Nghe nhạc · 📖 Đọc truyện · ⛅ Thời tiết | 🏫 Ở trường · 👫 Bạn bè · 🏠 Gia đình · 📚 Bài tập, kiểm tra · 📺 Tivi, điện thoại · 😴 Ngủ ít · 🍜 Đói, mệt · 🌳 Chơi ngoài trời · 🐾 Con vật · 🔭 Khám phá điều mới · ⚽ Vận động · 👭 Với chị Nguyên |

- Hình nằm **cạnh** chữ, không thay chữ.
- Lượt ghé lưu trên máy chủ vẫn chỉ là mã (`word_key`, `activity_key`), không lưu emoji.

**Tiêu chí nghiệm thu**
- Mọi nút từ, hoạt động, nguyên nhân có hình + chữ.
- "Lần ghé gần đây" hiện hình của từ và hoạt động.
- Hình có `aria-hidden`, máy đọc màn hình chỉ đọc chữ.

## D. Biểu tượng riêng của con trong Góc bình yên

- Biểu tượng con đã chọn ở màn Hôm nay (bộ 24) hiện ở:
  - lời chào Góc bình yên ("🦊 Chào Nguyên");
  - góc bìa "Tập của tuần" (Nguyên);
  - biển tên khu rừng (An).
- Chưa chọn biểu tượng → hiện chữ cái đầu tên, như màn Hôm nay.
- Không thêm dữ liệu mới (dùng `profiles.icon` có sẵn).

**Tiêu chí nghiệm thu:** đổi biểu tượng ở màn Hôm nay → Góc bình yên đổi theo ở lần mở sau.

---

## Chia lát (đề xuất)

| Lát | Gồm | Database | Ước tính |
|---|---|---|---|
| S-BY1b | C + D (emoji cho từ, hoạt động, nguyên nhân; biểu tượng riêng) | Không | ~0,5 ngày |
| S-BY1c | A + B bản 1 (khuôn mặt 4 ô, tạo nhân vật trong app) | Có, 1 cột | ~2 ngày |
| Sau | B bản 2 (nhập Picrew) | Có, chỗ lưu ảnh | ~1 ngày |

Thứ tự cuối cùng chốt cùng thiết kế lại màn chính (mockup: https://claude.ai/artifact/VN6NCVjHRVKuti7qGZ63og).

## Câu hỏi chờ bố mẹ

1. Nhân vật của con lưu cạnh biểu tượng (bố mẹ thấy được) hay trong Góc bình yên (bố mẹ không thấy)? *Đề xuất: cạnh biểu tượng.*
2. Picrew (bản 2): có làm không, và khi nào?
3. Danh sách emoji ở mục C: để hai con sửa trước khi code?

## Còn lại từ bản mẫu, chưa có trong app (ghi để không bị sót lần nữa)

| Trong bản mẫu | Ghi chú |
|---|---|
| Mặt "người dẫn đường" cạnh lời khuyên | Có thể dùng chính nhân vật của con (mục A) |
| "Nhắn bố mẹ" chọn mức: không gấp / trong hôm nay / ngay bây giờ | **Khác quyết định đã chốt** (tín hiệu chỉ có tên + giờ). Cần bố mẹ quyết |
| Phần thưởng ngoài đời của tháng (con chọn, bố mẹ thực hiện) | Không gắn số lần ghé |
| "Vài dòng cho tối nay" — câu hỏi buổi tối | Cần ô viết chữ → sau S-BY2 |
| An tự thêm thẻ vào bách khoa thư (chờ bố mẹ xem) | Cần ô viết chữ |
| Câu hỏi tò mò gửi bố mẹ, cùng tìm câu trả lời | Chữ đi tới bố mẹ → cần nói rõ với con |
| Khu rừng mở rộng: rạn san hô, bầu trời sao | Thuộc S-BY4 |
| Bảng điều tra (Nguyên), Bàn pha chế (An) | Thuộc S-BY3 |
| Thanh menu: Hôm nay · Hồ sơ/Khu rừng · Góp ý | Gộp vào thiết kế lại màn chính |
