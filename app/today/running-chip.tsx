"use client";

import type { TaskView } from "@/lib/dayState";
import { chipTime, elapsedMs, shortTitle } from "@/lib/today/focus";

/**
 * R7a: a small "⏱ Đang làm …" pill in the header, on every tab, while a task runs. Tapping it
 * opens the focus screen (it never opens by itself). Minutes only.
 */
export function RunningChip({ running, nowMs, paused, onOpen }: { running: TaskView[]; nowMs: number; paused: boolean; onOpen: (item: TaskView) => void }) {
  const item = running[0];
  if (!item) return null;
  const time = chipTime(elapsedMs(item, nowMs), item.minMinutes);
  const more = running.length > 1 ? ` · +${running.length - 1}` : "";
  return (
    <button
      id="running-chip"
      type="button"
      disabled={paused}
      onClick={() => onOpen(item)}
      aria-label={`Đang làm ${item.title}, ${time}${running.length > 1 ? `, và ${running.length - 1} việc nữa` : ""}. Mở màn tập trung`}
      className="inline-flex min-h-11 max-w-full items-center gap-1.5 self-start rounded-full border-[1.5px] border-white/55 bg-white/15 px-3.5 text-sm font-semibold text-white hover:bg-white/25 disabled:opacity-60"
    >
      <span aria-hidden>⏱</span>
      <span className="truncate">
        Đang làm <b>{shortTitle(item.title)}</b> · {time}
        {more}
      </span>
    </button>
  );
}
