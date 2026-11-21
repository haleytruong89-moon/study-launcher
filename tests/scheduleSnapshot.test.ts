import { describe, expect, it } from "vitest";
import { extraSnapshot, timetableSnapshot } from "@/lib/schedule/snapshot";

describe("audit snapshots (what Khôi phục puts back)", () => {
  it("keeps exactly the restorable fields", () => {
    expect(extraSnapshot({ subject: "Văn", sessions: [{ day: 2, start: "15:30", end: "17:00" }], place: "home", bring: "Vở", note: "", appSlotId: null, active: true })).toEqual({
      subject: "Văn",
      sessions: [{ day: 2, start: "15:30", end: "17:00" }],
      place: "home",
      bring: "Vở",
      note: "",
      app_slot_id: null,
      active: true,
    });
    expect(timetableSnapshot({ validFrom: "2026-11-09", label: "9A13", note: "", periods: [], times: {}, uniform: { pe: "Áo xanh" } })).toEqual({
      valid_from: "2026-11-09",
      label: "9A13",
      note: "",
      periods: [],
      times: {},
      uniform: { pe: "Áo xanh" },
    });
  });
});
