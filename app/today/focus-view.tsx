"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Voice } from "@/lib/binhYen/catalog";
import type { TaskView } from "@/lib/dayState";
import { elapsedMs, focusLine, isLongRunning, isTimed, minutesLabel, remainingMinutes } from "@/lib/today/focus";
import { taskProgress } from "@/lib/today/view";
import { BodyPortal, escFrom, returnFocus } from "./portal";
import { FileLinks, FinishButton, canFinishWithPhotos, isAsked, whereLine, type TaskCtx } from "./today-parts";
import { Ambient, Backdrop, sceneKeyOf } from "./world-scene";

/**
 * R7a: the focus screen, opened ONLY when the child asks (🎯 Tập trung, the running chip, or
 * "Ngồi cùng màn tập trung"). Calm: the child's world as background (An: her drawn world;
 * Nguyên: comic paper), minutes only, one quiet line, and a clear way back. Display only: the
 * buttons use the same server routes and rules as before.
 */

const SNOOZE_MS = 60 * 60_000;
const noop = () => () => {};
const snoozeKey = (key: string) => `focus-snooze:${key}`;

function readSnooze(key: string): number | null {
  try {
    const v = Number(window.sessionStorage.getItem(snoozeKey(key)));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null; // storage blocked: the question just shows again
  }
}

const RING = 240;
const R = 104;
const C = 2 * Math.PI * R;

