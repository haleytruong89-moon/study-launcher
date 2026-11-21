import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- POST /api/internal/tutor-notify: server-to-server, secret, 3 fixed money messages (D23) ---

vi.mock("server-only", () => ({}));
const sent = vi.hoisted(() => ({ calls: [] as { familyId: string; title: string }[] }));
vi.mock("@/lib/push/send", () => ({
  notifyParents: async (familyId: string, m: { title: string }) => {
    sent.calls.push({ familyId, title: m.title });
    return { sent: 2, removed: 0, failed: 0 };
  },
}));

const { POST } = await import("@/app/api/internal/tutor-notify/route");
const FAMILY = "11111111-1111-4111-8111-111111111111";
const req = (body: unknown, auth?: string) =>
  new Request("http://x/api/internal/tutor-notify", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });

describe("POST /api/internal/tutor-notify", () => {
  beforeEach(() => {
    sent.calls = [];
    vi.stubEnv("TUTOR_NOTIFY_SECRET", "s3cret");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("no secret configured → 503, nothing sent", async () => {
    vi.stubEnv("TUTOR_NOTIFY_SECRET", "");
    expect((await POST(req({ familyId: FAMILY, kind: "economy" }, "Bearer s3cret"))).status).toBe(503);
    expect(sent.calls).toEqual([]);
  });
  it("wrong or missing secret → 401", async () => {
    expect((await POST(req({ familyId: FAMILY, kind: "economy" }, "Bearer nope"))).status).toBe(401);
    expect((await POST(req({ familyId: FAMILY, kind: "economy" }))).status).toBe(401);
    expect(sent.calls).toEqual([]);
  });
  it("bad body → 400", async () => {
    expect((await POST(req({ familyId: FAMILY, kind: "custom", title: "hi" }, "Bearer s3cret"))).status).toBe(400);
    expect(sent.calls).toEqual([]);
  });
  it("valid → pushes the fixed message to the family's parents", async () => {
    const res = await POST(req({ familyId: FAMILY, kind: "burn", forecastUsd: 60 }, "Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 2 });
    expect(sent.calls).toEqual([{ familyId: FAMILY, title: "Gia sư AI: tốc độ chi đang vượt trần" }]);
  });
});
