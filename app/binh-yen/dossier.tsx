"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Quad } from "@/lib/binhYen/catalog";
import { TOPICS, TOPIC_KEYS, dossierFor, type Dossier, type DossierTopic } from "@/lib/binhYen/dossier";
import { addToNotebook, isInNotebook, readTopic, writeTopic } from "@/lib/binhYen/notebook";

/**
 * R7c Hồ sơ mật (Nguyên only): an optional "fact" card on the "Xong rồi" step, and the card
 * look shared with the notebook. Nothing here talks to the server or is logged; the topic and
 * the notebook live in this browser (lib/binhYen/notebook.ts).
 */

const PAPER = "#F7F2E7";

/** One card: paper, a 2px ink border, the "HỒ SƠ MẬT" eyebrow, the source shown small. */
export function DossierCard({
  card,
  level = 3,
  headingRef,
}: {
  card: Dossier;
  level?: 3 | 4;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const id = useId();
  const t = TOPICS[card.topic];
  const H = level === 3 ? "h3" : "h4";
  return (
    <article aria-labelledby={id} className="flex flex-col gap-2 rounded-xl border-2 border-ink p-4" style={{ background: PAPER }}>
      <p className="text-[11px] font-extrabold tracking-[0.12em] text-ink/70">
        HỒ SƠ MẬT · <span aria-hidden>{t.emoji}</span> {t.label.toUpperCase()}
      </p>
      <H id={id} ref={headingRef} tabIndex={-1} className="text-lg leading-snug font-bold outline-none">
        {card.title}
      </H>
      <p className="leading-relaxed">{card.body}</p>
      {card.tryIt && (
        <p className="rounded-lg border border-dashed border-ink/30 bg-white/60 px-3 py-2 text-sm">
          <b>Thử nhỏ:</b> {card.tryIt}
        </p>
      )}
      <p className="text-xs text-ink/65">Nguồn: {card.source}</p>
    </article>
  );
}

/** "Asia/Ho_Chi_Minh" date of this instant, as "YYYY-MM-DD". */
export const vnDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d);

/**
 * Collapsed until tapped: "📁 Mở hồ sơ mật hôm nay?". Open: the 5 topic chips and the card for
 * (today, this visit's quad, topic), with "Cất vào sổ tay" and "Đóng".
 */
export function DossierOffer({ today, quad }: { today: string; quad: Quad | null }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<DossierTopic>("nao");
  /** The card key known to be in the notebook (read after mount / on change). */
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const card = dossierFor(today, quad, topic);
  const saved = savedKey === card.key;

  // The last topic picked on this device (after mount, never during the first render).
  useEffect(() => {
    const id = window.setTimeout(() => {
      const t = readTopic();
      if (t) setTopic(t);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSavedKey(isInNotebook(card.key) ? card.key : null);
      setFailed(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [card.key]);

  // Focus: the card heading when opened, the toggle again when closed.
  useEffect(() => {
    if (open) heading.current?.focus();
    else if (wasOpen.current) toggle.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!open) {
    return (
      <button
        ref={toggle}
        type="button"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-ink/15 bg-white px-4 text-left font-semibold"
      >
        <span>
          <span aria-hidden className="mr-2">
            📁
          </span>
          Mở hồ sơ mật hôm nay?
        </span>
        <span aria-hidden className="text-ink/50">
          ›
        </span>
      </button>
    );
  }

  function save() {
    addToNotebook(today, card.key);
    const ok = isInNotebook(card.key);
    setSavedKey(ok ? card.key : null);
    setFailed(!ok);
  }

  return (
    <section aria-label="Hồ sơ mật" className="flex flex-col gap-3 rounded-2xl bg-bg p-3">
      <div role="group" aria-label="Chủ đề hồ sơ" className="flex flex-wrap gap-2">
        {TOPIC_KEYS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={topic === t}
            onClick={() => {
              setTopic(t);
              writeTopic(t);
            }}
            className={`min-h-11 rounded-full border-[1.5px] px-3.5 text-sm font-semibold ${topic === t ? "border-ink bg-ink text-white" : "border-ink/20 bg-white text-ink"}`}
          >
            <span aria-hidden className="mr-1">
              {TOPICS[t].emoji}
            </span>
            {TOPICS[t].label}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        <DossierCard key={card.key} card={card} headingRef={heading} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={saved} onClick={save} className="btn border-2 border-ink bg-white font-semibold disabled:border-ink/30 disabled:text-ink/70">
          {saved ? "Đã cất ✓" : "Cất vào sổ tay"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn font-semibold text-ink/75 underline">
          Đóng
        </button>
      </div>
      {failed && (
        <p role="status" className="text-sm text-ink/75">
          Máy này chưa cất được. Không sao, con vẫn đọc được ở đây.
        </p>
      )}
    </section>
  );
}
