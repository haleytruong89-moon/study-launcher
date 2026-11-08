"use client";

import { useEffect, useId, useState } from "react";
import { findShownDossier } from "@/lib/binhYen/dossier";
import { findShownFieldNote } from "@/lib/binhYen/fieldNotes";
import type { NotebookEntry } from "@/lib/binhYen/notebook";
import { DECKS, DossierCard, type Deck, type DeckCardData } from "./dossier";

const COPY: Record<Deck, { title: string; list: string; empty: string; find: (key: string) => DeckCardData | undefined }> = {
  detective: {
    title: "Sổ tay thám tử",
    list: "Hồ sơ đã cất",
    empty: "Chưa cất hồ sơ nào. Sau mỗi lần ghé, con có thể mở một hồ sơ mật.",
    find: findShownDossier,
  },
  scientist: {
    title: "Sổ tay nhà khoa học",
    list: "Trang đã cất",
    empty: "Chưa cất trang nào. Sau mỗi lần ghé, con có thể mở một trang sổ tay.",
    find: findShownFieldNote,
  },
};

/**
 * The cards a child kept, on this device only: Nguyên's "Sổ tay thám tử" (R7c) or An's
 * "Sổ tay nhà khoa học" (R7d), one notebook per deck. Newest first, tap one to read it again.
 * No count, no badge. Updates when a card is kept in the corner (the deck's saved event) or in
 * another tab (`storage`).
 */
export function Notebook({ deck = "detective" }: { deck?: Deck }) {
  const [entries, setEntries] = useState<NotebookEntry[] | null>(null);
  const head = useId();
  const store = DECKS[deck].store;
  const copy = COPY[deck];

  useEffect(() => {
    const load = () => setEntries(store.read());
    // Read after mount, never during the first render.
    const id = window.setTimeout(load, 0);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === store.storageKey) load();
    };
    window.addEventListener(store.event, load);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener(store.event, load);
      window.removeEventListener("storage", onStorage);
    };
  }, [store]);

  return (
    <section aria-labelledby={head} className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 id={head} className="text-base font-bold">
          <span aria-hidden className="mr-1.5">
            📓
          </span>
          {copy.title}
        </h3>
        <p className="text-xs text-ink/65">Trên máy này · chỉ con thấy</p>
      </div>
      {entries && entries.length === 0 && <p className="rounded-xl bg-bg p-3 text-sm text-ink/75">{copy.empty}</p>}
      {entries && entries.length > 0 && (
        <ul aria-label={copy.list} className="flex flex-col gap-1.5">
          {entries.map((e) => {
            const card = copy.find(e.key);
            if (!card) return null;
            return (
              <li key={e.key}>
                <details className="group/dossier rounded-xl bg-bg">
                  <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold marker:content-none">
                    <span aria-hidden>{DECKS[deck].topic(card.topic).emoji}</span>
                    <span className="min-w-0 grow">{card.title}</span>
                    <span aria-hidden className="text-ink/50 transition-transform group-open/dossier:rotate-90 motion-reduce:transition-none">
                      ›
                    </span>
                  </summary>
                  <div className="px-1.5 pb-1.5">
                    <DossierCard card={card} deck={deck} level={4} />
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
