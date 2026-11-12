import { beforeEach, describe, expect, it, vi } from "vitest";

// B1 (migration 0015): a second unfinished run of the same item is refused by the database
// (23505). POST /api/tasks/start must answer like "already running", never 500.

vi.mock("server-only", () => ({}));

const insertResult = vi.hoisted(() => ({ value: { error: null as null | { code?: string; message: string } } }));
const insert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: (row: unknown) => (insert(row), Promise.resolve(insertResult.value)) }) }),
}));

vi.mock("@/lib/today/rules", () => ({
  decideStart: () => ({ ok: true, value: { item: {}, alreadyRunning: false, extra: false } }),
}));

vi.mock("@/lib/today/service", async () => {
  const { NextResponse } = await import("next/server");
  const jsonError = (message: string, status: number) => NextResponse.json({ error: message }, { status });
  return {
    jsonError,
    requireChild: async () => ({ ok: true, ctx: { familyId: "f", childId: "c" } }),
    readToday: async () => ({ state: { localDate: "2026-11-12" } }),
    todayView: async () => ({ view: "today" }),
    serverError: () => jsonError("Máy chủ đang lỗi, thử lại sau ít phút.", 500),
  };
});

const { POST } = await import("@/app/api/tasks/start/route");

const ID = "11111111-1111-4111-8111-111111111111";
const press = () => POST(new Request("http://x/api/tasks/start", { method: "POST", body: JSON.stringify({ source: "template", id: ID }) }));

describe("POST /api/tasks/start", () => {
  beforeEach(() => {
    insert.mockClear();
    insertResult.value = { error: null };
  });

  it("inserts the run and returns the today view", async () => {
    const res = await press();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ view: "today" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ child_id: "c", local_date: "2026-11-12", template_id: ID, homework_item_id: null }));
  });

  it("treats a unique violation (double tap, second device) as already running", async () => {
    insertResult.value = { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
    const res = await press();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ view: "today" });
  });

  it("still fails on any other database error", async () => {
    insertResult.value = { error: { code: "23503", message: "foreign key" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await press();
    expect(res.status).toBe(500);
  });
});
