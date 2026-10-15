"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";

/** Hides a homework item from the child (assigned by mistake). Nothing is deleted. */
export function ArchiveButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        disabled={busy}
        aria-label={`Gỡ bài ${label}`}
        className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-accent disabled:opacity-60"
        onClick={async () => {
          if (!window.confirm("Gỡ bài này khỏi danh sách của con?")) return;
          setBusy(true);
          const err = await sendJson("PATCH", `/api/admin/homework/${id}`, { archived: true });
          setBusy(false);
          if (err) setError(err);
          else router.refresh();
        }}
      >
        Gỡ
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
