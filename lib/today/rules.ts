/**
 * Server-side rules for the child's actions (DESIGN section 6). PURE: they look only at the
 * DayState computed from server data and the server clock, never at anything the child's
 * browser claims. Routes call these, then write with service_role only when allowed.
 */
import { MIN_BREAK_MINUTES, type DayState, type TaskView } from "@/lib/dayState";

export type Decision<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const deny = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

export function allItems(state: DayState): TaskView[] {
  return [...state.part1.items, ...state.part2.items];
}

/** A task with a minimum time (supplementary work or skill). Homework has none. */
export function isTimed(item: TaskView): boolean {
  return item.source === "template" && item.minMinutes > 0;
}

/**
 * R8a "Làm thêm": the running extra run of a done template, shown as a running task with no
 * minimum (Xong at once). The task itself stays done; this view is only for the screen and for
 * the rules below (it carries the extra run's id and start time). null when none runs.
 */
export function extraRunView(item: TaskView): TaskView | null {
  if (item.state !== "done" || item.extra === null) return null;
  const { runId, startedAt } = item.extra;
  return { ...item, state: "running", runId, startedAt, canFinishAt: startedAt, doneAt: null, minMinutes: 0, proofCount: 0, early: false };
}

/** R8a: this view is a running "Làm thêm" run (see extraRunView). */
export function isExtraRun(item: TaskView): boolean {
  return item.state === "running" && item.extra !== null && item.extra.runId === item.runId;
}

/** Every running task of today: required runs, then the "Làm thêm" runs (R8a). */
export function runningItems(state: DayState): TaskView[] {
  const items = allItems(state);
  return [...items.filter((i) => i.state === "running"), ...items.map(extraRunView).filter((i): i is TaskView => i !== null)];
}

/** The timed task currently running, if any (at most one at a time). A "Làm thêm" run counts (R8a). */
export function runningTimedTask(state: DayState): TaskView | null {
  return runningItems(state).find((i) => isTimed(i) || isExtraRun(i)) ?? null;
}

/** Whether the pass button should be offered (refused while a parent lock is in effect). */
export function passOffered(state: DayState): boolean {
  // An empty day has its own "Bắt đầu giờ tự do" button: the weekly pass is not spent on it.
  return state.passAvailable && state.status !== "LOCK_OVERRIDE" && !state.free.canStart;
}

/** R1 E8 (07/11/2026): during a break the task buttons pause; "Học tiếp" ends the break. */
export const ON_BREAK_TEXT = "Đang nghỉ — bấm Học tiếp để làm tiếp.";

/** A break that is still running pauses tasks even under a parent lock (no timer then resumes inside the break). */
function onBreak(state: DayState): boolean {
  return state.break.state === "running";
}

/**
 * Start a task: it must be today's, countable and not done; never during the break. Both parts are
 * open (R1). R8a: a done template starts a "Làm thêm" run (`extra`; a second press while it runs
 * returns the running one). Homework that is done cannot be started again.
 */
export function decideStart(
  state: DayState,
  source: "homework" | "template",
  id: string,
): Decision<{ item: TaskView; alreadyRunning: boolean; extra: boolean }> {
  const item = allItems(state).find((i) => i.source === source && i.id === id);
  if (!item) return deny(404, "Không có việc này hôm nay.");
  if (item.state === "placeholder") return deny(409, "App này đang xây, chưa làm được.");
  if (item.state === "done") {
    if (item.source !== "template") return deny(409, "Việc này đã xong rồi.");
    if (item.extra !== null) return { ok: true, value: { item, alreadyRunning: true, extra: true } };
    if (onBreak(state)) return deny(409, ON_BREAK_TEXT);
    // An extra run is timed for "one at a time" (R8a), whatever the task's minimum.
    const other = runningTimedTask(state);
    if (other) return deny(409, `Đang làm “${other.title}” — bấm Xong việc đó trước.`);
    return { ok: true, value: { item, alreadyRunning: false, extra: true } };
  }
  if (onBreak(state)) return deny(409, ON_BREAK_TEXT);
  if (item.state !== "running" && isTimed(item)) {
    // Parent decision 15/10/2026: one timed task at a time, so one wait cannot count twice.
    const other = runningTimedTask(state);
    if (other) return deny(409, `Đang làm “${other.title}” — bấm Xong việc đó trước.`);
  }
  return { ok: true, value: { item, alreadyRunning: item.state === "running", extra: false } };
}

/**
 * Finish a running task. Templates: server time must have reached started_at + minimum
 * (SPEC 2.6: calling earlier is refused and nothing is recorded). Homework: >= 1 proof photo.
 * R8a: a "Làm thêm" run has no minimum (it never changes whether the task is done).
 */
