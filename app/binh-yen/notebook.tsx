"use client";

import { useEffect, useId, useRef, useState } from "react";
import { findShownDossier } from "@/lib/binhYen/dossier";
import { findShownFieldNote } from "@/lib/binhYen/fieldNotes";
import type { NotebookEntry } from "@/lib/binhYen/notebook";
import { NOTEBOOK_FILE_MAX_BYTES, mergeNotebook, notebookFileName, parseNotebookFile, serializeNotebook, type NotebookKind } from "@/lib/binhYen/notebookFile";
import { localDate } from "@/lib/time";
import { DECKS, DossierCard, type Deck, type DeckCardData } from "./dossier";

const COPY: Record<Deck, { kind: NotebookKind; title: string; list: string; empty: string; find: (key: string) => DeckCardData | undefined }> = {
  detective: {
    kind: "dossier",
    title: "Sổ tay thám tử",
    list: "Hồ sơ đã cất",
    empty: "Chưa cất hồ sơ nào. Sau mỗi lần ghé, con có thể mở một hồ sơ mật.",
    find: findShownDossier,
  },
  scientist: {
    kind: "field",
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
      {entries && <KeepNotebook deck={deck} empty={entries.length === 0} />}
    </section>
  );
}

const NOT_OURS = "Tệp này không phải sổ tay của con.";

/**
 * "Giữ sổ tay" (Đợt 4, 12/11/2026): save the notebook to a file on this device and load it
 * back (after clearing the browser, or on another device). No server: a Blob download and a
 * file picker. The file holds only card ids + dates (lib/binhYen/notebookFile.ts); loading
 * merges and never deletes. Rendered only after mount (entries read), so storage is never
 * touched during the first render.
 */
function KeepNotebook({ deck, empty }: { deck: Deck; empty: boolean }) {
  const store = DECKS[deck].store;
  const copy = COPY[deck];
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const head = useId();

  function download() {
    try {
      const text = serializeNotebook(copy.kind, store.read());
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = notebookFileName(localDate(new Date()));
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Safari needs the URL a little after the click; free it later.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNote("Đã tải về. Tệp nằm trong mục Tải về (Downloads) của máy.");
    } catch {
      setNote("Máy này chưa tải về được. Con thử lại sau nhé.");
    }
  }

  async function load(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > NOTEBOOK_FILE_MAX_BYTES) {
        setNote(NOT_OURS);
        return;
      }
      const parsed = parseNotebookFile(await file.text(), copy.kind, copy.find);
      if (!parsed.ok) {
        setNote(NOT_OURS);
        return;
      }
      const current = store.read();
      const { entries, added } = mergeNotebook(current, parsed.pages);
      // Write only when something changed (a new page, or an earlier date for one already here).
      if (JSON.stringify(entries) !== JSON.stringify(current) && !store.replace(entries)) {
        setNote("Máy này chưa lưu được. Con thử lại sau nhé.");
        return;
      }
      const skipped = parsed.skipped > 0 ? ` Bỏ qua ${parsed.skipped} trang máy này không có.` : "";
      setNote(`Đã nạp ${parsed.pages.length} trang (${added} trang mới).${skipped}`);
    } catch {
      setNote(NOT_OURS);
    } finally {
      setBusy(false);
      // The same file can be picked again.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div role="group" aria-labelledby={head} className="mt-1 flex flex-col gap-2 rounded-xl border border-ink/10 p-3">
      <p id={head} className="text-sm font-semibold">
        Giữ sổ tay
      </p>
      <p className="text-xs text-ink/70">Sổ tay chỉ nằm trên máy này. Tải về để giữ, hoặc nạp lại khi đổi máy.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={empty} onClick={download} className="btn border-[1.5px] border-ink/25 bg-white px-3.5 text-sm disabled:text-ink/45">
          Tải sổ tay về máy
        </button>
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="btn border-[1.5px] border-ink/25 bg-white px-3.5 text-sm disabled:text-ink/45">
          Nạp lại sổ tay
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          aria-hidden
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => void load(e.target.files?.[0])}
        />
      </div>
      <div role="status">{note && <p className="text-sm text-ink/75">{note}</p>}</div>
    </div>
  );
}
