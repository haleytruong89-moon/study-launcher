/**
 * "🔒 Ai thấy gì?" — what Góc bình yên must tell the child honestly (BINH_YEN.md §3). Parent
 * decision 07/11/2026: short (4 lines) and true for the model WITHOUT a separate PIN — the
 * child's own login opens the corner. R2 (07/11/2026): the feelings also show on the child's
 * Hôm nay and Tuần pages (still no parent page), so the third line says so. Pure data: tests pin
 * it; later slices update it when they add something (e.g. the text boxes of S-BY2).
 */
export function whoSeesWhat(): string[] {
  return [
    "Bố mẹ không có trang nào xem cảm xúc hay hoạt động con chọn ở đây.",
    "Bố mẹ chỉ nhận tín hiệu khi con bấm “Con muốn nói chuyện”: tên con và giờ bấm.",
    "Cảm xúc con chọn cũng hiện ở trang Hôm nay và Tuần trên máy con. Ai đăng nhập bằng tài khoản của con cũng vào được và thấy.",
    "Con xóa được lượt ghé bất cứ lúc nào; lượt cũ hơn 12 tháng sẽ tự xóa.",
  ];
}
