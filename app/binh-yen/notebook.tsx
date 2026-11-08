"use client";

import { useEffect, useId, useState } from "react";
import { TOPICS, findShownDossier } from "@/lib/binhYen/dossier";
import { NOTEBOOK_EVENT, NOTEBOOK_KEY, readNotebook, type NotebookEntry } from "@/lib/binhYen/notebook";
import { DossierCard } from "./dossier";

/**
 * R7c "Sổ tay thám tử": the Hồ sơ mật cards Nguyên kept, on this device only. Newest first,
 * tap one to read it again. No count, no badge. Updates when a card is kept in the corner
 * (`dossier:saved`) or in another tab (`storage`).
 */
export function Notebook() {
  const [entries, setEntries] = useState<NotebookEntry[] | null>(null);
  const head = useId();

  useEffect(() => {
    const load = () => setEntries(readNotebook());
    // Read after mount, never during the first render.
    const id = window.setTimeout(load, 0);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === NOTEBOOK_KEY) load();
    };
    window.addEventListener(NOTEBOOK_EVENT, load);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener(NOTEBOOK_EVENT, load);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <section aria-labelledby={head} className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 id={head} className="text-base font-bold">
          <span aria-hidden className="mr-1.5">
            📓
          </span>
          Sổ tay thám tử
        </h3>
        <p className="text-xs text-ink/65">Trên máy này · chỉ con thấy</p>
      </div>
      {entries && entries.length === 0 && <p className="rounded-xl bg-bg p-3 text-sm text-ink/75">Chưa cất hồ sơ nào. Sau mỗi lần ghé, con có thể mở một hồ sơ mật.</p>}
      {entries && entries.length > 0 && (
        <ul aria-label="Hồ sơ đã cất" className="flex flex-col gap-1.5">
          {entries.map((e) => {
            const card = findShownDossier(e.key);
            if (!card) return null;
            return (
              <li key={e.key}>
                <details className="group/dossier rounded-xl bg-bg">
                  <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold marker:content-none">
                    <span aria-hidden>{TOPICS[card.topic].emoji}</span>
                    <span className="min-w-0 grow">{card.title}</span>
                    <span aria-hidden className="text-ink/50 transition-transform group-open/dossier:rotate-90 motion-reduce:transition-none">
                      ›
                    </span>
                  </summary>
                  <div className="px-1.5 pb-1.5">
                    <DossierCard card={card} level={4} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
