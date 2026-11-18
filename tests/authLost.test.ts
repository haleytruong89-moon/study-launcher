import { describe, expect, it } from "vitest";
import { decodeLost, encodeLost, hasAuthCookie, lostCode, lostReasonText } from "@/lib/authLost";

describe("why a child's session ended (18/11/2026)", () => {
  it("spots a Supabase session cookie, chunked or not", () => {
    expect(hasAuthCookie(["sb-abcdef-auth-token"])).toBe(true);
    expect(hasAuthCookie(["x", "sb-abcdef-auth-token.0", "sb-abcdef-auth-token.1"])).toBe(true);
    expect(hasAuthCookie(["sl_pin_device", "sb-abcdef-auth-token-code-verifier"])).toBe(false);
    expect(hasAuthCookie([])).toBe(false);
  });

  it("keeps a short, safe code", () => {
    expect(lostCode({ code: "refresh_token_already_used", status: 400 })).toBe("refresh_token_already_used");
    expect(lostCode({ name: "AuthRetryableFetchError" })).toBe("AuthRetryableFetchError");
    expect(lostCode({ code: "<script>x" })).toBe("scriptx");
    expect(lostCode(null)).toBe("unknown");
  });

  it("round-trips the cookie and rejects junk", () => {
    const l = { code: "session_not_found", at: "2026-11-18T01:00:00.000Z", path: "/today" };
    expect(decodeLost(encodeLost(l))).toEqual(l);
    expect(decodeLost(undefined)).toBeNull();
    expect(decodeLost("%7Bbad")).toBeNull();
    expect(decodeLost(encodeURIComponent(JSON.stringify({ code: 1 })))).toBeNull();
  });

  it("explains the common reasons in Vietnamese", () => {
    expect(lostReasonText("refresh_token_already_used")).toBe("phiên bị làm mới 2 lần cùng lúc");
    expect(lostReasonText("session_not_found")).toBe("phiên đã bị hủy");
    expect(lostReasonText("weird")).toBe("weird");
  });
});
