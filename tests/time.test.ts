import { describe, expect, it } from "vitest";
import {
  addDays,
  atLocalTime,
  isoWeekday,
  localDate,
  nextMidnight,
  startOfLocalDay,
  weekStart,
} from "@/lib/time";

describe("addDays", () => {
  it("moves across month and year boundaries", () => {
    expect(addDays("2026-10-13", 1)).toBe("2026-10-14");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-10-13", 0)).toBe("2026-10-13");
    expect(addDays("2026-10-19", -7)).toBe("2026-10-12");
  });
});

describe("atLocalTime", () => {
  it("returns the VN wall-clock instant on that date", () => {
    expect(atLocalTime("2026-10-13", "21:30").toISOString()).toBe("2026-10-13T14:30:00.000Z");
    expect(atLocalTime("2026-10-13", "21:30:15").toISOString()).toBe("2026-10-13T14:30:15.000Z");
    expect(atLocalTime("2026-10-13", "00:00").toISOString()).toBe("2026-10-12T17:00:00.000Z");
  });

  it("rejects malformed times", () => {
    expect(() => atLocalTime("2026-10-13", "9pm")).toThrow();
    expect(() => atLocalTime("2026-10-13", "24:00")).toThrow();
  });
});

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
