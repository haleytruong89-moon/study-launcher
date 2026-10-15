/**
 * Wording and small calculations for the child's "Hôm nay" screen (mockup Main.dc.html).
 * Pure functions, safe to use in client components. Display only: every decision is the server's.
 */
import type { DayState, TaskView, WeekResult } from "@/lib/dayState";
import { isoWeekday } from "@/lib/time";

export interface Banner {
  title: string;
  sub: string;
  tone: "lock" | "open" | "dark";
}

const WEEKDAY_SHORT: Record<number, string> = { 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7", 7: "CN" };
const WEEKDAY_LONG: Record<number, string> = {
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ Nhật",
};

/** "Thứ Tư, 15/10/2026" */
export function longDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${WEEKDAY_LONG[isoWeekday(date)]}, ${d}/${m}/${y}`;
}

/** "T4" or "Nay" for today. */
export function dayLabel(date: string, today: string): string {
  return date === today ? "Nay" : (WEEKDAY_SHORT[isoWeekday(date)] ?? "?");
}

/** "HH:MM" in Vietnam time for an ISO instant. */
export function vnTime(isoInstant: string): string {
  return new Date(new Date(isoInstant).getTime() + 7 * 3600_000).toISOString().slice(11, 16);
}

/** "mm:ss" (or "h:mm:ss") for a non-negative duration. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function remaining(part: { total: number; done: number }): number {
  return Math.max(0, part.total - part.done);
}

/** The big banner under the steps (one per status). */
export function bannerFor(state: DayState, rules: { breakMinutes: number; freeMinutes: number }): Banner {
  switch (state.status) {
    case "LOCK_P1":
      return {
        title: `Còn ${remaining(state.part1)} việc ở Phần 1`,
        sub: "Làm xong bài trên lớp và bài bổ sung để được nghỉ và mở Phần 2.",
        tone: "lock",
      };
    case "BREAK_OFFER":
      return {
        title: state.part1.total === 0 ? "Hôm nay Phần 1 không có việc" : "Xong Phần 1 — giỏi lắm!",
        sub:
          rules.breakMinutes > 0
            ? `Nghỉ ${rules.breakMinutes} phút (mở mọi trang) hoặc làm tiếp Phần 2 luôn.`
            : "Bấm “Học tiếp luôn” để mở Phần 2.",
        tone: "dark",
      };
    case "BREAK":
      return { title: "Đang nghỉ", sub: "Hết giờ nghỉ máy tự khóa lại và mở Phần 2.", tone: "open" };
    case "LOCK_P2":
      return {
        title: `Còn ${remaining(state.part2)} việc ở Phần 2`,
        sub: `Xong kỹ năng hôm nay là đến giờ tự do ${rules.freeMinutes} phút.`,
        tone: "lock",
      };
    case "FREE":
      return {
        title: state.free.startedAt && state.part2.complete ? `Xong cả hai phần — giờ tự do` : "Giờ tự do",
        sub: "Gợi ý: ra sân, vẽ, Lego… Hết giờ máy khóa lại đến hết ngày.",
        tone: "open",
      };
    case "LOCK_END":
      return { title: "Đã hết giờ tự do hôm nay", sub: "Máy chỉ mở trang học đến 00:00. Mai gặp lại!", tone: "dark" };
    case "OPEN_SICK":
      return { title: "Hôm nay là ngày ốm", sub: "Máy mở cả ngày. Nghỉ ngơi cho khỏe nhé.", tone: "open" };
    case "OPEN_TRUST":
      return { title: "Chế độ Tin tưởng", sub: "Máy không chặn trang nào. Việc hôm nay vẫn ở dưới — tự giác nhé.", tone: "open" };
    case "OPEN_OVERRIDE":
      return {
        title: "Bố mẹ đã mở máy",
        sub: state.openUntil ? `Mở mọi trang đến ${vnTime(state.openUntil)}.` : "Mở mọi trang.",
        tone: "open",
      };
    case "LOCK_OVERRIDE":
      return { title: "Bố mẹ đang tạm khóa máy", sub: "Chỉ mở trang học. Việc hôm nay vẫn làm bình thường.", tone: "dark" };
  }
}

/** 0 = Bài tập, 1 = Nghỉ, 2 = Kỹ năng, 3 = Giờ tự do, 4 = all done (derived from data). */
export function stepIndex(state: DayState, nowMs: number): number {
  if (state.free.startedAt !== null) {
    return state.free.endsAt !== null && nowMs < new Date(state.free.endsAt).getTime() ? 3 : 4;
  }
  if (!state.part1.complete) return 0;
  if (state.break.state === "offer" || state.break.state === "running") return 1;
  return 2;
}

export function isOkResult(r: WeekResult): boolean {
  return r === "ok" || r === "pass" || r === "sick";
}

/** "5/6 ngày đạt" over the 6 days before today. */
export function weekSummary(week: DayState["week"]): string {
  const past = week.slice(0, -1);
  return `${past.filter((d) => isOkResult(d.result)).length}/${past.length} ngày đạt`;
}

/** Second line under a task (what to do next / how long). */
export function taskMeta(item: TaskView, nowMs: number): string {
  if (item.placeholder) return "Chưa có app — không tính vào việc phải làm";
  if (item.state === "done") {
    const took =
      item.startedAt && item.doneAt
        ? Math.max(1, Math.round((new Date(item.doneAt).getTime() - new Date(item.startedAt).getTime()) / 60_000))
        : null;
    return `Xong${took ? ` · ${took} phút` : ""}${item.requiresProof ? " · đã gửi ảnh cho bố mẹ" : ""}`;
  }
  if (item.state === "running" && item.startedAt) {
    const elapsed = clock(nowMs - new Date(item.startedAt).getTime());
    if (item.requiresProof) return `Đang làm · ${elapsed} — làm xong thì chụp ảnh bài`;
    if (item.canFinishAt && nowMs < new Date(item.canFinishAt).getTime()) return `Đang làm · ${elapsed} / ${clock(item.minMinutes * 60_000)}`;
    return `Đủ ${item.minMinutes} phút — bấm Xong khi làm xong`;
  }
  if (item.source === "homework") {
    const due = item.overdue ? "Quá hạn" : "Hạn nộp " + (item.dueDate ? item.dueDate.slice(8, 10) + "/" + item.dueDate.slice(5, 7) : "");
    return `${due} · không giới hạn thời gian · chụp ảnh khi xong`;
  }
  return item.minMinutes > 0 ? `Tối thiểu ${item.minMinutes} phút` : "Không giới hạn thời gian";
}

/** 0..100 progress toward the minimum time of a running template task. */
export function taskProgress(item: TaskView, nowMs: number): number {
  if (item.state !== "running" || !item.startedAt || item.minMinutes <= 0) return item.state === "done" ? 100 : 0;
  const pct = ((nowMs - new Date(item.startedAt).getTime()) / (item.minMinutes * 60_000)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
