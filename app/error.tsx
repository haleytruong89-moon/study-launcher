"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Friendly error page (review 12/11/2026). A child may see this, so it never shows the error
 * text or stack: the details go to the console only. Own styles only (works under the Góc bình
 * yên CSP: no external resources).
 */
export default function AppError({
  error,
  retry,
  reset,
}: {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // retry() re-fetches server data (Next 16); reset() only re-renders. Use whichever exists.
  const again = retry ?? reset;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 bg-bg px-6 py-10 text-ink">
      <h1 className="text-xl font-bold">Có lỗi nhỏ, không sao đâu</h1>
      <p className="text-base text-ink/75">
        Trang này chưa mở được. Con bấm &ldquo;Thử lại&rdquo; nhé. Nếu vẫn chưa được, quay về Hôm nay hoặc báo bố mẹ.
      </p>
      <div className="flex flex-col gap-3 pt-2">
        {again && (
          <button type="button" onClick={() => again()} className="btn bg-accent text-white">
            Thử lại
          </button>
        )}
        <Link href="/today" className="btn border-2 border-accent text-accent">
          Về Hôm nay
        </Link>
      </div>
    </main>
  );
}
