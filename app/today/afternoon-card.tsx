"use client";

import { afternoonStrip, blockMinutes, currentBlock, stripOver, type StripBlock } from "@/lib/schedule/afternoon";
import { extrasOn, type ExtraClass } from "@/lib/schedule/rules";
import { isoWeekday } from "@/lib/time";
import { DAY_NAMES, type DayPlan } from "@/lib/timetable/rules";

const FILL: Record<StripBlock["kind"], string> = { school: "#2B5D4F", extra: "#8A4FA8", free: "#DDE1D9" };

/** Minutes since midnight, Vietnam time (`nowMs` already carries the server offset). */
function vnMinutes(ms: number): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ms));
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

/**
 * "Chiều nay" on Hôm nay (Lịch học con tự quản, Lát 3, design screen 5): afternoon school, extra
 * classes and the free time between them, as a bar and a list; the block going on now is marked.
 * Hidden on a day with neither, and after the last block. Display only (it never changes the lock).
 */
export function AfternoonCard({ plan, extras, date, nowMs, color }: { plan: DayPlan | null; extras: readonly ExtraClass[]; date: string; nowMs: number; color: string }) {
  const blocks = afternoonStrip(plan, extrasOn(extras, date));
  const minutes = vnMinutes(nowMs);
  if (stripOver(blocks, minutes)) return null;
  const now = currentBlock(blocks, minutes);
  const total = blocks.reduce((n, b) => n + blockMinutes(b), 0);
  const past = (b: StripBlock) => minutes >= Number(b.end.slice(0, 2)) * 60 + Number(b.end.slice(3, 5));

  return (
    <section aria-label="Chiều nay" className="flex flex-col gap-2.5 rounded-[20px] border border-ink/10 bg-white p-4">
      <h2 className="font-bold">
        <span aria-hidden>🕑 </span>Chiều nay · {DAY_NAMES[isoWeekday(date)]}
      </h2>
      <div aria-hidden className="flex h-3 overflow-hidden rounded-full">
        {blocks.map((b, i) => (
          <span
            key={`${b.start}${i}`}
            className="h-full border-r-2 border-white last:border-r-0"
            style={{ width: `${(blockMinutes(b) / total) * 100}%`, background: FILL[b.kind], opacity: past(b) ? 0.35 : 1 }}
          />
        ))}
      </div>
      <ol aria-label="Các khoảng chiều nay" className="flex flex-col">
        {blocks.map((b, i) => {
          const current = i === now;
          return (
            <li
              key={`${b.start}${i}`}
              aria-current={current ? "true" : undefined}
              className={`flex items-baseline gap-2 border-t border-ink/10 py-1 text-sm first:border-t-0 ${current ? "font-extrabold" : ""} ${past(b) ? "text-ink/45" : ""}`}
              style={current ? { color } : undefined}
            >
              <span aria-hidden className="size-2.5 shrink-0 self-center rounded-full" style={{ background: FILL[b.kind] }} />
              <span className="w-24 shrink-0 tabular-nums">
                {b.start}–{b.end}
              </span>
              <span className="grow">{b.kind === "free" ? b.label : <b>{b.label}</b>}</span>
              {current && <span className="text-xs">đang diễn ra</span>}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-ink/60">Con sửa giờ ở Góc học tập → Lịch của con → Sửa lịch học.</p>
    </section>
  );
}
