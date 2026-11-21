"use client";

import { useEffect, useState } from "react";
import { DAY_NAMES, type DayPlan } from "@/lib/timetable/rules";

type ExtraLine = { subject: string; start: string; end: string; place: string; bring: string };
type Data = { has: boolean; today: DayPlan | null; next: DayPlan | null; extrasToday?: ExtraLine[]; extrasNext?: ExtraLine[]; nowMs: number };

/** 21/11/2026: the child's extra classes (học thêm / gia sư) of a day. */
function ExtraList({ label, lines, withBring }: { label: string; lines: ExtraLine[]; withBring?: boolean }) {
  return (
    <ul aria-label={label} className="flex flex-col">
      {lines.map((x) => (
        <li key={`${x.start}${x.subject}`} className="flex flex-wrap items-baseline gap-x-2 border-t border-ink/10 py-1 text-sm first:border-t-0">
          <span className="w-24 shrink-0 text-ink/60 tabular-nums">
            {x.start}–{x.end}
          </span>
          <span className="font-semibold">{x.subject}</span>
          <span className="text-xs text-ink/60">· {x.place}</span>
          {withBring && x.bring && <span className="w-full pl-[6.5rem] text-xs text-ink/70">Mang: {x.bring}</span>}
        </li>
      ))}
    </ul>
  );
}

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

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

/** Subjects of a day in order, each once ("Toán · Văn · Anh"). */
function subjectsOf(plan: DayPlan): string[] {
  return [...new Set(plan.periods.map((p) => p.subject))];
}

/**
 * Thời khóa biểu for the child (18/11/2026), in Góc học tập: today's lessons (the one going on
 * now in bold) and, from 19:00, what to pack for the next school day + the uniform. Read only;
 * hidden until the parents add a timetable.
 */
export function SchoolCard({ color }: { color: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [clock, setClock] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/timetable", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<Data>) : null))
        .then((d) => {
          if (!live || !d) return;
          setData(d);
          setClock(d.nowMs);
        })
        .catch(() => undefined);
    void load();
    // Re-read every 15 minutes (the period going on now; "Chuẩn bị" from 19:00).
    const id = window.setInterval(() => void load(), 15 * 60_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  if (!data?.has) return null;
  const today = data.today && data.today.periods.length > 0 ? data.today : null;
  const next = data.next;
  const extrasToday = data.extrasToday ?? [];
  const extrasNext = data.extrasNext ?? [];
  if (!today && !next && extrasToday.length === 0) return null;
  const minutes = clock !== null ? vnMinutes(clock) : -1;

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
      {next && (
        <div aria-label="Chuẩn bị cho ngày mai" className="flex flex-col gap-1.5 rounded-xl bg-bg p-3">
          <h2 className="font-bold">
            <span aria-hidden>🎒 </span>Chuẩn bị cho {DAY_NAMES[next.weekday]} {dm(next.date)}
          </h2>
          <ul aria-label="Môn cần mang sách vở" className="flex flex-wrap gap-1.5">
            {subjectsOf(next).map((s) => (
              <li key={s} className="rounded-full border border-ink/15 bg-white px-2.5 py-0.5 text-sm font-semibold">
                {s}
              </li>
            ))}
          </ul>
          {next.uniform && (
            <p className="text-sm">
              <span aria-hidden>👕 </span>
              <b>Đồng phục:</b> {next.uniform}
            </p>
          )}
          {extrasNext.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold">Học thêm {DAY_NAMES[next.weekday]}:</p>
              <ExtraList label="Học thêm ngày mai" lines={extrasNext} withBring />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
