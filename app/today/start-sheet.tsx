"use client";

import { useEffect, useId, useRef } from "react";
import type { TaskView } from "@/lib/dayState";
import { isTimed } from "@/lib/today/focus";
import { isExtraRun } from "@/lib/today/rules";
import { BodyPortal, escFrom, returnFocus } from "./portal";

/**
 * R7a "Bắt đầu nhẹ nhàng": after Bắt đầu, a small card says what the small goal is — not a
 * full-screen timer. A bottom sheet on phones, a centred card on wider screens; the page stays
 * visible behind a light scrim. Shown once per start (memory only, never after a reload).
 */
export function StartSheet({
  item,
  color,
  opener,
  onFocus,
  onClose,
}: {
  item: TaskView;
  color: string;
  /** The Bắt đầu button that was pressed: focus goes back there (or to the running chip). */
  opener: Element | null;
  onFocus: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const openerRef = useRef(opener);

  useEffect(() => {
    panel.current?.focus();
    const back = openerRef.current;
    return () => returnFocus(back);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (escFrom(root.current, e)) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // R8a "Làm thêm": never required, no minimum.
  const extra = isExtraRun(item);
  const subject = item.subject?.trim() && item.subject.trim().toLowerCase() !== item.title.trim().toLowerCase() ? item.subject.trim() : item.part === 1 ? "Bài bổ sung" : "Kỹ năng";
  const sub = extra
    ? "Không bắt buộc — làm bao lâu cũng được"
    : item.source === "homework"
      ? "Làm xong trong vở thì chụp ảnh nộp."
      : [subject, isTimed(item) ? `ít nhất ${item.minMinutes} phút` : "không giới hạn thời gian", item.appLabel ? `trên ${item.appLabel}` : null].filter(Boolean).join(" · ");
  const link = item.source === "template" ? item.deepLink : null;

  return (
    <BodyPortal>
      <div ref={root} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 sm:items-center sm:p-4" onClick={onClose}>
        <section
          ref={panel}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-white px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink outline-none sm:rounded-3xl sm:pb-5"
          style={{ boxShadow: "0 -8px 30px rgba(28,31,29,0.16)" }}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-bold tracking-[0.07em] uppercase" style={{ color }}>
              Bắt đầu rồi ✓
            </span>
            <h2 id={titleId} className="text-[21px] leading-snug font-bold break-words">
              {extra ? `Làm thêm: ${item.title}` : `Mục tiêu nhỏ: ${item.title}`}
            </h2>
            <p className="text-[15px] text-ink/75">{sub}</p>
            {item.source === "homework" && item.note && <p className="text-[15px] text-ink/75">{item.note}</p>}
          </div>
          {/* One slow breath before starting (played once; still under reduced motion). */}
          <div className="flex items-center gap-3 rounded-2xl bg-bg px-3 py-2">
            <span aria-hidden className="relative flex size-11 shrink-0 items-center justify-center">
              <span className="sl-breath absolute inset-0 rounded-full" style={{ background: color, opacity: 0.2 }} />
              <span className="sl-breath absolute inset-2.5 rounded-full" style={{ background: color, opacity: 0.4, animationDelay: "120ms" }} />
            </span>
            <span className="text-[15px] text-ink/80">Hít vào… thở ra… rồi mình bắt đầu.</span>
          </div>
          <div className="flex flex-col gap-2">
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                onClick={onClose}
                className="flex min-h-12 items-center justify-center rounded-2xl text-base font-bold text-white no-underline"
                style={{ background: color }}
              >
                Mở {item.appLabel ?? "app"} ↗
              </a>
            )}
            <button
              type="button"
              onClick={onFocus}
              className={`min-h-12 rounded-2xl text-base font-bold ${link ? "border-[1.5px] bg-white" : "text-white"}`}
              style={link ? { borderColor: color, color } : { background: color }}
            >
              🎯 Ngồi cùng màn tập trung
            </button>
            <button type="button" onClick={onClose} className="min-h-11 rounded-2xl text-[15px] font-semibold text-ink/75">
              Để sau
            </button>
          </div>
        </section>
      </div>
    </BodyPortal>
  );
}
