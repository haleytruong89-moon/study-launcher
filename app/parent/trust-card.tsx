"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";
import type { TrustSuggestion } from "@/lib/admin/trust";

/**
 * The weekly "Chế độ Tin tưởng" suggestion on a child's card (S3d). The system only suggests;
 * the parent's tap is the decision. "Để sau" hides it until next Monday.
 */
export function TrustCard({
  childId,
  suggestion,
  title,
  changes,
  yes,
}: {
  childId: string;
  suggestion: TrustSuggestion;
  title: string;
  changes: string[];
  yes: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const err = await sendJson("POST", "/api/admin/trust", { childId, ...body });
    setBusy(false);
    if (err) return setError(err);
    router.refresh();
  }

  return (
    <section aria-label="Gợi ý chế độ Tin tưởng" className="mx-4 mt-3 flex flex-col gap-3 rounded-2xl border-2 border-accent bg-[#E3EEEA] p-4 text-ink">
      <h3 className="font-extrabold">{title}</h3>
      <div>
        <p className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">Khi chuyển</p>
        <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-sm">
          {changes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void send({ mode: suggestion, via: "suggestion" })}
          className="min-h-12 rounded-xl bg-accent px-2 font-extrabold text-white disabled:opacity-60"
        >
          {yes}
        </button>
        <button type="button" disabled={busy} onClick={() => void send({ later: suggestion })} className="min-h-12 rounded-xl border-[1.5px] border-accent bg-white px-2 font-extrabold text-accent disabled:opacity-60">
          Để sau
        </button>
      </div>
      <p className="-mt-1 text-xs text-ink/70">Hệ thống chỉ gợi ý — bố mẹ quyết. “Để sau” ẩn gợi ý đến thứ Hai tuần sau.</p>
    </section>
  );
}
