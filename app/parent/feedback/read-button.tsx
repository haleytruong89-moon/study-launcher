"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";

/** "Đã đọc" on one feedback (sets seen_at with the parent's own session). */
export function ReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const err = await sendJson("POST", `/api/admin/feedback/${id}/seen`, {});
          setBusy(false);
          if (err) setError(err);
          router.refresh();
        }}
        className="btn self-start border border-ink/25 bg-white text-sm disabled:opacity-60"
      >
        Đã đọc
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
