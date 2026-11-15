import Link from "next/link";
import { requireParentPage } from "@/lib/admin/page";
import { type MoreLink, moreGroups } from "@/lib/parent/more";
import { tutorOrigin } from "@/lib/tutor/entry";
import { unreadFeedbackCount } from "@/lib/feedback/parent";
import { SignOutButton } from "../../sign-out-button";
import { ParentHeader } from "../parent-header";

export const dynamic = "force-dynamic";

/** "Thêm": the pages a parent opens once in a while (UI review 19/10/2026). */
export default async function MorePage() {
  const { db } = await requireParentPage();
  const unread = await unreadFeedbackCount(db);
  // Without TUTOR_APP_ORIGIN there is no /gia-su rewrite, so no link either (page as before).
  const groups = moreGroups(tutorOrigin(process.env.TUTOR_APP_ORIGIN) !== null);
  return (
    <>
      <ParentHeader title="Thêm" current="/parent/more" />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        {groups.map((g) => (
          <section key={g.title} aria-labelledby={`more-${g.title}`} className="flex flex-col gap-2">
            <h2 id={`more-${g.title}`} className="px-1 text-xs font-extrabold tracking-wider text-ink/70 uppercase">
              {g.title}
            </h2>
            <ul className="rounded-2xl bg-white px-4">
              {g.links.map((l) => (
                <li key={l.href} className="border-t border-ink/10 first:border-t-0">
                  <MoreRow link={l} unread={unread} />
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

function MoreRow({ link: l, unread }: { link: MoreLink; unread: number }) {
  const body = (
    <>
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
    </>
  );
  // Another zone (the tutor app behind the rewrite): a plain <a>, never next/link (D20).
  return l.external ? (
    <a href={l.href} className="flex min-h-15 items-center gap-3 py-2">
      {body}
    </a>
  ) : (
    <Link href={l.href} className="flex min-h-15 items-center gap-3 py-2">
      {body}
    </Link>
  );
}
