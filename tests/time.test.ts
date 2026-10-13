import { describe, expect, it } from "vitest";
import { isoWeekday, localDate, nextMidnight, startOfLocalDay, weekStart } from "@/lib/time";

describe("localDate (Asia/Ho_Chi_Minh)", () => {
  it("rolls to the next day at 17:00 UTC (= 00:00 VN)", () => {
    expect(localDate(new Date("2026-10-13T16:59:59Z"))).toBe("2026-10-13");
    expect(localDate(new Date("2026-10-13T17:00:00Z"))).toBe("2026-10-14");
  });

  it("handles year boundary", () => {
    expect(localDate(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");
  });
});

describe("startOfLocalDay / nextMidnight", () => {
  it("00:00 VN is 17:00 UTC of the previous day", () => {
    expect(startOfLocalDay("2026-10-14").toISOString()).toBe("2026-10-13T17:00:00.000Z");
  });

  it("nextMidnight is the following 00:00 VN", () => {
    expect(nextMidnight(new Date("2026-10-13T10:00:00Z")).toISOString()).toBe("2026-10-13T17:00:00.000Z");
    // exactly at midnight, the next boundary is a full day later
    expect(nextMidnight(new Date("2026-10-13T17:00:00Z")).toISOString()).toBe("2026-10-14T17:00:00.000Z");
  });
});

describe("weeks start on Monday", () => {
  it("isoWeekday: Monday = 1 ... Sunday = 7", () => {
    expect(isoWeekday("2026-10-12")).toBe(1); // Monday
    expect(isoWeekday("2026-10-18")).toBe(7); // Sunday
  });

  it("weekStart returns the Monday of that week", () => {
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
    expect(weekStart("2026-10-13")).toBe("2026-10-12");
    expect(weekStart("2026-10-18")).toBe("2026-10-12");
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
  });
});
