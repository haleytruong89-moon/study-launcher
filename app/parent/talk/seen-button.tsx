"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";

export function SeenButton({ id }: { id: string }) {
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
          const err = await sendJson("POST", `/api/admin/talk/${id}/seen`, {});
          setBusy(false);
          if (err) setError(err);
          router.refresh();
        }}
        className="min-h-12 rounded-xl bg-accent text-sm font-bold text-white disabled:opacity-60"
      >
        Đã thấy
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
