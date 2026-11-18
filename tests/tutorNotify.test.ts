import { describe, expect, it } from "vitest";
import { tutorCostMessage } from "@/lib/push/messages";
import { parseTutorNotify } from "@/lib/internal/tutorNotify";

const FAMILY = "11111111-1111-4111-8111-111111111111";

describe("tutorCostMessage (D23: the tutor pushes money matters only)", () => {
  it("economy: ~45 USD, Opus paused", () => {
    expect(tutorCostMessage({ kind: "economy" })).toEqual({
      title: "Gia sư AI: đã chi ~45 USD tháng này",
      body: "Tạm ngừng Opus, Sonnet vẫn dạy bình thường · chạm để xem",
      url: "/gia-su/bo-me/bao-cao",
      tag: "tutor-cost",
    });
  });
  it("console_blocked: the API stopped answering", () => {
    expect(tutorCostMessage({ kind: "console_blocked" })).toMatchObject({
      title: "Gia sư AI tạm nghỉ: hết hạn mức tháng",
      body: "Console đã chặn ở 50 USD. Nâng trần trong Console nếu muốn con học tiếp",
    });
  });
  it("burn: rounds the forecast and says nothing is blocked", () => {
    expect(tutorCostMessage({ kind: "burn", forecastUsd: 59.6 }).body).toBe("Dự báo ~60 USD tháng này (trần 50) · chưa chặn gì");
  });
});

describe("parseTutorNotify", () => {
  it("accepts the three kinds", () => {
    expect(parseTutorNotify({ familyId: FAMILY, kind: "economy" })).toEqual({ familyId: FAMILY, kind: "economy" });
    expect(parseTutorNotify({ familyId: FAMILY, kind: "console_blocked" })).toEqual({ familyId: FAMILY, kind: "console_blocked" });
    expect(parseTutorNotify({ familyId: FAMILY, kind: "burn", forecastUsd: 61 })).toEqual({ familyId: FAMILY, kind: "burn", forecastUsd: 61 });
  });
  it("rejects free text, other kinds, bad ids and a burn without forecast", () => {
    expect(parseTutorNotify({ familyId: FAMILY, kind: "economy", title: "x" })).toBeNull();
    expect(parseTutorNotify({ familyId: FAMILY, kind: "custom" })).toBeNull();
    expect(parseTutorNotify({ familyId: "abc", kind: "economy" })).toBeNull();
    expect(parseTutorNotify({ familyId: FAMILY, kind: "burn" })).toBeNull();
    expect(parseTutorNotify({ familyId: FAMILY, kind: "burn", forecastUsd: -1 })).toBeNull();
    expect(parseTutorNotify(null)).toBeNull();
  });
});
