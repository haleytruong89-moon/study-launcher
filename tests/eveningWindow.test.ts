import { describe, expect, it } from "vitest";
import { inEveningWindow, vnMinuteOfDay } from "@/lib/push/window";

// Parent decision 07/11/2026: the evening reminder never arrives at night (GitHub ran it at 03:34–04:13).
const vn = (hhmm: string, day = "2026-11-07") => new Date(`${day}T${hhmm}:00+07:00`);

describe("evening reminder window (Vietnam time)", () => {
  it("reads the Vietnam clock, not UTC", () => {
    expect(vnMinuteOfDay(new Date("2026-11-07T14:00:00Z"))).toBe(21 * 60);
    expect(vnMinuteOfDay(new Date("2026-11-07T17:30:00Z"))).toBe(30); // 00:30 the next day in Vietnam
  });
  it.each(["20:00", "21:00", "21:45", "21:59", "22:30", "23:00"])("%s → send", (t) => expect(inEveningWindow(vn(t))).toBe(true));
  it.each(["19:59", "23:01", "00:00", "03:34", "04:13", "12:00"])("%s → skip", (t) => expect(inEveningWindow(vn(t))).toBe(false));
  it("the whole Vercel Hobby window (14:00–14:59 UTC) is inside", () => {
    for (let m = 0; m < 60; m++) expect(inEveningWindow(new Date(Date.UTC(2026, 10, 7, 14, m)))).toBe(true);
  });
});
