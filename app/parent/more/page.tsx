import Link from "next/link";
import { requireParentPage } from "@/lib/admin/page";
import { unreadFeedbackCount } from "@/lib/feedback/parent";
import { SignOutButton } from "../../sign-out-button";
import { ParentHeader } from "../parent-header";

export const dynamic = "force-dynamic";

const GROUPS: { title: string; links: { href: string; label: string; sub: string; badge?: "feedback" }[] }[] = [
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

/** "Thêm": the pages a parent opens once in a while (UI review 19/10/2026). */
export default async function MorePage() {
  const { db } = await requireParentPage();
  const unread = await unreadFeedbackCount(db);
  return (
    <>
      <ParentHeader title="Thêm" current="/parent/more" />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        {GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={`more-${g.title}`} className="flex flex-col gap-2">
            <h2 id={`more-${g.title}`} className="px-1 text-xs font-extrabold tracking-wider text-ink/70 uppercase">
              {g.title}
            </h2>
            <ul className="rounded-2xl bg-white px-4">
              {g.links.map((l) => (
                <li key={l.href} className="border-t border-ink/10 first:border-t-0">
                  <Link href={l.href} className="flex min-h-15 items-center gap-3 py-2">
                    <span className="flex grow flex-col">
                      <span className="font-bold">{l.label}</span>
                      <span className="text-sm text-ink/70">{l.sub}</span>
                    </span>
                    {l.badge === "feedback" && unread > 0 && (
                      <span className="flex min-w-7 items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-sm font-bold text-white">
                        {unread}
                        <span className="sr-only"> chưa đọc</span>
                      </span>
                    )}
                    <span aria-hidden className="text-lg text-ink/50">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <SignOutButton />
      </main>
    </>
  );
}
