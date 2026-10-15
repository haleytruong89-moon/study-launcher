# Study Launcher — PROGRESS

| Ngày | Lát | Trạng thái | Ghi chú / việc còn mở | SQL cần áp |
|---|---|---|---|---|
| 05/10/2026 | — | Bridge files tạo trên Claude.ai: `CLAUDE.md`, `docs/SPEC.md` v0.2, `docs/DESIGN.md` v0.2, `docs/SETUP.md` | — | — |
| 13/10/2026 | — | Repo `study-launcher` (private) tạo xong; đẩy bridge files lên `main` | Chờ: Supabase project riêng (SETUP A2–A3); thử khóa Windows (SETUP B — cần trước S4); đăng ký store (SETUP C — cần trước S6). Tiếp theo: **S0** | — |
| 13/10/2026 | — | Supabase project `study-launcher` tạo xong (Singapore); nối GitHub, chỉ "Deploy to production" (SPEC §18) | Quy tắc mới: SQL tự chạy khi merge. Chưa làm: A7–A9 (SETUP), B (Windows), C (store) | — |
| 13/10/2026 | S0 | **PR #1 đã merge** (21:29). Supabase báo chạy `0001_init.sql` thành công trên `main`; chưa xác nhận bằng link Vercel. Kiểm tra tự động bổ sung ở PR #2 (`feature/s0-kiem-tra`) | Còn mở: A4 (Vercel + biến môi trường), A7–A9 (SETUP); xem mô tả PR | `supabase/migrations/0001_init.sql` — tự chạy khi merge (tạo 15 bảng, RLS, 2 bucket ảnh) |
| 13/10/2026 | S0 | **PR #2 đã merge.** Vercel: project `study-launcher` đã tạo, đủ 5 biến môi trường (Production + Preview). Lần build đầu tiên được kích hoạt bằng PR ghi tiến độ này | Còn mở: kiểm tra `/api/health/ready` trên link production; A7 (tắt đăng ký), A8 (tạo tài khoản phụ huynh), A9 (secrets, tùy chọn) | Không đụng database |
| 13/10/2026 | S2a | **PR #4 mở** (`feature/s2a-day-state`): `computeDayState` + 75 test, chạy đêm | Phụ huynh đã chốt 14/10: Phần 1 rỗng chưa "xong hẳn", override mới nhất thay hẳn bản cũ, giờ tự do hoãn khi đang khóa tay (đã áp vào PR) | Không đụng database |
| 14/10/2026 | S1 | **PR #5 mở** (`feature/s1-phu-huynh`): cài đặt gia đình + giờ ngủ, app môn học, mẫu việc theo thứ, giao bài có ảnh (nén ≤ 1600px), gỡ bài, sửa tên/lớp/màu + đặt lại mật khẩu tài khoản con | Allowlist chỉnh tay để S3 (theo DESIGN §13). Phụ huynh cần A8 (tài khoản phụ huynh) để bấm thử trên preview. Ghi cho S2b: khi ký URL ảnh bài cho con, ký bằng phiên của con (hoặc kiểm lại tiền tố thư mục), không dùng service_role; allowlist (S3/S4) chỉ lấy từ slot `active` | Không đụng database |
| 14/10/2026 | S0 | Phụ huynh làm A8: tạo tài khoản, tạo gia đình và 2 tài khoản con trên production | Còn A7 (tắt sign-up), A9 | — |
| 15/10/2026 | S1, S2a | **PR #4, #5 đã merge** (09:57). Production có trang phụ huynh mới | — | Không đụng database |
| 15/10/2026 | S2b | **PR #6 mở** (`feature/s2b-hom-nay`): màn Hôm nay của con + 6 route (`/api/today`, start/finish/proof, break, pass) | Chưa làm: màn chọn profile + PIN (DESIGN §2), trang khóa, extension (S4). Thẻ miễn bị từ chối khi bố mẹ đang khóa tay | Không đụng database |
