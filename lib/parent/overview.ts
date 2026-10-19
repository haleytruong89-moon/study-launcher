/**
 * Parent "Hôm nay" dashboard and "Ngày của con" (UI review 19/10/2026). PURE display
 * helpers over the child's DayState: what is overdue, what is due today, what is coming,
 * and a short tag per task. Nothing here decides locking; the server's DayState does.
 */
import type { DayState, Status, TaskView } from "@/lib/dayState";
import { addDays } from "@/lib/time";
import { dayProgress, vnTime } from "@/lib/today/view";

export type Verdict = "ok" | "not_ok" | null;
export type Tone = "late" | "todo" | "run" | "wait" | "ok" | "bad";

export interface TaskRow {
  key: string;
  title: string;
  meta: string;
  tag: { label: string; tone: Tone };
}

export interface ChildOverview {
  pill: string;
  machine: string;
  open: boolean;
  done: number;
  total: number;
  pct: number;
  minutes: number;
  overdue: TaskRow[];
  today: TaskRow[];
  upcoming: TaskRow[];
  /** Upcoming items not shown on the dashboard (it shows the 3 nearest). */
  upcomingMore: number;
  /** Finished today with photos the parent has not marked yet. */
  awaiting: number;
}

export const UPCOMING_SHOWN = 3;

const dm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** "Hạn 17/10 · trễ 2 ngày" · "Nộp hôm nay" · "Nộp mai 20/10" · "Nộp 22/10". */
export function dueText(dueDate: string, today: string): string {
  if (dueDate < today) return `Hạn ${dm(dueDate)} · trễ ${daysBetween(dueDate, today)} ngày`;
  if (dueDate === today) return "Nộp hôm nay";
  if (dueDate === addDays(today, 1)) return `Nộp mai ${dm(dueDate)}`;
  return `Nộp ${dm(dueDate)}`;
}

/** Minutes a finished task took (0 when it never started). */
export function minutesTaken(item: Pick<TaskView, "startedAt" | "doneAt">): number {
  if (!item.startedAt || !item.doneAt) return 0;
  return Math.max(0, Math.round((Date.parse(item.doneAt) - Date.parse(item.startedAt)) / 60_000));
}

export function taskTitle(item: TaskView): string {
  if (item.source === "homework") return item.title;
  return `${item.part === 1 ? "Bổ sung" : "Kỹ năng"} · ${item.title}`;
}

function taskMetaText(item: TaskView, today: string): string {
  if (item.source === "homework") {
    const due = item.dueDate ? dueText(item.dueDate, today) : "";
    const note = item.note ? item.note.replace(/\s+/g, " ").trim() : "";
    const short = note.length > 40 ? `${note.slice(0, 40)}…` : note;
    return [due, short].filter(Boolean).join(" · ");
  }
  return item.minMinutes > 0 ? `Tối thiểu ${item.minMinutes}′` : "Không giới hạn thời gian";
}

/** The tag on the right of a task row: words first, colour second. */
export function taskTag(item: TaskView, verdict: Verdict, nowMs: number): { label: string; tone: Tone } {
  const star = item.early ? " ★" : "";
  if (item.state === "done") {
    if (verdict === "ok") return { label: `Đạt${star}`, tone: "ok" };
    if (verdict === "not_ok") return { label: `Chưa đạt${star}`, tone: "bad" };
    if (item.proofCount > 0) return { label: `Chờ xem${star}`, tone: "wait" };
    return { label: `Xong${item.doneAt ? ` ${vnTime(item.doneAt)}` : ""}${star}`, tone: "ok" };
  }
  if (item.state === "running" && item.startedAt) {
    const m = Math.max(0, Math.floor((nowMs - Date.parse(item.startedAt)) / 60_000));
    return { label: `Đang làm ${m}′`, tone: "run" };
  }
  return { label: "Chưa làm", tone: item.overdue ? "late" : "todo" };
}

/** Short status for the parent (the child sees statusPill instead). */
export function parentPill(state: DayState): string {
  const labels: Record<Status, string> = {
    LOCK_P1: "Đang học",
    BREAK_OFFER: "Xong phần bắt buộc",
    BREAK: "Đang nghỉ",
    LOCK_P2: "Đang làm kỹ năng",
    FREE: "Xong hết · giờ tự do",
    LOCK_END: "Xong hết",
    OPEN_SICK: "Ngày ốm",
    OPEN_TRUST: "Tin tưởng",
    OPEN_OVERRIDE: "Bố mẹ đang mở máy",
    LOCK_OVERRIDE: "Bố mẹ đang khóa máy",
  };
  if (state.status === "LOCK_P1") {
    const all = [...state.part1.items, ...state.part2.items];
    if (!all.some((i) => i.state === "running" || i.state === "done")) return "Chưa bắt đầu";
  }
  return labels[state.status];
}

/** "Máy: chỉ trang học" · "Máy: mở mọi trang đến 22:10". */
export function machineText(state: Pick<DayState, "open" | "openUntil">): string {
  if (!state.open) return "Máy: chỉ trang học";
  return `Máy: mở mọi trang${state.openUntil ? ` đến ${vnTime(state.openUntil)}` : ""}`;
}

export function childOverview(state: DayState, verdicts: ReadonlyMap<string, Verdict>, now: Date): ChildOverview {
  const today = state.localDate;
  const nowMs = now.getTime();
  const row = (i: TaskView): TaskRow => ({
    key: i.key,
    title: taskTitle(i),
    meta: taskMetaText(i, today),
    tag: taskTag(i, i.runId ? (verdicts.get(i.runId) ?? null) : null, nowMs),
  });
  const items = [...state.part1.items, ...state.part2.items].filter((i) => !i.placeholder);
  const isOverdue = (i: TaskView) => i.overdue && i.state !== "done";

  const overdue = items.filter(isOverdue);
  const todayItems = items.filter((i) => i.group !== "upcoming" && !isOverdue(i));
  const upcomingAll = items
    .filter((i) => i.group === "upcoming")
    .sort((a, b) => Number(a.state === "done") - Number(b.state === "done") || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const { done, total } = dayProgress(state);
  // DayState only lists homework finished today, and today's templates.
  const finishedToday = items.filter((i) => i.state === "done");
  return {
    pill: parentPill(state),
    machine: machineText(state),
    open: state.open,
    done,
    total,
    pct: total > 0 ? Math.round((done / total) * 100) : 100,
    minutes: finishedToday.reduce((sum, i) => sum + minutesTaken(i), 0),
    overdue: overdue.map(row),
    today: todayItems.map(row),
    upcoming: upcomingAll.slice(0, UPCOMING_SHOWN).map(row),
    upcomingMore: Math.max(0, upcomingAll.length - UPCOMING_SHOWN),
    awaiting: items.filter((i) => i.state === "done" && i.proofCount > 0 && i.runId && (verdicts.get(i.runId) ?? null) === null).length,
  };
}
