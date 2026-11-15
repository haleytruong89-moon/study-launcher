import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeDayState, type DayInput } from "@/lib/dayState";

// "Con quên bấm Bắt đầu?" (SQL 0020): the two routes. Child-only / parent-only guards, the daily
// limit, what is written (service_role) and that a pending report is never a run.

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

type Q = { table: string; op: "select" | "insert" | "update"; payload: unknown; filters: string[] };
const calls = vi.hoisted(() => ({ admin: [] as Q[], parent: [] as Q[] }));
type A = (q: Q) => { data?: unknown; error?: { code?: string; message: string } | null };
const answers = vi.hoisted(() => ({ admin: (() => ({ data: null, error: null })) as A, parent: (() => ({ data: null, error: null })) as A }));
const fake = vi.hoisted(() => (log: Q[], answer: (q: Q) => unknown) => ({
  from(table: string) {
    const q: Q = { table, op: "select", payload: null, filters: [] };
    const done = () => (log.push(q), Promise.resolve(answer(q)));
    const b = {
      select: () => b,
      insert: (p: unknown) => ((q.op = "insert"), (q.payload = p), b),
      update: (p: unknown) => ((q.op = "update"), (q.payload = p), b),
      eq: (k: string, v: unknown) => (q.filters.push(`${k}=${String(v)}`), b),
      is: (k: string, v: unknown) => (q.filters.push(`${k} is ${String(v)}`), b),
      order: () => b,
      limit: () => b,
      single: done,
      maybeSingle: done,
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => done().then(res, rej),
    };
    return b;
  },
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake(calls.admin, (q) => answers.admin(q)) }));
const notify = vi.hoisted(() => vi.fn());
vi.mock("@/lib/push/send", () => ({ notifyParents: notify }));
const audit = vi.hoisted(() => vi.fn());

// ---- child side -------------------------------------------------------------------------
const TODAY = "2026-10-14";
const vn = (t: string) => new Date(`${TODAY}T${t}+07:00`);
const SKILL = "33333333-3333-4333-8333-333333333333";
const REPORT = "55555555-5555-4555-8555-555555555555";

function day(): DayInput {
  return {
    settings: { breakMinutes: 10, freeMinutes: 45, extraMinMinutes: 20, skillMinMinutes: 20, passesPerWeek: 1, trustUpPct: 90, trustUpWeeks: 3, trustDownPct: 70, homeworkLookaheadDays: 1, homeworkMinUpcoming: 1 },
    bedtime: "21:30",
    trustMode: "lock",
    sessions: [],
    homework: [],
    templates: [{ id: SKILL, part: "skill", title: "Tiếng Anh", subject: null, appSlotId: null, weekdays: [3], minMinutes: 20, deepLink: null, sort: 0, active: true }],
    appSlots: [],
    runs: [],
    overrides: [],
    breaks: [],
  };
}

const child = vi.hoisted(() => ({ ok: true as boolean, reports: [] as unknown[] | null }));
vi.mock("@/lib/today/service", async () => {
  const { NextResponse } = await import("next/server");
  const jsonError = (message: string, status: number) => NextResponse.json({ error: message }, { status });
  return {
    jsonError,
    requireChild: async () =>
      child.ok ? { ok: true, ctx: { familyId: "fam", childId: "kid", displayName: "An", db: {} } } : { ok: false, response: jsonError("Chỉ tài khoản của con mới dùng được.", 403) },
    readToday: async (_ctx: unknown, now: Date) => ({ state: computeDayState(day(), now), runCapMinutes: 180 }),
    readReports: async () => child.reports,
    todayView: async () => ({ view: "today" }),
    serverError: () => jsonError("Máy chủ đang lỗi, thử lại sau ít phút.", 500),
  };
});

// ---- parent side ------------------------------------------------------------------------
const parent = vi.hoisted(() => ({ ok: true as boolean }));
vi.mock("@/lib/admin/guard", async () => {
  const { NextResponse } = await import("next/server");
  const jsonError = (message: string, status: number) => NextResponse.json({ error: message }, { status });
  return {
    jsonError,
    readJson: (r: Request) => r.json().catch(() => null),
    requireParent: async () =>
      parent.ok
        ? { ok: true, ctx: { userId: "mom", familyId: "fam", db: fake(calls.parent, (q) => answers.parent(q)) } }
        : { ok: false, response: jsonError("Chỉ phụ huynh mới làm được việc này.", 403) },
    writeAudit: audit,
  };
});

