/**
 * Server-side rules for the child's actions (DESIGN section 6). PURE: they look only at the
 * DayState computed from server data and the server clock, never at anything the child's
 * browser claims. Routes call these, then write with service_role only when allowed.
 */
import type { DayState, TaskView } from "@/lib/dayState";

export type Decision<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const deny = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

export function allItems(state: DayState): TaskView[] {
  return [...state.part1.items, ...state.part2.items];
}

/** A task with a minimum time (supplementary work or skill). Homework has none. */
export function isTimed(item: TaskView): boolean {
  return item.source === "template" && item.minMinutes > 0;
}

/** The timed task currently running, if any (at most one at a time). */
export function runningTimedTask(state: DayState): TaskView | null {
  return allItems(state).find((i) => i.state === "running" && isTimed(i)) ?? null;
}

/** Whether the pass button should be offered (refused while a parent lock is in effect). */
export function passOffered(state: DayState): boolean {
  return state.passAvailable && state.status !== "LOCK_OVERRIDE";
}

/** Start a task: it must be today's, countable, not done, and (Part 2) unlocked. */
export function decideStart(
  state: DayState,
  source: "homework" | "template",
  id: string,
): Decision<{ item: TaskView; alreadyRunning: boolean }> {
  const item = allItems(state).find((i) => i.source === source && i.id === id);
  if (!item) return deny(404, "Không có việc này hôm nay.");
  if (item.state === "placeholder") return deny(409, "App này đang xây, chưa làm được.");
  if (item.state === "done") return deny(409, "Việc này đã xong rồi.");
  if (item.part === 2 && state.part2.locked) return deny(409, "Phần 2 mở sau khi xong Phần 1 và giờ nghỉ.");
  if (item.state !== "running" && isTimed(item)) {
    // Parent decision 15/10/2026: one timed task at a time, so one wait cannot count twice.
    const other = runningTimedTask(state);
    if (other) return deny(409, `Đang làm “${other.title}” — bấm Xong việc đó trước.`);
  }
  return { ok: true, value: { item, alreadyRunning: item.state === "running" } };
}

/**
 * Finish a running task. Templates: server time must have reached started_at + minimum
 * (SPEC 2.6: calling earlier is refused and nothing is recorded). Homework: >= 1 proof photo.
 */
export function decideFinish(state: DayState, runId: string, now: Date): Decision<{ item: TaskView }> {
  const item = allItems(state).find((i) => i.runId === runId);
  if (!item) return deny(404, "Không tìm thấy lượt làm này.");
  if (item.state === "done") return deny(409, "Việc này đã xong rồi.");
  if (item.state !== "running" || item.canFinishAt === null) return deny(409, "Việc này chưa bắt đầu.");
  if (item.requiresProof && item.proofCount < 1) return deny(409, "Chụp ảnh bài đã làm trước khi bấm Xong.");
  const remainingMs = new Date(item.canFinishAt).getTime() - now.getTime();
  if (remainingMs > 0) {
    const min = Math.ceil(remainingMs / 60_000);
    return deny(409, `Chưa đủ thời gian tối thiểu, còn khoảng ${min} phút.`);
  }
  return { ok: true, value: { item } };
}

/** Attach a proof photo: only to a running homework run of today. */
export function decideProof(state: DayState, runId: string): Decision<{ item: TaskView }> {
  const item = allItems(state).find((i) => i.runId === runId);
  if (!item) return deny(404, "Không tìm thấy lượt làm này.");
  if (!item.requiresProof) return deny(409, "Việc này không cần ảnh.");
  if (item.state !== "running") return deny(409, "Chỉ gửi ảnh khi đang làm bài.");
  if (item.proofCount >= MAX_PROOFS) return deny(409, `Tối đa ${MAX_PROOFS} ảnh mỗi bài.`);
  return { ok: true, value: { item } };
}

export const MAX_PROOFS = 6;

export type BreakAction = "start" | "skip" | "end";

/** start / skip only while the break is on offer; end ("Học tiếp") only while it runs. */
export function decideBreak(state: DayState, action: BreakAction): Decision<null> {
  if (action === "end") {
    return state.break.state === "running" ? { ok: true, value: null } : deny(409, "Không có giờ nghỉ đang chạy.");
  }
  if (state.break.state !== "offer") return deny(409, "Giờ nghỉ chỉ có sau khi xong Phần 1, và mỗi ngày 1 lần.");
  return { ok: true, value: null };
}

/**
 * Pass: only when one is left this week and today has no free time yet (DESIGN section 5).
 * Parent decision 15/10/2026: refused (and the button hidden) while a parent LOCK override
 * is in effect, so free time is never spent behind a lock.
 */
export function decidePass(state: DayState): Decision<null> {
  if (state.status === "LOCK_OVERRIDE") return deny(409, "Bố mẹ đang khóa máy, chưa dùng thẻ được.");
  if (!state.passAvailable) return deny(409, "Không còn thẻ miễn tuần này, hoặc hôm nay đã có giờ tự do.");
  return { ok: true, value: null };
}

const PROOF_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/;

/** proofs/{family_id}/{child_id}/{local_date}/{uuid}.jpg (DESIGN section 9). */
export function isProofPath(path: string, familyId: string, childId: string, today: string): boolean {
  const prefix = `${familyId}/${childId}/${today}/`;
  return path.startsWith(prefix) && PROOF_FILE_RE.test(path.slice(prefix.length));
}
