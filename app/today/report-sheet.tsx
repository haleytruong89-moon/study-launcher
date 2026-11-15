"use client";

import { useState } from "react";
import type { TaskView } from "@/lib/dayState";
import { clockMinutes, defaultReportTimes } from "@/lib/today/report";
import { Modal } from "./today-extras";

/**
 * "Con quên bấm Bắt đầu?" (parent decision 15/11/2026): the child says when they did the task.
 * Default: the last 30 minutes on the SERVER clock (`nowMs` carries the server offset). The
 * server checks the times again and stores a pending report; nothing counts until a parent
 * says Đồng ý. Calm wording: no blame, no warning colours.
 */
export function ReportSheet({
  item,
  color,
  nowMs,
  busy,
  error,
  onSend,
  onClose,
}: {
  item: TaskView;
  color: string;
  nowMs: number;
  busy: boolean;
  error: string | null;
  onSend: (from: string, to: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [times, setTimes] = useState(() => defaultReportTimes(nowMs));
  const minutes = clockMinutes(times.from, times.to);
  const input = "min-h-12 rounded-xl border-[1.5px] border-ink/25 bg-white px-3 text-lg font-bold";
  return (
    <Modal title="Con quên bấm Bắt đầu?" error={error} onClose={onClose}>
      <p className="text-[15px] text-ink/80">
        Con đã làm <b>{item.title}</b> mà chưa bấm Bắt đầu? Con chọn giờ đã làm nhé.
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSend(times.from, times.to).then((ok) => {
            if (ok) onClose();
          });
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Con đã làm từ
            <input type="time" step={60} required value={times.from} onChange={(e) => setTimes((t) => ({ ...t, from: e.target.value }))} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            đến
            <input type="time" step={60} required value={times.to} onChange={(e) => setTimes((t) => ({ ...t, to: e.target.value }))} className={input} />
          </label>
          <span className="pb-3 text-sm text-ink/70">{minutes ? `${minutes} phút` : ""}</span>
        </div>
        <p className="text-sm text-ink/75">Bố mẹ sẽ xác nhận giúp con. Khi bố mẹ đồng ý, lượt này được tính như con đã bấm Bắt đầu.</p>
        <div className="flex flex-col gap-2">
          <button type="submit" disabled={busy || minutes === null} className="min-h-12 rounded-2xl text-base font-bold text-white disabled:opacity-50" style={{ background: color }}>
            Gửi bố mẹ
          </button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-2xl text-[15px] font-semibold text-ink/75">
            Để sau
          </button>
        </div>
      </form>
    </Modal>
  );
}
