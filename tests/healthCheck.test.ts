import { describe, expect, it } from "vitest";
import { healthMessage, problemText, silentDevices, vnDateTime, type DeviceRow } from "@/lib/health/check";

// C2: what the daily self-check reports. Now = Thursday 2026-11-12 18:43 Vietnam time.
const NOW = new Date("2026-11-12T11:43:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();
const NAMES = new Map([
  ["an", "An"],
  ["nguyen", "Nguyên"],
]);
const device = (id: string, child: string, lastSeen: string | null, patch: Partial<DeviceRow> = {}): DeviceRow => ({
  id,
  family_id: "f1",
  child_id: child,
  label: "Laptop",
  last_seen_at: lastSeen,
  created_at: hoursAgo(24 * 30),
  ...patch,
});

describe("silentDevices", () => {
  it("a laptop silent for > 48 h while its child worked is reported", () => {
    const p = silentDevices([device("d1", "an", hoursAgo(50))], [{ child_id: "an", started_at: hoursAgo(3) }], NAMES, NOW);
    expect(p).toEqual([{ kind: "device_silent", familyId: "f1", deviceId: "d1", childName: "An", since: hoursAgo(50), neverSeen: false }]);
    expect(problemText(p[0]!)).toBe("Laptop của An chưa báo về từ 10/11 16:43 — extension có thể bị tắt");
  });

  it("silent but no work in those 48 h (laptop simply off) → nothing", () => {
    expect(silentDevices([device("d1", "an", hoursAgo(50))], [{ child_id: "an", started_at: hoursAgo(49) }], NAMES, NOW)).toEqual([]);
    expect(silentDevices([device("d1", "an", hoursAgo(50))], [{ child_id: "nguyen", started_at: hoursAgo(2) }], NAMES, NOW)).toEqual([]);
    expect(silentDevices([device("d1", "an", hoursAgo(50))], [{ child_id: "an", started_at: null }], NAMES, NOW)).toEqual([]);
  });

  it("an old row left by re-pairing stays quiet when the child's other laptop reports", () => {
    const devs = [device("old", "an", hoursAgo(200)), device("new", "an", hoursAgo(1))];
    expect(silentDevices(devs, [{ child_id: "an", started_at: hoursAgo(3) }], NAMES, NOW)).toEqual([]);
  });

  it("seen within 48 h → nothing", () => {
    expect(silentDevices([device("d1", "an", hoursAgo(47))], [{ child_id: "an", started_at: hoursAgo(1) }], NAMES, NOW)).toEqual([]);
  });

  it("never seen since pairing (> 48 h ago) is reported with its own words; a fresh pairing is not", () => {
    const p = silentDevices([device("d1", "nguyen", null, { created_at: hoursAgo(72) }), device("d2", "nguyen", null, { created_at: hoursAgo(2) })], [{ child_id: "nguyen", started_at: hoursAgo(5) }], NAMES, NOW);
    expect(p.map((x) => x.deviceId)).toEqual(["d1"]);
    expect(problemText(p[0]!)).toBe("Laptop của Nguyên chưa báo về lần nào từ khi ghép (09/11 18:43) — extension có thể bị tắt");
  });
});

describe("healthMessage", () => {
  it("silent (null) when nothing is wrong", () => {
    expect(healthMessage([])).toBeNull();
  });

  it("one push, the first problem plus how many more", () => {
    const p = silentDevices(
      [device("d1", "an", hoursAgo(50)), device("d2", "nguyen", hoursAgo(60))],
      [
        { child_id: "an", started_at: hoursAgo(3) },
        { child_id: "nguyen", started_at: hoursAgo(3) },
      ],
      NAMES,
      NOW,
    );
    expect(healthMessage(p)).toEqual({
      title: "Study Launcher tự kiểm tra: cần bố mẹ xem",
      body: "Laptop của An chưa báo về từ 10/11 16:43 — extension có thể bị tắt · và 1 việc khác · chạm để xem",
      url: "/parent/devices",
      tag: "health",
    });
    expect(healthMessage(p.slice(0, 1))?.body).toBe("Laptop của An chưa báo về từ 10/11 16:43 — extension có thể bị tắt · chạm để xem");
  });

  it("dates are Vietnam time", () => {
    expect(vnDateTime("2026-11-11T17:30:00Z")).toBe("12/11 00:30");
  });
});
