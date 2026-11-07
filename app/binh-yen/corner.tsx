"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BRAIN,
  INTENSITY_LABELS,
  QUADS,
  QUAD_COLORS,
  QUAD_KEYS,
  ackFor,
  activityText,
  enoughLine,
  findActivity,
  findWord,
  homeCopy,
  isPleasant,
  mentorLine,
  wordsFor,
  type Quad,
  type QuadInfo,
  type Voice,
} from "@/lib/binhYen/catalog";
import { DELETE_ALL_WORD, HEAVY_REPEAT_TEXT, NOT_SAVED_TEXT, typedDeleteWord, type CheckinView } from "@/lib/binhYen/checkin";
import { whoSeesWhat } from "@/lib/binhYen/copy";
import { studyChip } from "@/lib/binhYen/studyCap";
import { suggest } from "@/lib/binhYen/suggest";
import { vnTime } from "@/lib/today/view";
import { FeedbackButton } from "../today/feedback";
import { ActivityBody } from "./activities";

/**
 * Góc bình yên — one visit (BINH_YEN.md §4, S-BY1): chọn ô → chọn từ → công nhận (+ mức 1–5 khi
 * khó chịu) → 3 gợi ý (R1) → làm → Xong → one by_checkins row (keys only) → a short closing line.
 * "Vậy là đủ cho hôm nay": naming the feeling counts as done. Leaving half-way stores nothing.
 * No text box anywhere in this slice; nothing is logged.
 */

export interface CornerState {
  studyMinutes: number;
  study: { minutes: number; endsAt: string } | null;
}

/** Any answer that carries a fresh corner state (visit over / study-time limit). */
export interface StateCarrier {
  state?: unknown;
}

type Step =
  | { k: "home" }
  | { k: "words"; quad: Quad }
  | { k: "ack"; quad: Quad; word: string }
  | { k: "suggest"; quad: Quad; word: string; intensity: number | null }
  | { k: "activity"; quad: Quad; word: string; intensity: number | null; activity: string }
  | { k: "done"; text: string; heavy: boolean };

