import type { Voice } from "@/lib/binhYen/catalog";
import type { TaskView } from "@/lib/dayState";

/**
 * R7a (parent 08/11: the children were startled by a full-screen seconds timer): calm helpers
 * for the start sheet, the running chip, the optional focus view and the Góc học tập timer.
 * Minutes only, never seconds. Display only: the server still decides when "Xong" works.
 */

const MIN = 60_000;

/** "vừa bắt đầu" · "12 phút" · "2 giờ 05 phút" (never seconds). */
export function minutesLabel(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / MIN);
  if (m < 1) return "vừa bắt đầu";
  if (m < 60) return `${m} phút`;
  return `${Math.floor(m / 60)} giờ ${String(m % 60).padStart(2, "0")} phút`;
}

/** Whole minutes left, rounded up ("còn khoảng 3 phút"), never below 0. */
export function remainingMinutes(ms: number): number {
  return ms <= 0 ? 0 : Math.ceil(ms / MIN);
}

/** A run that has gone on far longer than planned (e.g. started and forgotten). */
export function isLongRunning(elapsedMs: number, minMinutes: number): boolean {
  if (elapsedMs <= 0) return false;
  return elapsedMs >= Math.max(120, 3 * Math.max(0, minMinutes)) * MIN;
}

/** Time since the run started on the server clock (0 when not running). */
export function elapsedMs(item: TaskView, nowMs: number): number {
  if (item.state !== "running" || !item.startedAt) return 0;
  return Math.max(0, nowMs - Date.parse(item.startedAt));
}

/** A task with a minimum time (homework and "no limit" tasks have none). */
export const isTimed = (item: TaskView) => !item.requiresProof && item.minMinutes > 0;

/** FNV-1a: a stable unsigned 32-bit hash for picking a line. */
export function pickHash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** One calm line under the focus timer. No hype, no comparison, nothing about grades. */
export const FOCUS_LINES: Record<Voice, readonly string[]> = {
  scientist: [
    "Nhà khoa học nào cũng bắt đầu bằng một bước nhỏ.",
    "Cứ từ từ quan sát, câu trả lời sẽ hiện ra.",
    "Mỗi phút con làm là một hạt mầm đang lớn.",
    "Thử, sai, rồi thử lại — nhà khoa học học như thế.",
    "Không cần nhanh. Chỉ cần để ý từng chút một.",
    "Một câu hỏi nhỏ cũng mở ra cả một khu rừng.",
    "Thở chậm một hơi, rồi làm tiếp bước kế.",
    "Chỗ nào khó, cứ đánh dấu lại rồi đi tiếp.",
    "Bộ não lớn lên từng chút khi con chăm chú.",
    "Xong một phần nhỏ là đã tiến lên rồi.",
    "Cây nào cũng mọc chậm, nhưng ngày nào cũng mọc.",
    "Hôm nay con là nhà thám hiểm của bài này.",
    "Tò mò một chút, kiên nhẫn một chút là đủ.",
    "Cho mắt nghỉ một chút cũng được, rồi quay lại nhé.",
  ],
  detective: [
    "Từng manh mối một. Không cần vội.",
    "Thám tử giỏi biết nghỉ một nhịp rồi nhìn lại.",
    "Lúc này chỉ cần làm rõ một chi tiết.",
    "Câu dễ trước, câu khó sau. Cũng là một cách điều tra.",
    "Chậm mà chắc. Hồ sơ nào cũng giải từng trang.",
    "Đọc kỹ đề là đã đi được nửa vụ án.",
    "Một hơi thở dài trước khi lật trang tiếp theo.",
    "Không ai đang bấm giờ con. Chỉ có con và bài này.",
    "Ghi lại điều đã biết, rồi tìm điều còn thiếu.",
    "Lạc hướng một chút cũng không sao. Quay về manh mối gần nhất.",
    "Tập trung từng đoạn ngắn, rồi cho mắt nghỉ.",
    "Thám tử không cần biết hết ngay từ đầu.",
    "Mỗi dòng con viết là một dấu vết rõ thêm.",
    "Nhìn lại xem: con đã đi được một đoạn rồi.",
  ],
};

/** The same line for the same task on the same day; another one tomorrow. */
export function focusLine(voice: Voice, seed: string): string {
  const lines = FOCUS_LINES[voice];
  return lines[pickHash(seed) % lines.length] ?? lines[0] ?? "";
}

/**
 * The big timer of Góc học tập's work panel (R6c, now minutes only): the minimum before a
 * timed task starts, the minutes left while it runs, then the time worked; homework and
 * "no limit" tasks show the time worked while running.
 */
export function studyTimerLabel(item: TaskView, nowMs: number): string {
  const timed = isTimed(item);
  if (item.state !== "running") return timed ? `${item.minMinutes} phút` : "—";
  if (timed && item.canFinishAt) {
    const left = Date.parse(item.canFinishAt) - nowMs;
    if (left > 0) return `còn ${remainingMinutes(left)} phút`;
  }
  const worked = minutesLabel(elapsedMs(item, nowMs));
  return worked === "vừa bắt đầu" ? worked : `đã làm ${worked}`;
}

/** The time on the running chip: minutes, or "hơn 2 giờ" for a run that went on and on. */
export function chipTime(elapsed: number, minMinutes: number): string {
  return isLongRunning(elapsed, minMinutes) ? "hơn 2 giờ" : minutesLabel(elapsed);
}

/** A title short enough for the chip (cut on a word when it can). */
export function shortTitle(title: string, max = 22): string {
  const t = title.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space >= 10 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
