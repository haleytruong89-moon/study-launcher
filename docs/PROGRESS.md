# Study Launcher — PROGRESS

| Ngày | Lát | Trạng thái | Ghi chú / việc còn mở | SQL cần áp |
|---|---|---|---|---|
| 05/10/2026 | — | Bridge files tạo trên Claude.ai: `CLAUDE.md`, `docs/SPEC.md` v0.2, `docs/DESIGN.md` v0.2, `docs/SETUP.md` | — | — |
| 13/10/2026 | — | Repo `study-launcher` (private) tạo xong; đẩy bridge files lên `main` | Chờ: Supabase project riêng (SETUP A2–A3); thử khóa Windows (SETUP B — cần trước S4); đăng ký store (SETUP C — cần trước S6). Tiếp theo: **S0** | — |
| 13/10/2026 | — | Supabase project `study-launcher` tạo xong (Singapore); nối GitHub, chỉ "Deploy to production" (SPEC §18) | Quy tắc mới: SQL tự chạy khi merge. Chưa làm: A7–A9 (SETUP), B (Windows), C (store) | — |
| 13/10/2026 | S0 | **PR mở, chờ phụ huynh thử preview + merge** (`feature/s0-khung`) | Còn mở: A4 (Vercel + biến môi trường), A7–A9 (SETUP); xem mô tả PR | `supabase/migrations/0001_init.sql` — tự chạy khi merge (tạo 15 bảng, RLS, 2 bucket ảnh) |
