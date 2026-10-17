"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { parseBlockedUrl } from "../../extension/src/core/blockedUrl";

const noop = () => () => {};

/** Host of the blocked page, shown as plain text only (the value is untrusted). */
function blockedHost(): string | null {
  const raw = parseBlockedUrl(window.location.href);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.hostname : u.protocol.replace(":", "");
  } catch {
    return null;
  }
}

export function BlockedView() {
  const host = useSyncExternalStore(noop, blockedHost, () => null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-2xl text-white" aria-hidden>
        ⏳
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Đang giờ học</h1>
        <p className="text-base text-ink/80">
          {host ? (
            <>
              Trang <strong className="break-all">{host}</strong> mở lại khi con xong việc hôm nay (giờ nghỉ hoặc giờ tự do).
            </>
          ) : (
            "Trang này mở lại khi con xong việc hôm nay (giờ nghỉ hoặc giờ tự do)."
          )}
        </p>
        <p className="text-sm text-ink/65">Cần trang này để học? Nhờ bố mẹ mở ở mục “Mở/khóa”, hoặc thêm vào danh sách trang học.</p>
      </div>
      <Link href="/today" className="btn bg-accent text-base text-white">
        Về việc hôm nay
      </Link>
    </main>
  );
}
