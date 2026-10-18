import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "../sign-out-button";
import { RequestsBadge } from "./requests-badge";

const LINKS = [
  { href: "/parent", label: "Tổng quan" },
  { href: "/parent/control", label: "Mở/khóa" },
  { href: "/parent/requests", label: "Xin mở" },
  { href: "/parent/review", label: "Xem gộp" },
  { href: "/parent/homework", label: "Giao bài" },
  { href: "/parent/templates", label: "Mẫu việc" },
  { href: "/parent/slots", label: "App môn học" },
  { href: "/parent/allowlist", label: "Trang học" },
  { href: "/parent/devices", label: "Thiết bị" },
  { href: "/parent/settings", label: "Cài đặt" },
] as const;

/** Shared header for parent pages (mockup: white bar, small caps "Phụ huynh", bold title). */
export async function ParentHeader({ title, current }: { title: string; current: (typeof LINKS)[number]["href"] }) {
  // Pending "Xin mở trang" for the red badge (RLS: this family only); 0 if unreadable.
  const { count } = await (await createClient()).from("unlock_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
  return (
    <header className="sticky top-0 z-10 border-b border-ink/10 bg-white">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pt-4 pb-2">
        <div className="flex flex-col">
          <span className="text-xs font-bold tracking-wider text-ink/70 uppercase">Phụ huynh</span>
          <h1 className="text-xl font-extrabold">{title}</h1>
        </div>
        <SignOutButton />
      </div>
      <nav aria-label="Trang phụ huynh" className="no-scrollbar mx-auto max-w-lg overflow-x-auto px-4 pb-3">
        <ul className="flex gap-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={l.href === current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${
                  l.href === current ? "border-ink bg-ink text-white" : "border-ink/25 bg-white text-ink"
                }`}
              >
                {l.label}
                {l.href === "/parent/requests" && <RequestsBadge initial={count ?? 0} />}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
