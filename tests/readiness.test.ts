import { describe, expect, it } from "vitest";
import { evaluateReadiness, type ReadinessInput } from "@/lib/readiness";

const healthy: ReadinessInput = {
  envMissing: [],
  dbReachable: true,
  tablesMissing: [],
  bucketsMissing: [],
  signupDisabled: true,
  hostMatchesAppUrl: true,
  familyExists: true,
};

describe("evaluateReadiness", () => {
  it("is ok when everything is set up", () => {
    const r = evaluateReadiness(healthy);
    expect(r.ok).toBe(true);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });

  it("fails when sign-ups are still open", () => {
    const r = evaluateReadiness({ ...healthy, signupDisabled: false });
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.name === "signup_disabled")?.ok).toBe(false);
  });

  it("fails (not passes) when sign-up status is unknown", () => {
    expect(evaluateReadiness({ ...healthy, signupDisabled: null }).ok).toBe(false);
  });

  it("fails when tables are missing and names them", () => {
    const r = evaluateReadiness({ ...healthy, tablesMissing: ["profiles"] });
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.name === "tables")?.hint).toContain("profiles");
  });

  it("only warns for host mismatch and missing family", () => {
    const r = evaluateReadiness({ ...healthy, hostMatchesAppUrl: false, familyExists: false });
    expect(r.ok).toBe(true);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.level)).toEqual(["warn", "warn"]);
  });

  it("fails when env is missing", () => {
    const r = evaluateReadiness({
      ...healthy,
      envMissing: ["FIRST_PARENT_EMAIL"],
      dbReachable: null,
      signupDisabled: null,
    });
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.name === "env")?.hint).toContain("FIRST_PARENT_EMAIL");
  });
});
