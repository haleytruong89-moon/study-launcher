import { describe, expect, it } from "vitest";
import { extVersionFromHeader, isOutdatedExtension } from "@/lib/ext/version";

describe("extension version (V1)", () => {
  it("0.4.0 and later are current; older, missing or malformed are outdated", () => {
    expect(isOutdatedExtension("0.4.0")).toBe(false);
    expect(isOutdatedExtension("0.10.1")).toBe(false);
    expect(isOutdatedExtension("1.0.0")).toBe(false);
    expect(isOutdatedExtension("0.3.5")).toBe(true);
    expect(isOutdatedExtension(null)).toBe(true);
    expect(isOutdatedExtension("abc")).toBe(true);
    expect(isOutdatedExtension("0.4")).toBe(true);
  });

  it("only a plain x.y.z header is stored", () => {
    expect(extVersionFromHeader("0.4.0")).toBe("0.4.0");
    expect(extVersionFromHeader(" 0.4.1 ")).toBe("0.4.1");
    expect(extVersionFromHeader(null)).toBeNull();
    expect(extVersionFromHeader("0.4.0; drop table")).toBeNull();
    expect(extVersionFromHeader("")).toBeNull();
  });
});
