"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Quad } from "@/lib/binhYen/catalog";
import { TOPICS, TOPIC_KEYS, dossierFor, isDossierTopic, type Dossier } from "@/lib/binhYen/dossier";
import { SCIENCE_TOPICS, activeScienceTopics, fieldNoteFor, isScienceTopic, type FieldNote } from "@/lib/binhYen/fieldNotes";
import { DOSSIER_NOTEBOOK, FIELD_NOTEBOOK, type NotebookStore } from "@/lib/binhYen/notebook";

/**
 * Optional daily cards on the "Xong rồi" step, and the card look shared with the notebook.
 * Two decks, picked by the child's voice:
 * - "detective" (Nguyên, R7c): Hồ sơ mật.
 * - "scientist" (An, R7d): Sổ tay nhà khoa học, a field-notebook page.
 * Nothing here talks to the server or is logged; the topic and the notebook live in this
 * browser (lib/binhYen/notebook.ts), one notebook per deck.
 */

export type Deck = "detective" | "scientist";

/** A card of either deck (they share every field; only the topic set differs). */
export type DeckCardData = Dossier | FieldNote;

interface DeckSpec {
  topicKeys: () => readonly string[];
  topic: (t: string) => { label: string; emoji: string };
  defaultTopic: string;
  pick: (date: string, quad: Quad | null, topic: string) => DeckCardData | null;
  store: NotebookStore<string>;
  offer: { emoji: string; text: string };
  sectionLabel: string;
  chipsLabel: string;
}

export const DECKS: Record<Deck, DeckSpec> = {
  detective: {
    topicKeys: () => TOPIC_KEYS,
    topic: (t) => TOPICS[isDossierTopic(t) ? t : "nao"],
    defaultTopic: "nao",
    pick: (date, quad, t) => (isDossierTopic(t) ? dossierFor(date, quad, t) : null),
    store: DOSSIER_NOTEBOOK,
    offer: { emoji: "📁", text: "Mở hồ sơ mật hôm nay?" },
    sectionLabel: "Hồ sơ mật",
    chipsLabel: "Chủ đề hồ sơ",
  },
  scientist: {
    // Only topics that have cards yet (the deck is written in two halves).
    topicKeys: () => activeScienceTopics(),
    topic: (t) => SCIENCE_TOPICS[isScienceTopic(t) ? t : "dong_vat"],
    defaultTopic: "dong_vat",
    pick: (date, quad, t) => (isScienceTopic(t) ? fieldNoteFor(date, quad, t) : null),
    store: FIELD_NOTEBOOK,
    offer: { emoji: "📓", text: "Mở sổ tay nhà khoa học hôm nay?" },
    sectionLabel: "Sổ tay nhà khoa học",
    chipsLabel: "Chủ đề sổ tay",
  },
};

const PAPER = "#F7F2E7";
const FIELD_PAPER = "#F3F7EE";
/** Faint ruled lines under the body text, one per 28px line (`leading-7`), like a field notebook page. */
const RULED = "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgb(43 93 79 / 0.14) 27px, rgb(43 93 79 / 0.14) 28px)";

/** "Thử nhỏ: … Ghi chép: …" → the try-it and its "Ghi chép" part, both as written. */
function splitNote(tryIt: string): { try: string; note: string | null } {
  const i = tryIt.indexOf("Ghi chép:");
  if (i <= 0) return { try: tryIt, note: null };
  return { try: tryIt.slice(0, i).trim(), note: tryIt.slice(i + "Ghi chép:".length).trim() };
}

/**
 * One card. Detective: paper, a 2px ink border, the "HỒ SƠ MẬT" eyebrow. Scientist: a field
 * notebook page (light green, ruled, a 2px border in An's colour), "SỔ TAY NHÀ KHOA HỌC".
 * The source is shown small under both.
 */
