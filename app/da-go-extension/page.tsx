import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Study Launcher — đã gỡ extension" };

/** Shown by the browser right after the extension is removed (S6). Public, neutral, no data. */
export default function ExtensionRemovedPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">Đã gỡ extension Study Launcher</h1>
      <p className="text-ink/80">
        Extension Study Launcher không còn trên trình duyệt này. Bố mẹ sẽ nhận được thông báo để cùng con xem lại khi cần.
      </p>
      <Link href="/today" className="btn min-h-12 bg-accent text-white">
        Về trang Hôm nay
      </Link>
    </main>
  );
}
