/**
 * Subject chips offered when assigning homework (mockup "Giao bài tập").
 * A UI convenience only, not a family rule: the stored value is free text,
 * and "Khác" lets the parent type any subject.
 */
export const SUBJECTS = [
  "Toán",
  "Ngữ văn",
  "Tiếng Anh",
  "KHTN",
  "Lịch sử & Địa lí",
  "GDCD",
  "Tin học",
  "Công nghệ",
] as const;

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
  7: "CN",
};

/** "T2, T4, T6" for a sorted weekday list. */
export function formatWeekdays(weekdays: readonly number[]): string {
  if (weekdays.length === 7) return "Hằng ngày";
  return weekdays.map((d) => WEEKDAY_LABELS[d] ?? "?").join(", ");
}

/** "dd/mm" from YYYY-MM-DD. */
export function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}
