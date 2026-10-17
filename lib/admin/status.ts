import type { Status } from "@/lib/dayState";

/** Parent-facing wording of a child's status (Xem gộp, Mở/khóa). */
export const STATUS_LABEL: Record<Status, string> = {
  LOCK_P1: "Đang làm Phần 1 · máy chỉ mở trang học",
  BREAK_OFFER: "Xong Phần 1, chưa nghỉ",
  BREAK: "Đang nghỉ · mở mọi trang",
  LOCK_P2: "Đang làm Phần 2 · máy chỉ mở trang học",
  FREE: "Đang giờ tự do · mở mọi trang",
  LOCK_END: "Đã hết giờ tự do · máy chỉ mở trang học",
  OPEN_SICK: "Ngày ốm — máy mở cả ngày",
  OPEN_TRUST: "Chế độ Tin tưởng · mở mọi trang",
  OPEN_OVERRIDE: "Bố mẹ đang mở máy",
  LOCK_OVERRIDE: "Bố mẹ đang khóa máy",
};