export function DossierCard({
  card,
  deck = "detective",
  level = 3,
  headingRef,
}: {
  card: DeckCardData;
  deck?: Deck;
  level?: 3 | 4;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const id = useId();
  const t = DECKS[deck].topic(card.topic);
  const H = level === 3 ? "h3" : "h4";

  if (deck === "scientist") {
    const parts = card.tryIt ? splitNote(card.tryIt) : null;
    return (
      <article aria-labelledby={id} className="flex flex-col gap-2 rounded-xl border-2 border-an p-4" style={{ background: FIELD_PAPER }}>
        <p className="text-[11px] font-extrabold tracking-[0.12em] text-an">
          SỔ TAY NHÀ KHOA HỌC ·{" "}
          <span className="inline-block">
            <span aria-hidden>{t.emoji}</span> {t.label.toUpperCase()}
          </span>
        </p>
        <H id={id} ref={headingRef} tabIndex={-1} className="text-lg leading-snug font-bold outline-none">
          {card.title}
        </H>
        {/* Ruled like a notebook page: one faint line under each 28px text line. */}
        <p className="leading-7" style={{ backgroundImage: RULED }}>
          {card.body}
        </p>
        {parts && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-an/45 bg-white/75 px-3 py-2 text-sm">
            <p>
              <b>Thử nhỏ:</b> {parts.try}
            </p>
            {parts.note && (
              <p className="border-t border-dashed border-an/30 pt-1.5">
                <b>Ghi chép:</b> {parts.note}
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-ink/65">Nguồn: {card.source}</p>
      </article>
    );
  }

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
 * Collapsed until tapped ("📁 Mở hồ sơ mật hôm nay?" / "📓 Mở sổ tay nhà khoa học hôm nay?").
 * Open: the deck's topic chips and the card for (today, this visit's quad, topic), with
 * "Cất vào sổ tay" and "Đóng".
 */
export function DossierOffer({ today, quad, deck = "detective" }: { today: string; quad: Quad | null; deck?: Deck }) {
  const spec = DECKS[deck];
  const keys = spec.topicKeys();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<string>(spec.defaultTopic);
  /** The card key known to be in the notebook (read after mount / on change). */
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const card = spec.pick(today, quad, topic) ?? spec.pick(today, quad, spec.defaultTopic);
  const cardKey = card?.key ?? null;
  const saved = cardKey !== null && savedKey === cardKey;
  const sci = deck === "scientist";

  // The last topic picked on this device (after mount, never during the first render).
  useEffect(() => {
    const id = window.setTimeout(() => {
      const t = spec.store.readTopic();
      if (t && spec.topicKeys().includes(t)) setTopic(t);
    }, 0);
    return () => window.clearTimeout(id);
  }, [spec]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSavedKey(cardKey && spec.store.has(cardKey) ? cardKey : null);
      setFailed(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [cardKey, spec]);

  // Focus: the card heading when opened, the toggle again when closed.
  useEffect(() => {
    if (open) heading.current?.focus();
    else if (wasOpen.current) toggle.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!card) return null;

  if (!open) {
    return (
      <button
        ref={toggle}
        type="button"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 text-left font-semibold ${sci ? "border-an/40" : "border-ink/15"}`}
      >
        <span>
          <span aria-hidden className="mr-2">
            {spec.offer.emoji}
          </span>
          {spec.offer.text}
        </span>
        <span aria-hidden className="text-ink/50">
          ›
        </span>
      </button>
    );
  }

  function save() {
    if (!card) return;
    spec.store.add(today, card.key);
    const ok = spec.store.has(card.key);
    setSavedKey(ok ? card.key : null);
    setFailed(!ok);
  }

  const chipOn = sci ? "border-an bg-an text-white" : "border-ink bg-ink text-white";
  const chipOff = sci ? "border-an/30 bg-white text-ink" : "border-ink/20 bg-white text-ink";

  return (
    <section aria-label={spec.sectionLabel} className="flex flex-col gap-3 rounded-2xl bg-bg p-3">
      {sci ? (
        // Nine topics with long names: small tiles, three to a row (wraps cleanly on a phone).
        <div role="group" aria-label={spec.chipsLabel} className="grid grid-cols-3 gap-1.5">
          {keys.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={topic === t}
              onClick={() => {
                setTopic(t);
                spec.store.writeTopic(t);
              }}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-[1.5px] px-1.5 py-1.5 text-center text-xs leading-tight font-semibold ${topic === t ? chipOn : chipOff}`}
            >
              <span aria-hidden className="text-base leading-none">
                {spec.topic(t).emoji}
              </span>
              {spec.topic(t).label}
            </button>
          ))}
        </div>
      ) : (
        <div role="group" aria-label={spec.chipsLabel} className="flex flex-wrap gap-2">
          {keys.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={topic === t}
              onClick={() => {
                setTopic(t);
                spec.store.writeTopic(t);
              }}
              className={`min-h-11 rounded-full border-[1.5px] px-3.5 text-sm font-semibold ${topic === t ? chipOn : chipOff}`}
            >
              <span aria-hidden className="mr-1">
                {spec.topic(t).emoji}
              </span>
              {spec.topic(t).label}
            </button>
          ))}
        </div>
      )}
      <div aria-live="polite">
        <DossierCard key={card.key} card={card} deck={deck} headingRef={heading} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saved}
          onClick={save}
          className={`btn border-2 bg-white font-semibold ${sci ? "border-an disabled:border-an/35" : "border-ink disabled:border-ink/30"} disabled:text-ink/70`}
        >
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