async function post(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: (Record<string, unknown> & StateCarrier) | null }> {
  try {
    const res = await fetch(url, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, status: res.status, data: (await res.json().catch(() => null)) as never };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

const ICONS: Record<QuadInfo["icon"], React.ReactNode> = {
  volcano: <path d="M4 28 L13 12 H19 L28 28 Z M14 12 Q16 4 13 2 M18 12 Q17 6 20 3" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  sun: (
    <>
      <circle cx="16" cy="16" r="7" fill="currentColor" />
      <path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M26 6l-3 3M9 23l-3 3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  sea: (
    <>
      <path d="M2 12 Q8 6 14 12 T26 12 T32 12 V30 H2 Z" fill="currentColor" opacity=".35" />
      <path d="M2 18 Q8 12 14 18 T26 18 T32 18 V30 H2 Z" fill="currentColor" />
    </>
  ),
  forest: <path d="M10 4 L18 18 H2 Z M22 8 L30 22 H14 Z M9 18 h2.5 v8 H9 Z M21 22 h2.5 v6 H21 Z" fill="currentColor" />,
  folder: (
    <>
      <path d="M3 8 h9 l3 3 h14 v16 H3 Z" fill="currentColor" opacity=".35" />
      <circle cx="17" cy="18" r="5" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path d="M21 22 l5 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
};

function Back({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 self-start text-sm font-semibold text-ink/70 underline">
      {children}
    </button>
  );
}

function Card({ label, quad, children }: { label: string; quad?: Quad; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-4 rounded-2xl border-t-4 bg-white p-5" style={{ borderTopColor: quad ? QUAD_COLORS[quad].c : "transparent" }}>
      {children}
    </section>
  );
}

export function Corner({
  voice,
  firstName,
  color,
  state,
  onState,
  onTalkInline,
  talk,
}: {
  voice: Voice;
  firstName: string;
  color: string;
  state: CornerState;
  onState: (s: unknown) => void;
  onTalkInline: (inline: boolean) => void;
  /** The "Con muốn nói chuyện" card, shown inside the "Nhắn bố mẹ" activity. */
  talk: React.ReactNode;
}) {
  const [step, setStepRaw] = useState<Step>({ k: "home" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef<string | null>(null);
  const copy = homeCopy(voice, firstName);

  const go = useCallback(
    (s: Step) => {
      setError(null);
      setStepRaw(s);
      onTalkInline(s.k === "activity" && s.activity === "talk");
      window.scrollTo({ top: 0 });
    },
    [onTalkInline],
  );

  async function save(s: { quad: Quad; word: string; intensity: number | null }, activity: string | null) {
    if (!runId.current) runId.current = crypto.randomUUID();
    setBusy(true);
    setError(null);
    const r = await post("/api/by/checkins", { clientRunId: runId.current, quad: s.quad, word: s.word, intensity: s.intensity, activity });
    setBusy(false);
    if (r.ok) {
      runId.current = null;
      const a = activity ? findActivity(activity) : undefined;
      const label = findWord(s.word)?.label ?? "";
      go({ k: "done", text: a ? activityText(a, voice).done : enoughLine(label), heavy: r.data?.heavy === true });
      return;
    }
    // Visit over (the screen opens a new one) or study-time limit: nothing was stored — say so.
    if ((r.status === 401 || r.status === 409) && r.data?.state) onState(r.data.state);
    setError(typeof r.data?.error === "string" && r.status === 400 ? r.data.error : NOT_SAVED_TEXT);
  }

  if (step.k === "home") {
    return (
      <>
        <section aria-label="Góc của con" className="flex flex-col gap-4 rounded-2xl bg-white p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold">{copy.greeting}</h2>
            <p className="text-ink/75">{copy.sub}</p>
          </div>
          {state.study && (
            <p role="status" className="self-start rounded-full bg-bg px-3 py-1 text-xs font-semibold text-ink/80">
              ⏱ {studyChip(state.study.minutes, vnTime(state.study.endsAt))}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <h3 className="font-bold">{copy.meterTitle}</h3>
            <div className="grid grid-cols-2 gap-3">
              {QUAD_KEYS.map((q) => {
                const info = QUADS[voice][q];
                return (
                  <button
                    key={q}
                    type="button"
                    aria-label={`${info.label}: ${info.sub}`}
                    onClick={() => go({ k: "words", quad: q })}
                    className="flex min-h-28 flex-col justify-between gap-1 rounded-2xl p-3 text-left transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    style={{ background: QUAD_COLORS[q].soft }}
                  >
                    <svg viewBox="0 0 32 32" aria-hidden className="size-8" style={{ color: QUAD_COLORS[q].c }}>
                      {ICONS[info.icon]}
                    </svg>
                    <b className="text-base">{info.label}</b>
                    <span className="text-sm text-ink/70">{info.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <details className="rounded-xl bg-bg p-3">
            <summary className="min-h-11 cursor-pointer content-center font-bold">🔒 Ai thấy gì?</summary>
            <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm">
              {whoSeesWhat().map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        </section>
        <Recent voice={voice} onState={onState} />
        <FeedbackButton variant="corner" color={color} />
      </>
    );
  }

  if (step.k === "words") {
    const words = wordsFor(step.quad);
    return <Words key={step.quad} quad={step.quad} words={words} title={copy.wordsTitle} hint={copy.wordsHint} color={color} onBack={() => go({ k: "home" })} onPick={(w) => { runId.current = crypto.randomUUID(); go({ k: "ack", quad: step.quad, word: w }); }} />;
  }

  if (step.k === "ack") {
    return <AckStep voice={voice} quad={step.quad} word={step.word} color={color} onBack={() => go({ k: "words", quad: step.quad })} onNext={(intensity) => go({ k: "suggest", quad: step.quad, word: step.word, intensity })} />;
  }

  if (step.k === "suggest") {
    const label = findWord(step.word)?.label ?? "";
    const pos = isPleasant(step.quad);
    const ideas = suggest({ voice, quad: step.quad, word: step.word, intensity: step.intensity });
    return (
      <Card label="Gợi ý cho con" quad={step.quad}>
        <p className="text-lg">{mentorLine(voice, step.quad, label, firstName)}</p>
        <div className="rounded-xl p-3 text-sm" style={{ background: QUAD_COLORS[step.quad].soft }}>
          {voice === "scientist" ? (
            <>
              <span className="block text-xs font-bold uppercase tracking-wide text-ink/70">{BRAIN[step.quad].head}</span>
              <p>{BRAIN[step.quad].body}</p>
            </>
          ) : (
            <>
              <span className="block text-xs font-bold uppercase tracking-wide text-ink/70">{pos ? "Tận hưởng" : "Làm dịu trước"}</span>
              <p>{pos ? "Chọn một việc để giữ niềm vui lâu hơn." : "Chọn một việc nhỏ cho người và đầu dịu lại. Hiểu vì sao thì để lát nữa cũng được."}</p>
            </>
          )}
        </div>
        <ul aria-label="3 gợi ý" className="flex flex-col gap-2">
          {ideas.map((key) => {
            const a = findActivity(key);
            if (!a) return null;
            const t = activityText(a, voice);
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => go({ k: "activity", quad: step.quad, word: step.word, intensity: step.intensity, activity: key })}
                  className="grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-2xl border-[1.5px] border-ink/15 bg-white p-3 text-left"
                >
                  <b>{t.title}</b>
                  <i className="row-span-2 text-sm font-semibold not-italic" style={{ color }}>
                    {t.minutes}
                  </i>
                  <span className="text-sm text-ink/70">
                    {t.desc}
                    {a.offline && <span className="ml-1 font-semibold">({a.offline === "head" ? "làm trong đầu" : "làm ra giấy"})</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-1 border-t border-ink/10 pt-3">
          <button type="button" disabled={busy} onClick={() => void save(step, null)} className="btn self-start border border-ink/25 bg-white disabled:opacity-60">
            Vậy là đủ cho hôm nay
          </button>
          <span className="text-xs text-ink/65">Gọi được tên cảm xúc cũng là xong rồi. Không cần làm thêm gì.</span>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <Back onClick={() => go({ k: "ack", quad: step.quad, word: step.word })}>← Quay lại</Back>
      </Card>
    );
  }

  if (step.k === "activity") {
    const a = findActivity(step.activity);
    if (!a) return null;
    const t = activityText(a, voice);
    return (
      <Card label={t.title} quad={step.quad}>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">{t.title}</h2>
          <p className="text-ink/75">{t.desc}</p>
        </div>
        {a.ui === "talk" ? (
          <div className="flex flex-col gap-2">
            {talk}
          </div>
        ) : (
          <ActivityBody activity={a} text={t} color={color} />
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <button type="button" disabled={busy} onClick={() => void save(step, step.activity)} className="btn text-white disabled:opacity-60" style={{ background: color }}>
          {busy ? "Đang lưu…" : error ? "Thử lưu lại" : "Xong"}
        </button>
        <Back onClick={() => go({ k: "suggest", quad: step.quad, word: step.word, intensity: step.intensity })}>← Gợi ý khác</Back>
      </Card>
    );
  }

  return (
    <Card label="Xong rồi">
      <h2 className="text-2xl font-bold">Xong rồi 🌿</h2>
      <p role="status" className="text-lg">
        {step.text}
      </p>
      {step.heavy && <p className="rounded-xl bg-[#FBF0D6] p-3 text-sm font-semibold text-[#5E3D00]">{HEAVY_REPEAT_TEXT}</p>}
      <button type="button" onClick={() => go({ k: "home" })} className="btn self-start text-white" style={{ background: color }}>
        Về góc của con
      </button>
    </Card>
  );
}

function Words({ quad, words, title, hint, color, onBack, onPick }: { quad: Quad; words: { key: string; label: string; def: string }[]; title: string; hint: string; color: string; onBack: () => void; onPick: (w: string) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const chosen = words.find((w) => w.key === pick);
  return (
    <Card label="Chọn từ" quad={quad}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-ink/75">{hint}</p>
      </div>
      <div role="group" aria-label="Từ cảm xúc" className="flex flex-wrap gap-2">
        {words.map((w) => (
          <button
            key={w.key}
            type="button"
            aria-pressed={pick === w.key}
            onClick={() => setPick(w.key)}
            className="min-h-11 rounded-full border-[1.5px] bg-white px-4 font-medium"
            style={pick === w.key ? { borderColor: QUAD_COLORS[quad].c, background: QUAD_COLORS[quad].soft } : { borderColor: "rgb(28 31 29 / 0.15)" }}
          >
            {w.label}
          </button>
        ))}
      </div>
      {chosen && (
        <p aria-live="polite" className="rounded-xl p-3" style={{ background: QUAD_COLORS[quad].soft }}>
          <b>{chosen.label.charAt(0).toUpperCase() + chosen.label.slice(1)}:</b> {chosen.def}
        </p>
      )}
      <button type="button" disabled={!pick} onClick={() => pick && onPick(pick)} className="btn self-start text-white disabled:opacity-50" style={{ background: color }}>
        Tiếp →
      </button>
      <Back onClick={onBack}>← Chọn ô khác</Back>
    </Card>
  );
}

function AckStep({ voice, quad, word, color, onBack, onNext }: { voice: Voice; quad: Quad; word: string; color: string; onBack: () => void; onNext: (intensity: number | null) => void }) {
  const [level, setLevel] = useState<number | null>(null);
  const label = findWord(word)?.label ?? "";
  const ack = ackFor(voice, quad, label);
  const pos = isPleasant(quad);
  return (
    <Card label="Công nhận" quad={quad}>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">{ack.title}</h2>
        <p className="text-ink/75">{ack.text}</p>
      </div>
      {!pos && (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Cảm giác này đang to cỡ nào?</p>
          <div role="group" aria-label="Mức độ" className="grid grid-cols-5 gap-1.5">
            {INTENSITY_LABELS.map((lab, i) => (
              <button
                key={lab}
                type="button"
                aria-pressed={level === i + 1}
                onClick={() => setLevel(i + 1)}
                className="flex min-h-14 flex-col items-center justify-center rounded-xl border-[1.5px] bg-white text-lg font-bold"
                style={level === i + 1 ? { borderColor: QUAD_COLORS[quad].c, background: QUAD_COLORS[quad].soft } : { borderColor: "rgb(28 31 29 / 0.15)" }}
              >
                {i + 1}
                <small className="text-xs font-medium">{lab}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" disabled={!pos && level === null} onClick={() => onNext(pos ? null : level)} className="btn self-start text-white disabled:opacity-50" style={{ background: color }}>
        {pos ? "Tận hưởng →" : "Làm dịu một chút →"}
      </button>
      <Back onClick={onBack}>← Đổi từ khác</Back>
    </Card>
  );
}

/**
 * "Lần ghé gần đây": the last 7 visits (date, word, activity) with delete. No counts, no charts.
 * "Xóa hết của con" lives apart, folded away in "Dữ liệu của con", and needs XÓA typed first
 * (parent decision 07/11/2026: hard to tap by mistake).
 */
function Recent({ voice, onState }: { voice: Voice; onState: (s: unknown) => void }) {
  const [items, setItems] = useState<CheckinView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/by/checkins", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { recent?: CheckinView[]; state?: unknown } | null;
      if (res.ok && data?.recent) {
        setItems(data.recent);
        setFailed(false);
      } else if ((res.status === 401 || res.status === 409) && data?.state) onState(data.state);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }, [onState]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load, voice]);

  async function remove(body: { id: string } | { all: true }) {
    setBusy(true);
    const r = await post("/api/by/checkins/delete", body);
    setBusy(false);
    setWord("");
    if ((r.status === 401 || r.status === 409) && r.data?.state) return onState(r.data.state);
    if (!r.ok) setFailed(true);
    await load();
  }

  return (
    <>
      <section aria-label="Lần ghé gần đây" className="flex flex-col gap-3 rounded-2xl bg-white p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">Lần ghé gần đây</h2>
          <p className="text-xs text-ink/65">Chỉ con thấy ở đây. Xóa là mất hẳn.</p>
        </div>
        {failed && <p role="alert" className="text-sm text-red-700">Chưa tải được, thử lại sau.</p>}
        {items && items.length === 0 && <p className="text-sm text-ink/70">Chưa có lần nào. Khi con đi hết một lượt, nó hiện ở đây.</p>}
        {items && items.length > 0 && (
          <ul className="flex flex-col divide-y divide-ink/10">
            {items.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: c.quad ? QUAD_COLORS[c.quad].c : "#999" }} />
                <span className="flex-1 text-sm">
                  <span className="text-ink/60">{c.date}</span> · <b>{c.word}</b>
                  {c.activity ? ` · ${c.activity}` : " · gọi tên là đủ"}
                </span>
                <button type="button" disabled={busy} onClick={() => void remove({ id: c.id })} aria-label={`Xóa lượt ${c.date} ${c.word}`} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-ink/70 underline disabled:opacity-50">
                  Xóa
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {items && items.length > 0 && (
        <details aria-label="Dữ liệu của con" className="rounded-2xl bg-white p-4">
          <summary className="min-h-11 cursor-pointer content-center font-bold">Dữ liệu của con</summary>
          <div className="mt-2 flex flex-col gap-3 text-sm">
            <p>
              <b>Xóa hết của con</b> xóa mọi lượt ghé con đã lưu, không lấy lại được. Muốn xóa thì gõ <b>{DELETE_ALL_WORD}</b> vào ô dưới.
            </p>
            <label className="flex flex-col gap-1 font-semibold">
              Gõ {DELETE_ALL_WORD} để xác nhận
              <input
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={10}
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base font-normal"
              />
            </label>
            <button type="button" disabled={busy || !typedDeleteWord(word)} onClick={() => void remove({ all: true })} className="btn self-start border border-red-700/40 bg-[#F6DED8] text-sm disabled:opacity-50">
              Xóa hết của con
            </button>
          </div>
        </details>
      )}
    </>
  );
}
