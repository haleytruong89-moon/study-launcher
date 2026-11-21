import type { TaskView } from "@/lib/dayState/types";
import { taskName } from "@/lib/today/taskName";
import { subjectKey, type DayPlan } from "@/lib/timetable/rules";
import type { ClassPrep } from "./classPrep";
import type { ExtraClass, ExtraSession, SubjectRow } from "./rules";

export type PrepKey = "books" | "bring" | "uniform" | "extras" | `hw:${string}`;

export interface PrepItem {
  key: PrepKey;
  title: string;
  text: string;
  /** `hw:` rows tick themselves when the task is done; the child cannot tick them. */
  auto: boolean;
  done: boolean;
}

export interface PrepView {
  /** The school day being prepared (YYYY-MM-DD). */
  date: string;
  items: PrepItem[];
  ticked: string[];
  /** When every row the child ticks was ticked. */
  doneAt: string | null;
}

/**
 * "Chuẩn bị cho ngày mai" (parent decision 21/11/2026: the child ticks, the parents see "đã chuẩn bị").
 * Pure, display only: it never changes what is done, locked or open.
 *
 * - books: the next school day's subjects ("Toán (2 tiết) · Địa lí").
 * - bring: what those subjects need besides sách vở (the child's own list, defaults prefilled).
 * - uniform: the day's uniform (PE wins, see `uniformFor`).
 * - extras: that day's học thêm, with what to bring.
 * - hw:<taskKey>: homework to finish before the next extra class (English OS before Tiếng Anh).
 * Empty rows are left out; no school day → [].
 */
export function prepItems(input: {
  plan: DayPlan | null;
  extrasNext: readonly { extra: ExtraClass; session: ExtraSession }[];
  rows: readonly SubjectRow[];
  prep: readonly ClassPrep[];
  items: readonly TaskView[];
  ticked: readonly string[];
}): PrepItem[] {
  const { plan, extrasNext, rows, prep, items, ticked } = input;
  if (!plan || plan.periods.length === 0) return [];
  const on = new Set(ticked);
  const out: PrepItem[] = [];
  const tick = (key: PrepKey, title: string, text: string) => out.push({ key, title, text, auto: false, done: on.has(key) });

  const counts = new Map<string, { name: string; n: number }>();
  for (const p of plan.periods) {
    const k = subjectKey(p.subject);
    const c = counts.get(k);
    if (c) c.n += 1;
    else counts.set(k, { name: p.subject, n: 1 });
  }
  const subjects = [...counts.values()];
  tick("books", `Sách vở ${subjects.length} môn`, subjects.map((c) => (c.n > 1 ? `${c.name} (${c.n} tiết)` : c.name)).join(" · "));

  const bring = [...counts.keys()]
    .map((k) => rows.find((r) => r.key === k))
    .filter((r): r is SubjectRow => !!r && r.bring.trim() !== "")
    .map((r) => `${r.label}: ${r.bring.trim()}`);
  if (bring.length > 0) tick("bring", "Đồ dùng", bring.join(" · "));

  if (plan.uniform) tick("uniform", "Đồng phục", plan.uniform);

  if (extrasNext.length > 0) {
    const lines = extrasNext.map(({ extra, session }) => `${session.start}–${session.end} ${extra.subject}${extra.bring.trim() ? ` · ${extra.bring.trim()}` : ""}`);
    tick("extras", extrasNext.length > 1 ? `Học thêm (${extrasNext.length} buổi)` : "Học thêm", lines.join(" · "));
  }

  const byKey = new Map(items.map((i) => [i.key, i]));
  for (const p of prep) {
    const task = byKey.get(p.taskKey);
    if (!task) continue;
    out.push({ key: `hw:${p.taskKey}`, title: `Làm xong ${taskName(task)}`, text: p.label, auto: true, done: task.state === "done" });
  }
  return out;
}

/** The rows the child ticks (the `hw:` rows tick themselves). */
export const tickableKeys = (items: readonly PrepItem[]): string[] => items.filter((i) => !i.auto).map((i) => i.key);

/** Every row the child ticks is ticked (and there is at least one). */
export const prepDone = (items: readonly PrepItem[], ticked: readonly string[]): boolean => {
  const keys = tickableKeys(items);
  return keys.length > 0 && keys.every((k) => ticked.includes(k));
};

/**
 * The parent's line (21/11/2026): "Chuẩn bị cho Thứ 6: ✓ 19:50" / "2/4 dòng" / "chưa". null when
 * there is nothing to say yet (no school day, or before 19:00 with nothing ticked).
 */
export function prepParentLine(input: { dayName: string; keys: number; ticked: number; doneAt: string | null; evening: boolean }): string | null {
  const { dayName, keys, ticked, doneAt, evening } = input;
  if (keys === 0) return null;
  if (doneAt) {
    const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(doneAt));
    return `Chuẩn bị cho ${dayName}: ✓ ${hm}`;
  }
  if (ticked > 0) return `Chuẩn bị cho ${dayName}: ${ticked}/${keys} dòng`;
  return evening ? `Chuẩn bị cho ${dayName}: chưa` : null;
}
