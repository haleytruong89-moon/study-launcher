"use client";

import { useState } from "react";
import { prepDone, tickableKeys, type PrepView } from "@/lib/schedule/prep";
import { isoWeekday } from "@/lib/time";
import { DAY_NAMES } from "@/lib/timetable/rules";
import { Shirt } from "./shirt";

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * "Chuẩn bị cho ngày mai" (parent decision 21/11/2026: "Con tích, bố mẹ thấy 'đã chuẩn bị'"). Shown
 * from 19:00, or earlier once today's work is complete (the server decides). The child ticks each row;
 * the "Làm xong …" rows (homework before the next extra class) tick themselves when the task is done.
 * Display only: ticking never changes what is done, locked or open.
 */
export function PrepCard({
  prep,
  color,
  onSaved,
  doneTasks,
}: {
  prep: PrepView;
  color: string;
  onSaved: (ticked: string[], doneAt: string | null) => void;
  /** Keys of today's tasks that are done now (the card's data may be up to 15 minutes old). */
  doneTasks: ReadonlySet<string>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (prep.items.length === 0) return null;
  const keys = tickableKeys(prep.items);
  const ticked = prep.ticked.filter((k) => keys.includes(k));
  const done = prepDone(prep.items, ticked);

  async function toggle(key: string, on: boolean) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: prep.date, key, on }),
      });
      const body = (await res.json().catch(() => null)) as { ticked?: string[]; doneAt?: string | null; error?: string } | null;
      if (!res.ok || !body?.ticked) {
        setError(body?.error ?? "Chưa lưu được, con thử lại nhé.");
        return;
      }
      onSaved(body.ticked, body.doneAt ?? null);
    } catch {
      setError("Chưa lưu được, con thử lại nhé.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Chuẩn bị cho ngày mai" className="flex flex-col gap-2.5 rounded-[20px] border border-ink/10 bg-white p-[18px]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">
          <span aria-hidden>🎒 </span>Chuẩn bị cho {DAY_NAMES[isoWeekday(prep.date)]} {dm(prep.date)}
        </h2>
        <span className="text-[13px] font-semibold text-ink/70 tabular-nums">
          {ticked.length}/{keys.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {prep.items.map((row) => {
          const item = row.auto && row.key.startsWith("hw:") && doneTasks.has(row.key.slice(3)) ? { ...row, done: true } : row;
          const box = (
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-extrabold text-white"
              style={item.done ? { background: color, borderColor: color } : { borderColor: "#C4C9C1", background: "#fff" }}
            >
              {item.done ? "✓" : ""}
            </span>
          );
          const body = (
            <span className="flex min-w-0 flex-col items-start text-left">
              <b className="text-[15px]">{item.title}</b>
              <span className="flex items-start gap-1 text-[13px] break-words text-ink/70">
                {item.key === "uniform" && <Shirt uniform={item.text} />}
                {item.text}
              </span>
            </span>
          );
          return (
            <li key={item.key}>
              {item.auto ? (
                <div className="flex min-h-[44px] items-center gap-3 rounded-xl bg-[#FFF4E8] px-3 py-2" aria-label={`${item.title}${item.done ? " · đã xong" : " · chưa xong"}`}>
                  {box}
                  {body}
                  <span className="ml-auto shrink-0 text-xs font-semibold text-[#8A4A07]">{item.done ? "Đã xong" : "Tự tích khi xong bài"}</span>
                </div>
              ) : (
                <button
                  type="button"
                  aria-pressed={item.done}
                  disabled={busy !== null}
                  onClick={() => void toggle(item.key, !item.done)}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 disabled:opacity-60"
                  style={{ background: item.done ? `color-mix(in srgb, ${color} 10%, white)` : "#ECEEE8" }}
                >
                  {box}
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-sm font-semibold text-[#A3361F]">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm font-bold" style={{ color }}>
          <span aria-hidden>✓ </span>Xong chuẩn bị cặp.
        </p>
      )}
    </section>
  );
}