export function FocusView({ item, ctx, voice, worldKey, onClose }: { item: TaskView; ctx: TaskCtx; voice: Voice; worldKey: string | null; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const comic = voice === "detective";

  // Focus moves in on open and back to the opener on close; the page behind does not scroll.
  useEffect(() => {
    const opener = document.activeElement;
    back.current?.focus();
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = overflow;
      returnFocus(opener);
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (escFrom(root.current, e)) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stored = useSyncExternalStore(noop, () => readSnooze(item.key), () => null);
  const [snoozedNow, setSnoozedNow] = useState<number | null>(null);
  const snoozeUntil = snoozedNow ?? stored;

  const elapsed = elapsedMs(item, ctx.nowMs);
  const timed = isTimed(item);
  const remaining = item.canFinishAt ? Date.parse(item.canFinishAt) - ctx.nowMs : 0;
  const ready = !item.requiresProof && remaining <= 0;
  const long = isLongRunning(elapsed, item.minMinutes) && !(snoozeUntil !== null && snoozeUntil > ctx.nowMs);
  const pct = timed ? taskProgress(item, ctx.nowMs) : 0;
  const label = minutesLabel(elapsed);
  const hours = elapsed >= 60 * 60_000;
  const kind =
    item.source === "homework"
      ? "Bài trên lớp · chụp ảnh khi xong"
      : [item.part === 1 ? "Bài bổ sung" : "Kỹ năng", whereLine(item), item.minMinutes > 0 ? `ít nhất ${item.minMinutes} phút` : ""].filter(Boolean).join(" · ");
  const under = item.requiresProof
    ? "Không cần đủ giờ. Làm xong trong vở thì chụp ảnh nộp."
    : !timed
      ? "Không giới hạn thời gian. Làm xong thì bấm Xong."
      : ready
        ? `Đủ ${item.minMinutes} phút rồi ✓ — làm xong thì bấm Xong`
        : `Còn khoảng ${remainingMinutes(remaining)} phút nữa là bấm Xong được`;
  const line = focusLine(voice, `${item.key}|${ctx.today}`);
  const off = !!ctx.busy || ctx.paused;

  const finish = () => void ctx.onAct({ url: "/api/tasks/finish", body: { runId: item.runId } });
  const stillWorking = () => {
    const until = ctx.nowMs + SNOOZE_MS;
    setSnoozedNow(until);
    try {
      window.sessionStorage.setItem(snoozeKey(item.key), String(until));
    } catch {
      /* not remembered: fine */
    }
  };
  const doneAlready = () => {
    if (item.requiresProof && !canFinishWithPhotos(item)) ctx.onProofOpen(item);
    else finish();
  };

  // Colours per voice: white on An's world, ink on Nguyên's paper; buttons in the child's colour.
  const ink = comic ? "text-ink" : "text-white";
  const soft = comic ? "text-ink/75" : "text-white/85";
  const primary = comic ? { background: ctx.color, color: "#fff" } : { background: "#fff", color: ctx.color };
  const secondary = comic ? "border-2 border-ink bg-white text-ink" : "border-[1.5px] border-white/60 bg-black/20 text-white";

  return (
    <BodyPortal>
      <div ref={root} role="dialog" aria-modal="true" aria-label={`Màn tập trung: ${item.title}`} className={`fixed inset-0 z-50 ${ink}`}>
        {comic ? (
          <div aria-hidden className="absolute inset-0" style={{ background: "#F7F2E7" }}>
            <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(29,36,34,0.12) 1px, transparent 1.4px)", backgroundSize: "7px 7px" }} />
            <div className="absolute inset-2.5 rounded-md border-[3px] border-ink sm:inset-4" />
          </div>
        ) : (
          <div aria-hidden className="sl-slow absolute inset-0 overflow-hidden" style={{ background: "#BFE4F5" }}>
            <Backdrop scene={sceneKeyOf(worldKey)} />
            <Ambient scene={sceneKeyOf(worldKey)} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(rgba(0,0,0,.25), rgba(0,0,0,.55))" }} />
          </div>
        )}
        <div className="absolute inset-0 overflow-y-auto">
          <div className={`mx-auto flex min-h-full w-full max-w-md flex-col gap-5 pb-8 ${comic ? "px-7 pt-6 sm:px-8 sm:pt-8" : "px-5 pt-4"}`}>
            <div className="flex items-center justify-between gap-2">
              <button ref={back} type="button" onClick={onClose} className={`min-h-11 rounded-full px-4 text-[15px] font-semibold ${secondary}`}>
                ← Về Hôm nay
              </button>
              <span className={`text-sm font-semibold ${soft}`}>🎯 Tập trung</span>
            </div>

            <div className="flex flex-col gap-1 text-center">
              <h2 className="text-[26px] leading-tight font-bold break-words" style={comic ? undefined : { textShadow: "0 1px 3px rgba(0,0,0,.35)" }}>
                {item.title}
              </h2>
              <p className={`text-[15px] text-balance ${soft}`}>{kind}</p>
              {item.note && <p className={`text-[15px] ${soft}`}>{item.note}</p>}
            </div>

            {long ? (
              <section
                aria-label="Hỏi lại"
                className={`flex flex-col gap-3 rounded-2xl p-4 text-center ${comic ? "border-[2.5px] border-ink bg-white" : "bg-black/35"}`}
              >
                <p className="text-lg font-bold">Con vẫn đang làm “{item.title}” chứ?</p>
                <p className={`text-sm ${soft}`}>
                  Đã {label}. Có khi con xong rồi mà quên bấm. Không sao cả.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={stillWorking} className={`min-h-12 grow basis-36 rounded-2xl px-4 text-base font-bold ${secondary}`}>
                    Vẫn đang làm
                  </button>
                  <button type="button" disabled={off} onClick={doneAlready} className="min-h-12 grow basis-36 rounded-2xl px-4 text-base font-bold disabled:opacity-60" style={primary}>
                    Xong rồi
                  </button>
                </div>
              </section>
            ) : (
              <>
                <div className="relative self-center" style={{ width: RING, height: RING }}>
                  <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} aria-hidden>
                    <circle cx={RING / 2} cy={RING / 2} r={R} fill={comic ? "#FFFDF8" : "rgba(0,0,0,0.18)"} stroke={comic ? "rgba(28,31,29,0.12)" : "rgba(255,255,255,0.28)"} strokeWidth="12" />
                    {timed ? (
                      <circle
                        cx={RING / 2}
                        cy={RING / 2}
                        r={R}
                        fill="none"
                        stroke={comic ? ctx.color : "#FFFFFF"}
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={`${(C * pct) / 100} ${C}`}
                        transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                      />
                    ) : (
                      <circle className="sl-ring-breathe" cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={comic ? ctx.color : "#FFFFFF"} strokeWidth="12" />
                    )}
                    {comic && <circle cx={RING / 2} cy={RING / 2} r={R + 9} fill="none" stroke="#1C1F1D" strokeWidth="2.5" />}
                  </svg>
                  <div role="timer" aria-live="off" className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
                    {label !== "vừa bắt đầu" && <span className={`text-[15px] ${soft}`}>đã làm</span>}
                    <TimeText label={label} hours={hours} />
                  </div>
                </div>
                <p className={`text-center text-base text-balance ${comic ? "text-ink/85" : "text-white/95"}`} aria-live="polite">
                  {under}
                </p>
                <p
                  className={
                    comic
                      ? "self-center rounded-lg border-2 border-ink bg-[#FFF7D6] px-3 py-2 text-center text-[15px] font-semibold"
                      : "text-center text-[15px] text-white/90 italic"
                  }
                  style={comic ? { boxShadow: "3px 3px 0 #1C1F1D" } : undefined}
                >
                  {line}
                </p>
              </>
            )}

            <div className="mt-auto flex flex-col gap-3">
              <FileLinks files={ctx.files(item)} dark={!comic} />
              {item.deepLink && (
                <a
                  href={item.deepLink}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold no-underline ${secondary}`}
                >
                  Mở {item.appLabel ?? "app"} ↗
                </a>
              )}
              {item.requiresProof && isAsked(item, ctx) && (
                <p className={`rounded-2xl px-4 py-3 text-center text-[15px] ${comic ? "border-2 border-ink bg-white" : "bg-black/30"}`}>Đã nhờ bố mẹ xem. Bố mẹ bấm xác nhận là bài này xong.</p>
              )}
              {item.requiresProof && canFinishWithPhotos(item) ? (
                <FinishButton item={item} ctx={ctx} className="min-h-14 rounded-2xl text-[17px] font-bold disabled:opacity-60" style={primary} />
              ) : item.requiresProof ? (
                <button type="button" disabled={off} onClick={() => ctx.onProofOpen(item)} className="min-h-14 rounded-2xl text-[17px] font-bold disabled:opacity-60" style={primary}>
                  Nộp ảnh bài
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!ready || off}
                  onClick={finish}
                  className={`min-h-14 rounded-2xl text-[17px] font-bold ${ready ? "" : comic ? "border-2 border-dashed border-ink/40 bg-white/70 text-ink/70" : "bg-black/25 text-white/80"}`}
                  style={ready ? primary : undefined}
                >
                  {ready ? "Xong" : `Xong · mở sau ${remainingMinutes(remaining)} phút`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}

/**
 * "12 phút" / "2 giờ 05 phút" inside the ring: numbers large, words small, so the longest
 * label still fits within the ring (diameter − 40 px) on a phone.
 */
function TimeText({ label, hours }: { label: string; hours: boolean }) {
  const parts = label.split(/(\d+)/).filter((p) => p.trim() !== "");
  if (!/\d/.test(label)) return <span className="max-w-[200px] text-[26px] leading-tight font-bold">{label}</span>;
  return (
    <span className="flex max-w-[200px] flex-wrap items-baseline justify-center gap-x-1.5 leading-none font-bold tabular-nums">
      {parts.map((p, i) =>
        /\d/.test(p) ? (
          <span key={i} className={hours ? "text-4xl" : "text-5xl sm:text-6xl"}>
            {p}
          </span>
        ) : (
          <span key={i} className={hours ? "text-lg" : "text-2xl"}>
            {p.trim()}
          </span>
        ),
      )}
    </span>
  );
}
