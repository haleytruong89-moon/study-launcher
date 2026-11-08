import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PLAY_IDEAS } from "@/lib/today/playIdeas";
import { PLAY_PLAN_KEY, readPlayPlan, writePlayPlan } from "@/lib/today/playPlan";

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe("play ideas (R6d)", () => {
  it("4 per voice", () => {
    expect(PLAY_IDEAS.detective).toEqual(["Đọc truyện tranh", "Vẽ / cosplay", "Nghe nhạc", "Ra ngoài"]);
    expect(PLAY_IDEAS.scientist).toEqual(["Thí nghiệm nhỏ", "Ngắm sao", "Chơi game", "Đạp xe"]);
  });
});

describe("play plan (this browser only, R6d)", () => {
  const g = globalThis as unknown as { window?: { localStorage: MemStorage } };
  beforeEach(() => {
    g.window = { localStorage: new MemStorage() };
  });
  afterEach(() => {
    delete g.window;
  });

  it("writes, reads, clears", () => {
    writePlayPlan("2026-11-08", "Ngắm sao");
    expect(readPlayPlan("2026-11-08")).toBe("Ngắm sao");
    expect(readPlayPlan("2026-11-07")).toBeNull();
    writePlayPlan("2026-11-08", null);
    expect(readPlayPlan("2026-11-08")).toBeNull();
  });

  it("keeps only the last 31 dates", () => {
    for (let d = 1; d <= 40; d++) writePlayPlan(`2026-10-${String(d).padStart(2, "0")}`, "x");
    const saved = JSON.parse(g.window!.localStorage.getItem(PLAY_PLAN_KEY) as string) as Record<string, string>;
    expect(Object.keys(saved)).toHaveLength(31);
    expect(saved["2026-10-09"]).toBeUndefined();
    expect(saved["2026-10-40"]).toBe("x");
  });

  it("broken storage or no window: null, no throw", () => {
    g.window!.localStorage.setItem(PLAY_PLAN_KEY, "{broken");
    expect(readPlayPlan("2026-11-08")).toBeNull();
    expect(() => writePlayPlan("2026-11-08", "x")).not.toThrow();
    g.window!.localStorage.setItem(PLAY_PLAN_KEY, JSON.stringify(["a"]));
    expect(readPlayPlan("0")).toBeNull();
    g.window!.localStorage.setItem(PLAY_PLAN_KEY, JSON.stringify({ "2026-11-08": 5 }));
    expect(readPlayPlan("2026-11-08")).toBeNull();
    delete g.window;
    expect(readPlayPlan("2026-11-08")).toBeNull();
    expect(() => writePlayPlan("2026-11-08", "x")).not.toThrow();
  });

  it("a storage that throws: null, no throw", () => {
    g.window = {
      localStorage: Object.assign(new MemStorage(), {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      }),
    };
    expect(readPlayPlan("2026-11-08")).toBeNull();
    expect(() => writePlayPlan("2026-11-08", "x")).not.toThrow();
  });
});

describe("parsePlayPlans (R5 comic)", () => {
  it("keeps string plans only; broken JSON or arrays = none", async () => {
    const { parsePlayPlans } = await import("@/lib/today/playPlan");
    expect(parsePlayPlans('{"2026-11-02":"Nghe nhạc","2026-11-03":5}')).toEqual({ "2026-11-02": "Nghe nhạc" });
    expect(parsePlayPlans("{broken")).toEqual({});
    expect(parsePlayPlans("[1]")).toEqual({});
    expect(parsePlayPlans(null)).toEqual({});
  });
});
