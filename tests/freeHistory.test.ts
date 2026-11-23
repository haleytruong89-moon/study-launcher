import { describe, expect, it } from "vitest";
import type { DayState } from "@/lib/dayState";
import { freeDay, overrideLines } from "@/lib/parent/freeHistory";

const state = (startedAt: string | null, endsAt: string | null, bonusMinutes = 0) =>
  ({ free: { canStart: false, startedAt, endsAt, bonusMinutes } }) as unknown as DayState;

describe("freeDay", () => {
  it("shows the window and the saved break minutes added to the 45'", () => {
    // 22/11 (Sun) 22:58 VN → 23:53 VN = 45' + 10'.
    const d = freeDay("2026-11-22", state("2026-11-22T15:58:00Z", "2026-11-22T16:53:00Z", 10), 45, []);
    expect(d).toEqual({ date: "2026-11-22", label: "CN 22/11", window: "22:58 → 23:53", detail: "45′ + 10′ để dành", overrides: [] });
  });

  it("plain 45' when nothing was saved", () => {
    expect(freeDay("2026-11-23", state("2026-11-23T12:00:00Z", "2026-11-23T12:45:00Z"), 45, []).detail).toBe("45′");
  });

  it("says when midnight cut the free time short", () => {
    // 23:30 VN + 45' → stops 00:00, 15' lost.
    const d = freeDay("2026-11-22", state("2026-11-22T16:30:00Z", "2026-11-22T17:00:00Z"), 45, []);
    expect(d.window).toBe("23:30 → 00:00");
    expect(d.detail).toBe("45′ · dừng lúc 00:00 (mất 15′)");
  });

  it("no free time (or no state) → no window, overrides still listed", () => {
    const d = freeDay("2026-11-22", null, 0, ["21:05 Bố mẹ mở máy đến 22:00"]);
    expect(d.window).toBeNull();
    expect(d.detail).toBeNull();
    expect(d.overrides).toEqual(["21:05 Bố mẹ mở máy đến 22:00"]);
  });
});

describe("overrideLines", () => {
  const rows = [
    { action: "override.extend", payload: { child_id: "an", minutes: 30, until: "2026-11-22T16:30:00Z" }, created_at: "2026-11-22T15:00:00Z" },
    { action: "override.open", payload: { child_id: "an", until: "2026-11-22T15:00:00Z" }, created_at: "2026-11-22T14:05:00Z" },
    { action: "override.open", payload: { child_id: "nguyen" }, created_at: "2026-11-22T14:06:00Z" },
    { action: "override.clear", payload: { child_id: "an" }, created_at: "2026-11-21T14:00:00Z" },
    { action: "override.lock", payload: { child_id: "an" }, created_at: "2026-11-22T16:40:00Z" },
    { action: "something.else", payload: { child_id: "an" }, created_at: "2026-11-22T16:41:00Z" },
  ];
  it("this child, this local day, oldest first", () => {
    expect(overrideLines(rows, "an", "2026-11-22")).toEqual([
      "21:05 Bố mẹ mở máy đến 22:00",
      "22:00 Bố mẹ cộng 30 phút đến 23:30",
      "23:40 Bố mẹ khóa máy",
    ]);
  });
  it("uses the Vietnam day (07:00 UTC+7 boundary)", () => {
    expect(overrideLines(rows, "an", "2026-11-21")).toEqual(["21:00 Bố mẹ đưa máy về bình thường"]);
  });
});
