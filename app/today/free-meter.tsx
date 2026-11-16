import type { FreeMeter } from "@/lib/today/view";

/**
 * "Giờ tự do tối nay" (child report 16/11/2026): how many free minutes the child has saved up,
 * and what the current focus block adds next. Display only: the server's bank (R8b) decides.
 * `compact` drops the frame (inside the Vui chơi card, which has its own).
 */
export function FreeMeterBox({ m, color, compact = false }: { m: FreeMeter; color: string; compact?: boolean }) {
  const p = m.progress;
  const pct = p ? Math.min(100, Math.round((p.focus / Math.max(1, p.atFocus)) * 100)) : 100;
  return (
    <section
      aria-label={m.started ? "Giờ tự do hôm nay" : "Giờ tự do tối nay"}
      className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-1.5 rounded-[20px] border border-ink/10 bg-white p-[18px]"}
    >
      <p className="text-[15px]">
        <span aria-hidden>🎮 </span>
        <b>{m.started ? "Giờ tự do hôm nay" : "Giờ tự do tối nay"}: </b>
        {m.bonus > 0 ? (
          <>
            {m.base}′ + <b style={{ color }}>{m.bonus}′</b> = <b className="text-lg">{m.total}′</b>
          </>
        ) : (
          <b className="text-lg">{m.total}′</b>
        )}
      </p>
      {p && (
        <>
          <div
            role="progressbar"
            aria-label="Tập trung tới mốc thưởng tiếp theo"
            aria-valuemin={0}
            aria-valuemax={p.atFocus}
            aria-valuenow={p.focus}
            className="h-2 overflow-hidden rounded-full bg-[#ECEEE8]"
          >
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
          <p className="text-sm text-ink/80">
            {p.focus > 0 ? `Đang tập trung ${p.focus}′ · ` : ""}thêm <b>{p.more}′</b> nữa → <b style={{ color }}>+{p.gain}′</b>
            {m.countsOnXong ? " (bấm Xong để tính)" : ""}
          </p>
        </>
      )}
      {!m.started && m.bonus > 0 && <p className="text-[13px] text-ink/65">Nghỉ giữa giờ sẽ trừ vào phần +{m.bonus}′ này.</p>}
    </section>
  );
}
