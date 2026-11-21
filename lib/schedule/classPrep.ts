import type { TaskView } from "@/lib/dayState/types";
import { addDays, atLocalTime } from "@/lib/time";
import { subjectKeyIn } from "@/lib/timetable/rules";
import { extrasOn, type ExtraClass } from "./rules";

export interface ClassPrep {
  taskKey: string;
  /** "Trước buổi Gia sư Tiếng Anh 20:30 tối nay" / "Mai học thêm Toán 13:30". */
  label: string;
  startsAtMs: number;
  extraId: string;
}

/**
 * Parent 21/11/2026: before a học thêm class, the homework the teacher gives on its app comes first
 * (English OS for Tiếng Anh; the Toán app when it exists). A task matches a class that starts LATER
 * TODAY or TOMORROW when: the class names an app slot and the task opens that slot; or the class names
 * none and the task is a set task (template, Phần 1) of the same subject. School homework is never
 * matched. Done tasks are skipped. When several classes match a task, the earliest wins.
 * Display + order only: it never changes what is done, locked or open.
 */
export function classPrep(items: readonly TaskView[], extras: readonly ExtraClass[], nowMs: number, today: string): ClassPrep[] {
  const tomorrow = addDays(today, 1);
  const classes = [
    ...extrasOn(extras, today).map((c) => ({ ...c, date: today })),
    ...extrasOn(extras, tomorrow).map((c) => ({ ...c, date: tomorrow })),
  ]
    .map((c) => ({ ...c, at: atLocalTime(c.date, c.session.start).getTime() }))
    .filter((c) => c.at > nowMs)
    .sort((a, b) => a.at - b.at);
  if (classes.length === 0) return [];

  const out: ClassPrep[] = [];
  for (const item of items) {
    if (item.source !== "template" || item.state === "done" || item.state === "placeholder") continue;
    const cls = classes.find(({ extra }) =>
      extra.appSlotId
        ? item.appSlotId === extra.appSlotId
        : item.part === 1 && subjectKeyIn(item.subject ?? item.title) === subjectKeyIn(extra.subject),
    );
    if (!cls) continue;
    const start = cls.session.start;
    const label =
      cls.date === today
        ? `Trước buổi ${cls.extra.subject} ${start} ${start >= "18:00" ? "tối nay" : "chiều nay"}`
        : `Mai học thêm ${cls.extra.subject} ${start}`;
    out.push({ taskKey: item.key, label, startsAtMs: cls.at, extraId: cls.extra.id });
  }
  return out.sort((a, b) => a.startsAtMs - b.startsAtMs);
}
