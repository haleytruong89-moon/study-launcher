import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ôn tập" };

/**
 * Ôn tập (SQL 0029): the review apps the viewer may open. RLS picks the rows: a child sees the
 * active apps meant for them or for the whole family; a parent sees all (off ones marked).
 * Each app opens as its own page (/on-tap/<slug>) — a plain <a>, the app is not a Next.js page.
 */
export default async function OnTapPage() {
  const me = await getCurrentUser();
  if (!me?.profile) redirect(`/login?next=${encodeURIComponent("/on-tap")}`);
  const isParent = me.profile.role === "parent";
  const color = me.profile.color ?? "#2B5D4F";

  const db = await createClient();
  const { data } = await db.from("study_apps").select("slug, title, active").order("title");
  const apps = (data ?? []) as { slug: string; title: string; active: boolean }[];

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <Link href={isParent ? "/parent/on-tap" : "/today"} className="min-h-11 self-start py-2 font-semibold text-ink/70">
        ← {isParent ? "Quản lý app ôn tập" : "Về Hôm nay"}
      </Link>
      <h1 className="text-2xl font-extrabold">Ôn tập</h1>
      {apps.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-ink/70">Chưa có app ôn tập nào. Bố mẹ thêm ở Thêm › App ôn tập.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {apps.map((a) => (
            <li key={a.slug}>
              {/* The app is a standalone page, not a Next.js route: plain <a>. */}
              <a
                href={`/on-tap/${a.slug}`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 no-underline"
                style={{ borderLeft: `6px solid ${color}` }}
              >
                <span className="text-lg font-bold text-ink">{a.title}</span>
                {!a.active && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-sm text-ink/70">đang tắt</span>}
                <span aria-hidden className="text-xl text-ink/50">
                  ›
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-ink/60">Tiến độ của mỗi app được lưu trên máy em đang dùng.</p>
    </main>
  );
}
