/** Links of the parent's "Thêm" page (UI review 19/10/2026; tutor link L-2, 15/11/2026). */

export type MoreLink = { href: string; label: string; sub: string; badge?: "feedback"; external?: boolean };

/** L-2 (15/11/2026): the tutor app's parent page, another zone behind the /gia-su rewrite (D20). */
const TUTOR_LINK: MoreLink = {
  href: "/gia-su/bo-me",
  label: "Gia sư AI Toán",
  sub: "Hồ sơ dạy học, bật/tắt cô gia sư cho từng con",
  external: true,
};

const GROUPS: { title: string; links: MoreLink[] }[] = [
  {
    title: "Máy của con",
    links: [
      { href: "/parent/allowlist", label: "Trang học được mở", sub: "Trang con mở được trong giờ học" },
      { href: "/parent/devices", label: "Thiết bị", sub: "Ghép laptop của con, xem máy đã ghép" },
    ],
  },
  {
    title: "Việc của con",
    links: [
      { href: "/parent/week", label: "Tổng kết tuần", sub: "Tuần qua của các con, gợi ý kèm con cuối tuần (tối Thứ Sáu)" },
      { href: "/parent/templates", label: "Lịch việc mỗi tuần", sub: "Bài bổ sung + kỹ năng theo thứ" },
      { href: "/parent/slots", label: "App môn học", sub: "Nút mở app trên màn của con" },
    ],
  },
  {
    title: "Gia đình",
    links: [
      { href: "/parent/children", label: "Các con", sub: "Tên, lớp, màu, mật khẩu, chế độ Tin tưởng" },
      { href: "/parent/feedback", label: "Góp ý của con", sub: "Con thích / chưa thích gì, ý tưởng cho app", badge: "feedback" },
      { href: "/parent/settings", label: "Luật trong nhà", sub: "Giờ tự do, nghỉ, thẻ miễn, giờ ngủ" },
      { href: "/parent/notifications", label: "Thông báo", sub: "Báo lên điện thoại khi con xin mở trang, nhờ xem bài" },
      { href: "/parent/log", label: "Nhật ký", sub: "Ai đã làm gì: mở/khóa, giao bài, xin mở trang, Tin tưởng…" },
    ],
  },
];

/** The groups of "Thêm"; "Gia sư AI Toán" goes right under "App môn học" when the tutor is set up. */
export function moreGroups(hasTutor: boolean): { title: string; links: MoreLink[] }[] {
  return GROUPS.map((g) => (hasTutor && g.title === "Việc của con" ? { ...g, links: [...g.links, TUTOR_LINK] } : g));
}
