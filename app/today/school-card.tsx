"use client";

import { DAY_NAMES } from "@/lib/timetable/rules";
import type { ExtraLine, SchoolDay } from "./use-school-day";

/** 21/11/2026: the child's extra classes (học thêm / gia sư) of a day. */
function ExtraList({ label, lines }: { label: string; lines: ExtraLine[] }) {
  return (
    <ul aria-label={label} className="flex flex-col">
      {lines.map((x) => (
        <li key={`${x.start}${x.subject}`} className="flex flex-wrap items-baseline gap-x-2 border-t border-ink/10 py-1 text-sm first:border-t-0">
          <span className="w-24 shrink-0 text-ink/60 tabular-nums">
            {x.start}–{x.end}
          </span>
          <span className="font-semibold">{x.subject}</span>
          <span className="text-xs text-ink/60">· {x.place}</span>
        </li>
      ))}
    </ul>
  );
}

/** Minutes since midnight, Vietnam time. */
function vnMinutes(ms: number): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ms));
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

function inRange(time: string | null, minutes: number): boolean {
  if (!time) return false;
  const [a, b] = time.split("-").map((t) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  });
  return a !== undefined && b !== undefined && minutes >= a && minutes < b;
}

/**
 * Thời khóa biểu for the child (18/11/2026), in Góc học tập: today's lessons (the one going on
 * now in bold) and today's extra classes. Read only; hidden until there is a timetable. Since
 * 21/11/2026 "Chuẩn bị cho ngày mai" is its own card (PrepCard) and the data comes from
 * `useSchoolDay` (one read shared by the cards).
 */
export function SchoolCard({ data, color }: { data: SchoolDay | null; color: string }) {
  if (!data?.has) return null;
  const today = data.today && data.today.periods.length > 0 ? data.today : null;
  const extrasToday = data.extrasToday ?? [];
  if (!today && extrasToday.length === 0) return null;
  const minutes = vnMinutes(data.nowMs);

  return (
    <section aria-label="Thời khóa biểu" className="flex flex-col gap-3 rounded-[20px] border border-ink/10 bg-white p-[18px]">
      {today && (
        <div className="flex flex-col gap-1.5">
          <h2 className="font-bold">
            <span aria-hidden>🏫 </span>Hôm nay ở trường · {DAY_NAMES[today.weekday]}
          </h2>
          <ol aria-label="Các tiết hôm nay" className="flex flex-col">
            {today.periods.map((p) => {
              const now = inRange(p.time, minutes);
              return (
                <li
                  key={`${p.session}${p.n}`}
                  aria-current={now ? "true" : undefined}
                  className={`flex items-baseline gap-2 border-t border-ink/10 py-1 text-sm first:border-t-0 ${now ? "font-extrabold" : ""}`}
                  style={now ? { color } : undefined}
                >
                  <span className="w-16 shrink-0 text-ink/60 tabular-nums">
                    {p.session === "am" ? "Sáng" : "Chiều"} {p.n}
                  </span>
                  <span className="grow">{p.subject}</span>
                  {p.time && <span className="text-xs text-ink/60 tabular-nums">{p.time.replace("-", "–")}</span>}
                </li>
              );
            })}
          </ol>
          {today.note && <p className="text-xs text-ink/65">{today.note}</p>}
        </div>
      )}
      {extrasToday.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h2 className="font-bold">Học thêm hôm nay</h2>
          <ExtraList label="Học thêm hôm nay" lines={extrasToday} />
        </div>
      )}
    </section>
  );
}
