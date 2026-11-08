import { describe, expect, it } from "vitest";
import { isMonday, resolveWeek, shelfOf, volumeOf } from "@/lib/comic/volume";

describe("volumeOf (R5)", () => {
  it("first week = 1, counts whole weeks", () => {
    expect(volumeOf("2026-10-05", "2026-10-05")).toBe(1);
    expect(volumeOf("2026-10-05", "2026-11-02")).toBe(5);
    expect(volumeOf(null, "2026-11-02")).toBe(1);
    expect(volumeOf("2026-11-09", "2026-11-02")).toBe(1);
  });

  it("across the year end", () => {
    expect(volumeOf("2026-12-28", "2027-01-04")).toBe(2);
  });
});

describe("isMonday (R5 ?week=)", () => {
  it("only real Mondays in YYYY-MM-DD", () => {
    expect(isMonday("2026-11-02")).toBe(true);
    expect(isMonday("2026-11-03")).toBe(false);
    expect(isMonday("2026-11-08")).toBe(false);
    expect(isMonday("2026-02-30")).toBe(false);
    expect(isMonday("2026-11-2")).toBe(false);
    expect(isMonday("2026-11-02T00:00")).toBe(false);
    expect(isMonday("")).toBe(false);
  });
});

describe("shelfOf (R5 Kệ truyện)", () => {
  const first = "2026-08-03";
  const thisMonday = "2026-11-02";

  it("one spine per past week with a record, newest first, this week excluded", () => {
    const s = shelfOf(["2026-10-27", "2026-10-26", "2026-10-30", "2026-11-03", "2026-11-02", "2026-10-12"], first, thisMonday);
    expect(s).toEqual([
      { weekStart: "2026-10-26", volume: 13 },
      { weekStart: "2026-10-12", volume: 11 },
    ]);
  });

  it("keeps at most 12", () => {
    const dates = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 7, 4 + i * 7));
      return d.toISOString().slice(0, 10);
    });
    const s = shelfOf(dates, first, thisMonday);
    // 2026-08-04 … 2026-11-03: 13 past weeks (08-03 … 10-26) + this week.
    expect(s).toHaveLength(12);
    expect(s[0]).toEqual({ weekStart: "2026-10-26", volume: 13 });
    expect(s.map((x) => x.weekStart)).toEqual([...s.map((x) => x.weekStart)].sort().reverse());
    expect(s.at(-1)).toEqual({ weekStart: "2026-08-10", volume: 2 });
  });

  it("no first record: empty shelf", () => {
    expect(shelfOf(["2026-10-27"], null, thisMonday)).toEqual([]);
  });

  it("ignores junk dates and dates before the first record", () => {
    expect(shelfOf(["x", "2026-07-01", "2026-10-28"], first, thisMonday)).toEqual([{ weekStart: "2026-10-26", volume: 13 }]);
  });
});

describe("resolveWeek (R5 ?week= range)", () => {
  it("this week without a param or with this Monday, even with no record", () => {
    expect(resolveWeek(undefined, "2026-11-02", null)).toBe("2026-11-02");
    expect(resolveWeek("2026-11-02", "2026-11-02", null)).toBe("2026-11-02");
  });
  it("past weeks from the first record's week", () => {
    expect(resolveWeek("2026-10-05", "2026-11-02", "2026-10-05")).toBe("2026-10-05");
    expect(resolveWeek("2026-09-28", "2026-11-02", "2026-10-05")).toBeNull();
    expect(resolveWeek("2026-10-26", "2026-11-02", null)).toBeNull();
  });
  it("future weeks are refused", () => {
    expect(resolveWeek("2026-11-09", "2026-11-02", "2026-10-05")).toBeNull();
  });
});