export function decideFinish(state: DayState, runId: string, now: Date): Decision<{ item: TaskView }> {
  const extra = allItems(state).map(extraRunView).find((i) => i?.runId === runId);
  if (extra) return onBreak(state) ? deny(409, ON_BREAK_TEXT) : { ok: true, value: { item: extra } };
  const item = allItems(state).find((i) => i.runId === runId);
  if (!item) return deny(404, "Không tìm thấy lượt làm này.");
  if (item.state === "done") return deny(409, "Việc này đã xong rồi.");
  if (item.state !== "running" || item.canFinishAt === null) return deny(409, "Việc này chưa bắt đầu.");
  if (onBreak(state)) return deny(409, ON_BREAK_TEXT);
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
  if (onBreak(state)) return deny(409, ON_BREAK_TEXT);
  if (item.proofCount >= MAX_PROOFS) return deny(409, `Tối đa ${MAX_PROOFS} ảnh mỗi bài.`);
  return { ok: true, value: { item } };
}

export const MAX_PROOFS = 6;

/** "Nhờ bố mẹ xem trực tiếp": only for a running homework of today (photo not possible). */
export function decideConfirmRequest(state: DayState, runId: string): Decision<{ item: TaskView }> {
  const item = allItems(state).find((i) => i.runId === runId);
  if (!item) return deny(404, "Không tìm thấy lượt làm này.");
  if (!item.requiresProof) return deny(409, "Việc này không cần bố mẹ xác nhận.");
  if (item.state !== "running") return deny(409, "Chỉ nhờ bố mẹ xem khi đang làm bài.");
  if (onBreak(state)) return deny(409, ON_BREAK_TEXT);
  return { ok: true, value: { item } };
}

export type BreakAction = "start" | "end";

/**
 * Break. R8b "ngân hàng giờ nghỉ" (parent decision 08/11/2026): start only when computeDayState says
 * `break.canStart` (bank >= 5', fewer than break_max_per_day breaks, before free time, no timed task
 * running, not under a parent lock / open window); the route then plans the WHOLE bank. Both
 * actions are idempotent: `write: false` = nothing to write (start while a break runs, end when
 * none runs). Before 0014 (`break.legacy`) the old rule applies: once a day, after a part is done.
 */
export function decideBreak(state: DayState, action: BreakAction): Decision<{ write: boolean }> {
  const b = state.break;
  if (action === "end") return { ok: true, value: { write: b.state === "running" } };
  if (b.state === "running") return { ok: true, value: { write: false } };
  if (b.canStart) return { ok: true, value: { write: true } };
  if (b.legacy && (b.state === "done" || b.state === "skipped")) return deny(409, "Hôm nay con đã nghỉ rồi.");
  if (state.status === "LOCK_OVERRIDE") return deny(409, "Bố mẹ đang khóa máy.");
  if (state.free.startedAt !== null) return deny(409, "Hôm nay đã có giờ tự do.");
  if (state.open) return deny(409, "Máy đang mở rồi, không cần nghỉ.");
  if (!b.legacy && b.takenToday >= b.maxPerDay) return deny(409, `Hôm nay con đã nghỉ đủ ${b.maxPerDay} lần.`);
  if (runningTimedTask(state)) return deny(409, "Bấm Xong việc đang làm trước rồi hãy nghỉ.");
  if (b.legacy && !state.part1.complete && !state.part2.complete) return deny(409, "Xong bài tập hoặc xong kỹ năng là được nghỉ.");
  if (!b.legacy && b.bankMinutes < MIN_BREAK_MINUTES) return deny(409, "Chưa đủ giờ tập trung để nghỉ.");
  return deny(409, "Bây giờ chưa nghỉ được.");
}

/** "Bắt đầu giờ tự do" on a day with no task at all (parent decision 07/11/2026). */
export function decideFreeStart(state: DayState): Decision<null> {
  if (state.status === "LOCK_OVERRIDE") return deny(409, "Bố mẹ đang khóa máy.");
  if (!state.free.canStart) return deny(409, "Giờ tự do có khi con xong bài tập và kỹ năng.");
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
  if (state.free.canStart) return deny(409, "Hôm nay không có việc — bấm “Bắt đầu giờ tự do”, không cần dùng thẻ.");
  return { ok: true, value: null };
}

const PROOF_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/;

/** proofs/{family_id}/{child_id}/{local_date}/{uuid}.jpg (DESIGN section 9). */
export function isProofPath(path: string, familyId: string, childId: string, today: string): boolean {
  const prefix = `${familyId}/${childId}/${today}/`;
  return path.startsWith(prefix) && PROOF_FILE_RE.test(path.slice(prefix.length));
}
