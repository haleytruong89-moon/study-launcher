"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { WeekStats } from "@/lib/today/week";
import { hoursMinutes, ICONS, REVIEW_QUESTIONS, reviewPeriod } from "@/lib/today/week";
import type { WeeklyReview } from "@/lib/today/week-load";

/** Small modal shell (real dialog semantics, Esc / backdrop close, 44px controls). */
export function Modal({ title, error, onClose, children }: { title: string; error?: string | null; onClose: () => void; children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Focus starts inside the dialog, so Esc and keyboard users work right away.
  useEffect(() => closeRef.current?.focus(), []);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 text-ink sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Đóng" className="flex size-11 items-center justify-center rounded-full text-xl font-bold hover:bg-bg">
            ×
          </button>
        </div>
        {children}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

/** The child picks an icon from the fixed set. */
export function IconPicker({
  current,
  color,
  busy,
  error,
  onPick,
  onClose,
}: {
  current: string | null;
  color: string;
  busy: boolean;
  error: string | null;
  onPick: (icon: string) => Promise<boolean>;
  onClose: () => void;
}) {
  return (
    <Modal title="Chọn biểu tượng của con" error={error} onClose={onClose}>
      <div className="grid grid-cols-6 gap-2">
        {ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            aria-label={`Biểu tượng ${icon}`}
            aria-pressed={icon === current}
            disabled={busy}
            onClick={async () => {
              if (await onPick(icon)) onClose();
            }}
            className="flex aspect-square min-h-12 items-center justify-center rounded-2xl border-2 text-2xl"
            style={icon === current ? { borderColor: color, background: `${color}1A` } : { borderColor: "transparent", background: "#F4F5F0" }}
          >
            {icon}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink/65">Màu của con do bố mẹ chọn, biểu tượng thì con tự chọn.</p>
      {/* R3a: the character lives on its own page (docs/BINH_YEN_BIEU_TUONG.md §A). */}
      <Link href="/nhan-vat" className="inline-flex min-h-11 items-center self-start font-semibold underline" style={{ color }}>
        🧑‍🎨 Tạo / đổi nhân vật của con
      </Link>
    </Modal>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-bg px-3 py-2.5">
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs text-ink/70">{label}</span>
    </div>
  );
}

/** "Tổng kết tuần" (Friday 17:00 -> end of Saturday; Saturday before -> Friday): numbers + 2 short answers parents read. */
export function WeeklyReviewCard({
  stats,
  review,
  color,
  busy,
  onSave,
}: {
  stats: WeekStats;
  review: WeeklyReview | null;
  color: string;
  busy: boolean;
  onSave: (answers: { wentWell: string; changeNext: string }) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(review === null);
  const [wentWell, setWentWell] = useState(review?.wentWell ?? "");
  const [changeNext, setChangeNext] = useState(review?.changeNext ?? "");
  const { from: startDay, to: end } = reviewPeriod(stats.weekStart);
  const range = `${startDay.slice(8, 10)}/${startDay.slice(5, 7)} – ${end.slice(8, 10)}/${end.slice(5, 7)}`;

  return (
    <section aria-labelledby="wr-h" className="flex flex-col gap-3.5 rounded-[20px] bg-white p-4" style={{ border: `2px solid ${color}` }}>
      <div className="flex flex-col gap-0.5">
        <h2 id="wr-h" className="text-lg font-bold">
          Tổng kết tuần · {range}
        </h2>
        <span className="text-sm text-ink/75">Nhìn lại tuần qua — để cả nhà cùng nói chuyện, không chấm điểm.</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="ngày đạt" value={`${stats.okDays}/7`} />
        <Tile label="bài làm sớm" value={`★ ${stats.early}`} />
        <Tile label="thời gian học" value={hoursMinutes(stats.minutes)} />
        <Tile label="ngày theo đúng kế hoạch" value={`${stats.planKeptDays}/${stats.planDays}`} />
      </div>
      {editing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onSave({ wentWell, changeNext })) setEditing(false);
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-bold">
            {REVIEW_QUESTIONS.wentWell}
            <textarea value={wentWell} onChange={(e) => setWentWell(e.target.value)} maxLength={500} rows={2} className="resize-none rounded-xl border border-ink/30 p-3 text-base font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            {REVIEW_QUESTIONS.changeNext}
            <textarea value={changeNext} onChange={(e) => setChangeNext(e.target.value)} maxLength={500} rows={2} className="resize-none rounded-xl border border-ink/30 p-3 text-base font-normal" />
          </label>
          <span className="text-xs text-ink/65">Bố mẹ sẽ đọc câu trả lời để cùng con nói chuyện.</span>
          <button type="submit" disabled={busy || (!wentWell.trim() && !changeNext.trim())} className="min-h-12 rounded-2xl text-base font-bold text-white disabled:opacity-50" style={{ background: color }}>
            Gửi tổng kết
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            <strong>{REVIEW_QUESTIONS.wentWell}</strong> {review?.wentWell ?? "—"}
          </p>
          <p>
            <strong>{REVIEW_QUESTIONS.changeNext}</strong> {review?.changeNext ?? "—"}
          </p>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-accent">✓ Đã gửi cho bố mẹ</span>
            <button type="button" onClick={() => setEditing(true)} className="min-h-11 px-2 font-semibold underline" style={{ color }}>
              Sửa
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