const childRoute = await import("@/app/api/tasks/report/route");
const parentRoute = await import("@/app/api/admin/run-reports/[id]/route");

const sendReport = (body: unknown) => childRoute.POST(new Request("http://x/api/tasks/report", { method: "POST", body: JSON.stringify(body) }));
const answer = (id: string, decision: string) =>
  parentRoute.POST(new Request(`http://x/api/admin/run-reports/${id}`, { method: "POST", body: JSON.stringify({ decision }) }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(vn("16:00"));
  calls.admin.length = 0;
  calls.parent.length = 0;
  notify.mockClear();
  audit.mockClear();
  child.ok = true;
  child.reports = [];
  parent.ok = true;
  answers.admin = () => ({ data: null, error: null });
  answers.parent = () => ({ data: null, error: null });
});
afterEach(() => vi.useRealTimers());

describe("POST /api/tasks/report (child)", () => {
  it("only a child", async () => {
    child.ok = false;
    expect((await sendReport({ templateId: SKILL, from: "15:10", to: "15:40" })).status).toBe(403);
    expect(calls.admin).toHaveLength(0);
  });

  it("stores a PENDING report (server times, VN date) and pushes to the parents; never a run", async () => {
    const res = await sendReport({ templateId: SKILL, from: "15:10", to: "15:40" });
    expect(res.status).toBe(200);
    expect(calls.admin).toEqual([
      {
        table: "task_run_reports",
        op: "insert",
        payload: { family_id: "fam", child_id: "kid", local_date: TODAY, template_id: SKILL, started_at: vn("15:10").toISOString(), ended_at: vn("15:40").toISOString() },
        filters: [],
      },
    ]);
    expect(calls.admin.some((q) => q.table === "task_runs")).toBe(false);
    expect(notify).toHaveBeenCalledWith("fam", expect.objectContaining({ title: "An nhờ xác nhận: Tiếng Anh 15:10–15:40 (30 phút)", url: "/parent/requests#quen-bam" }));
  });

  it("refuses a third report of the day and a bad body; nothing is written", async () => {
    const r = (id: string, status: string) => ({ id, templateId: "x", localDate: TODAY, startedAt: vn("10:00").toISOString(), endedAt: vn("10:30").toISOString(), status });
    child.reports = [r("a", "approved"), r("b", "rejected")];
    const third = await sendReport({ templateId: SKILL, from: "15:10", to: "15:40" });
    expect(third.status).toBe(409);
    expect((await third.json()).error).toBe("Hôm nay con đã nhờ đủ 2 lần rồi.");
    child.reports = [];
    expect((await sendReport({ templateId: SKILL, from: "15:10" })).status).toBe(400);
    expect((await sendReport({ templateId: "nope", from: "15:10", to: "15:40" })).status).toBe(400);
    expect((await sendReport({ templateId: SKILL, from: "15:50", to: "16:20" })).status).toBe(409); // after the server clock
    expect(calls.admin).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("before migration 0020: a calm refusal, nothing written", async () => {
    child.reports = null;
    expect((await sendReport({ templateId: SKILL, from: "15:10", to: "15:40" })).status).toBe(409);
    expect(calls.admin).toHaveLength(0);
  });

  it("a double tap (23505 on the one-pending index) answers like success, without a second push", async () => {
    answers.admin = () => ({ data: null, error: { code: "23505", message: "duplicate" } });
    expect((await sendReport({ templateId: SKILL, from: "15:10", to: "15:40" })).status).toBe(200);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/run-reports/[id] (parent)", () => {
  const row = (patch: Record<string, unknown> = {}) => ({
    id: REPORT,
    family_id: "fam",
    child_id: "kid",
    local_date: TODAY,
    template_id: SKILL,
    started_at: vn("15:10").toISOString(),
    ended_at: vn("15:40").toISOString(),
    status: "pending",
    run_id: null,
    ...patch,
  });

  it("only a parent", async () => {
    parent.ok = false;
    expect((await answer(REPORT, "approve")).status).toBe(403);
    expect(calls.admin).toHaveLength(0);
  });

  it("not found / another family / bad input", async () => {
    answers.parent = () => ({ data: null, error: null }); // RLS hides another family's row
    expect((await answer(REPORT, "approve")).status).toBe(404);
    answers.parent = () => ({ data: row({ family_id: "other" }), error: null });
    expect((await answer(REPORT, "approve")).status).toBe(404);
    expect((await answer("not-a-uuid", "approve")).status).toBe(404);
    answers.parent = () => ({ data: row(), error: null });
    expect((await answer(REPORT, "maybe")).status).toBe(400);
    expect(calls.admin).toHaveLength(0);
  });

  it("Đồng ý: claims the pending report, inserts a FINISHED template run of that day, links it, audits", async () => {
    answers.parent = () => ({ data: row(), error: null });
    answers.admin = (q) => (q.table === "task_runs" ? { data: { id: "run-1" }, error: null } : q.op === "update" && (q.payload as { status?: string }).status ? { data: [{ id: REPORT }], error: null } : { data: null, error: null });
    const res = await answer(REPORT, "approve");
    expect(res.status).toBe(200);
    const [claim, insert, link] = calls.admin;
    expect(claim).toMatchObject({ table: "task_run_reports", op: "update", payload: { status: "approved", decided_by: "mom" } });
    expect(claim?.filters).toEqual([`id=${REPORT}`, "family_id=fam", "status=pending"]);
    expect(insert).toMatchObject({
      table: "task_runs",
      op: "insert",
      payload: { family_id: "fam", child_id: "kid", local_date: TODAY, source: "template", template_id: SKILL, started_at: vn("15:10").toISOString(), done_at: vn("15:40").toISOString() },
    });
    expect(link).toMatchObject({ table: "task_run_reports", op: "update", payload: { run_id: "run-1" } });
    expect(audit).toHaveBeenCalledWith(expect.anything(), "run_report.approve", expect.objectContaining({ report_id: REPORT, run_id: "run-1" }));
  });

  it("Không đúng: only the status changes, no run", async () => {
    answers.parent = () => ({ data: row(), error: null });
    answers.admin = () => ({ data: [{ id: REPORT }], error: null });
    expect((await answer(REPORT, "reject")).status).toBe(200);
    expect(calls.admin).toHaveLength(1);
    expect(calls.admin[0]).toMatchObject({ table: "task_run_reports", op: "update", payload: { status: "rejected" } });
    expect(audit).toHaveBeenCalledWith(expect.anything(), "run_report.reject", expect.anything());
  });

  it("idempotent: the same answer again writes nothing; a different answer or another day is refused", async () => {
    answers.parent = () => ({ data: row({ status: "approved", run_id: "run-1" }), error: null });
    expect((await answer(REPORT, "approve")).status).toBe(200);
    expect((await answer(REPORT, "reject")).status).toBe(409);
    answers.parent = () => ({ data: row({ local_date: "2026-10-13" }), error: null });
    expect((await answer(REPORT, "approve")).status).toBe(409);
    expect(calls.admin).toHaveLength(0);
  });

  it("two parents at once: the second claim finds nothing pending and never inserts a second run", async () => {
    let reads = 0;
    answers.parent = () => (reads++ === 0 ? { data: row(), error: null } : { data: { status: "rejected" }, error: null });
    answers.admin = () => ({ data: [], error: null });
    expect((await answer(REPORT, "approve")).status).toBe(409);
    expect(calls.admin.some((q) => q.table === "task_runs")).toBe(false);
  });

  it("run insert fails: the report goes back to pending (nothing counted), 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    answers.parent = () => ({ data: row(), error: null });
    answers.admin = (q) => (q.table === "task_runs" ? { data: null, error: { message: "boom" } } : { data: [{ id: REPORT }], error: null });
    expect((await answer(REPORT, "approve")).status).toBe(500);
    expect(calls.admin.at(-1)).toMatchObject({ table: "task_run_reports", op: "update", payload: { status: "pending", decided_at: null, decided_by: null } });
  });
});
