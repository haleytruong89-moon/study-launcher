import Link from "next/link";
import { pendingForParent } from "@/lib/admin/pending";
import { createClient } from "@/lib/supabase/server";
import { RequestsBadge } from "./requests-badge";
import { unseenTalkCount } from "@/lib/binhYen/parent";
import { TalkBanner } from "./talk-banner";

/** Every parent page; the tab it belongs to (UI review 19/10/2026: 4 tabs at the bottom). */
const PAGES = {
  "/parent": "home",
  "/parent/review": "home",
  "/parent/homework": "homework",
  "/parent/requests": "requests",
  "/parent/talk": "requests",
  "/parent/more": "more",
  "/parent/children": "more",
  "/parent/templates": "more",
  "/parent/slots": "more",
  "/parent/allowlist": "more",
  "/parent/devices": "more",
  "/parent/settings": "more",
  "/parent/notifications": "more",
} as const;

export type ParentPage = keyof typeof PAGES;
type Tab = (typeof PAGES)[ParentPage];

const TABS: { tab: Tab; href: string; label: string; icon: React.ReactNode }[] = [
  {
    tab: "home",
    href: "/parent",
    label: "Hôm nay",
    icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  },
  {
    tab: "homework",
    href: "/parent/homework",
    label: "Giao bài",
    icon: (
      <>
        <path d="M4 4h12l4 4v12H4z" />
        <path d="M8 12h8M8 16h5" />
      </>
    ),
  },
  {
    tab: "requests",
    href: "/parent/requests",
    label: "Con nhờ",
    icon: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0" />
      </>
    ),
  },
  {
    tab: "more",
    href: "/parent/more",
    label: "Thêm",
    icon: (
      <>
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </>
    ),
  },
];

/** The 4-tab bar fixed at the bottom of every parent page (thumb reach on a phone). */
export async function ParentTabs({ current }: { current: ParentPage }) {
  // Pending child requests for the red badge (RLS: this family only).
  const count = await pendingForParent(await createClient());
  const active = PAGES[current];
  return (
    <nav aria-label="Trang phụ huynh" className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {TABS.map((t) => (
          <li key={t.tab}>
            <Link
              href={t.href}
              aria-current={t.tab === active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs ${t.tab === active ? "font-extrabold text-accent" : "font-semibold text-ink/70"}`}
            >
              <span className="relative inline-flex">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {t.icon}
                </svg>
                {t.tab === "requests" && (
                  <span className="absolute -top-2 -right-3">
                    <RequestsBadge initial={count ?? 0} />
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Shared header for parent pages: a plain title (+ "‹ Thêm" on the less used pages) and the tab bar. */
export async function ParentHeader({ title, current }: { title: string; current: ParentPage }) {
  const back = PAGES[current] === "more" && current !== "/parent/more";
  // Góc bình yên: an unseen "Con muốn nói chuyện" shows on top of every parent page.
  const talk = await unseenTalkCount(await createClient());
  return (
    <>
      <TalkBanner initial={talk} />
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-lg flex-col px-4 pt-3 pb-3">
          {back ? (
            <Link href="/parent/more" className="-ml-1 inline-flex min-h-11 items-center self-start px-1 text-sm font-bold text-accent">
              ‹ Thêm
            </Link>
          ) : (
            <span className="pt-2 text-xs font-bold tracking-wider text-ink/70 uppercase">Phụ huynh</span>
          )}
          <h1 className="text-2xl font-extrabold">{title}</h1>
        </div>
      </header>
      <ParentTabs current={current} />
    </>
  );
}
