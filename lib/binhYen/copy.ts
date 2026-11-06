/**
 * "🔒 Ai thấy gì?" — what Góc bình yên must tell the child honestly (BINH_YEN.md §3, decisions
 * Q1–Q7 of 01/11/2026), worded for what exists NOW (S-BY0). Pure data: tests pin it, and later
 * slices update it when they add something (e.g. "Sắp có" lines become real).
 */
export function whoSeesWhat(idleMinutes: number): string[] {
  return [
    "Bố mẹ không xem được cảm xúc, nguyên nhân hay chữ con viết ở đây. Không có trang nào cho bố mẹ xem.",
    "Bố mẹ nhận tín hiệu khi con bấm “Con muốn nói chuyện”: chỉ có tên con và giờ con bấm. Con chọn được gửi cho cả hai hay một người.",
    "Sắp có ô để viết: nếu con viết điều cho thấy con không an toàn, bố mẹ sẽ nhận một tín hiệu. Tín hiệu đó không kèm chữ, nhưng bố mẹ sẽ biết là đã có chuyện như vậy.",
    "Thẻ con tự thêm (sắp có) là để bố mẹ cùng xem — màn hình sẽ ghi rõ.",
    "Chữ con viết chỉ nằm trên laptop của con, khóa bằng PIN của con. Trên iPad dùng chung thì không lưu chữ. Xóa dữ liệu trình duyệt là mất. PIN 6 số chặn được người xem lướt, nhưng không chặn được người rành máy tính cố tình dò.",
    "PIN Góc bình yên do con tự đặt, khác PIN đăng nhập; bố mẹ không biết PIN này. Góc bình yên tự khóa sau " + idleMinutes + " phút con không chạm.",
    "Máy chủ chỉ ghi giờ con mở khóa Góc bình yên (để tự khóa đúng giờ), không ghi con làm gì ở đây.",
    "Nếu con quên PIN, bố mẹ chỉ có thể xóa nó. Khi đó chữ con viết trên máy cũng bị xóa, và lần sau mở con sẽ được báo.",
    "Về kỹ thuật, người quản trị hệ thống (bố mẹ) vẫn có thể mở bảng dữ liệu. Bố mẹ hứa không làm vậy.",
  ];
}
