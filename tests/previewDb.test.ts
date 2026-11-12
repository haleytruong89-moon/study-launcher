import { describe, expect, it } from "vitest";
import {
  SEED,
  checkPreviewTarget,
  isTestEmail,
  refFromApiUrl,
  refFromDbUrl,
  refFromJwtKey,
  vnDate,
} from "../scripts/preview-db/lib.mjs";

// Fake 20-letter refs; same cases as scripts/preview-db/test-guard.sh (bash side).
const PROD = "prodrefprodrefprodre";
const PREV = "previewrefpreviewref";
const OTHER = "otherrefotherrefothe";
const pooler = (ref: string) => `postgresql://postgres.${ref}:S3cret%40pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`;
const direct = (ref: string) => `postgresql://postgres:S3cret%40pw@db.${ref}.supabase.co:5432/postgres`;
const jwt = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;

describe("refFromDbUrl", () => {
  it("reads the ref from pooler and direct URLs", () => {
    expect(refFromDbUrl(pooler(PREV))).toBe(PREV);
    expect(refFromDbUrl(direct(PREV))).toBe(PREV);
    expect(refFromDbUrl(`postgres://postgres.${PREV}:pw@aws-0-x.pooler.supabase.com:6543/postgres?sslmode=require`)).toBe(PREV);
  });
  it("refuses anything that is not clearly one Supabase project", () => {
    expect(refFromDbUrl("postgresql://postgres:pw@localhost:5432/postgres")).toBeNull();
    expect(refFromDbUrl("postgresql://postgres:pw@aws-0-x.pooler.supabase.com:5432/postgres")).toBeNull();
    expect(refFromDbUrl(`postgresql://postgres.${OTHER}:pw@db.${PREV}.supabase.co:5432/postgres`)).toBeNull();
    expect(refFromDbUrl(`https://${PREV}.supabase.co`)).toBeNull();
    expect(refFromDbUrl(undefined)).toBeNull();
  });
});

describe("refFromApiUrl / refFromJwtKey", () => {
  it("reads refs", () => {
    expect(refFromApiUrl(`https://${PROD}.supabase.co`)).toBe(PROD);
    expect(refFromApiUrl("https://example.com")).toBeNull();
    expect(refFromJwtKey(jwt({ ref: PREV, role: "service_role" }))).toBe(PREV);
    expect(refFromJwtKey("sb_secret_abc")).toBeNull();
    expect(refFromJwtKey("a.%%%.c")).toBeNull();
  });
});

describe("checkPreviewTarget", () => {
  const key = jwt({ ref: PREV, role: "service_role" });
  it("accepts a preview project and builds its API URL", () => {
    expect(checkPreviewTarget({ previewDbUrl: pooler(PREV), productionRef: PROD, serviceKey: key })).toEqual({
      ok: true,
      ref: PREV,
      apiUrl: `https://${PREV}.supabase.co`,
    });
    expect(checkPreviewTarget({ previewDbUrl: pooler(PREV), productionRef: PROD, serviceKey: "sb_secret_x" }).ok).toBe(true);
  });
  it("refuses production, a missing / malformed production ref, and a key of another project", () => {
    expect(checkPreviewTarget({ previewDbUrl: pooler(PROD), productionRef: PROD, serviceKey: key }).ok).toBe(false);
    expect(checkPreviewTarget({ previewDbUrl: direct(PROD), productionRef: PROD, serviceKey: key }).ok).toBe(false);
    expect(
      checkPreviewTarget({
        previewDbUrl: `postgresql://postgres.${PREV}:x${PROD}x@aws-0-x.pooler.supabase.com:5432/postgres`,
        productionRef: PROD,
        serviceKey: key,
      }).ok,
    ).toBe(false);
    expect(checkPreviewTarget({ previewDbUrl: pooler(PREV), productionRef: "", serviceKey: key }).ok).toBe(false);
    expect(checkPreviewTarget({ previewDbUrl: pooler(PREV), productionRef: "PROD", serviceKey: key }).ok).toBe(false);
    expect(checkPreviewTarget({ previewDbUrl: pooler(PREV), productionRef: PROD, serviceKey: jwt({ ref: PROD }) }).ok).toBe(false);
    expect(checkPreviewTarget({ previewDbUrl: pooler(PREV), productionRef: PROD }).ok).toBe(false);
    expect(checkPreviewTarget({ productionRef: PROD, serviceKey: key }).ok).toBe(false);
  });
  it("accepts a loopback API only (CI test of the local Supabase stack)", () => {
    expect(checkPreviewTarget({ localApiUrl: "http://127.0.0.1:54321", serviceKey: "k" })).toEqual({
      ok: true,
      ref: "local",
      apiUrl: "http://127.0.0.1:54321",
    });
    expect(checkPreviewTarget({ localApiUrl: `https://${PROD}.supabase.co`, serviceKey: "k" }).ok).toBe(false);
    expect(checkPreviewTarget({ localApiUrl: "http://127.0.0.1.evil.org:54321", serviceKey: "k" }).ok).toBe(false);
    expect(checkPreviewTarget({ localApiUrl: "http://127.0.0.1:54321" }).ok).toBe(false);
  });
  it("never puts the URL or key in a refusal reason", () => {
    const r = checkPreviewTarget({ previewDbUrl: pooler(PROD), productionRef: PROD, serviceKey: key });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).not.toContain("S3cret");
      expect(r.reason).not.toContain(PROD);
    }
  });
});

describe("isTestEmail + seed data", () => {
  it("only example.com and study-launcher.local count as test accounts", () => {
    expect(isTestEmail("phu-huynh-thu@example.com")).toBe(true);
    expect(isTestEmail("Con-A@Study-Launcher.Local")).toBe(true);
    expect(isTestEmail("someone@gmail.com")).toBe(false);
    expect(isTestEmail("x@example.com.evil.org")).toBe(false);
    expect(isTestEmail(null)).toBe(false);
    expect(isTestEmail("@example.com")).toBe(false);
  });
  it("seeds only fake people whose accounts pass the test-account rule", () => {
    expect(isTestEmail(SEED.parent.email)).toBe(true);
    expect(SEED.children.map((c) => c.displayName)).toEqual(["Con A", "Con B"]);
    for (const c of SEED.children) {
      expect(isTestEmail(c.email)).toBe(true);
      expect(c.templates.every((t) => t.min_minutes >= 20)).toBe(true);
    }
  });
  it("dates homework in Vietnam time", () => {
    // 2026-11-12 18:30 UTC = 2026-11-13 01:30 in Vietnam
    expect(vnDate(new Date("2026-11-12T18:30:00Z"))).toBe("2026-11-13");
    expect(vnDate(new Date("2026-11-12T18:30:00Z"), 1)).toBe("2026-11-14");
  });
});
