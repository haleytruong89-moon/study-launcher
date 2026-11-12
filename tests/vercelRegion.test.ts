import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The Supabase project is in Singapore. Without "regions", Vercel runs the functions in
// Washington DC (iad1) and every database trip crosses the Pacific (12/11/2026: "app chậm").
describe("vercel.json", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as { regions?: string[]; crons?: unknown[] };

  it("runs the functions in Singapore, next to the database", () => {
    expect(config.regions).toEqual(["sin1"]);
  });

  it("keeps the crons", () => {
    expect(config.crons).toEqual([
      { path: "/api/cron/evening", schedule: "0 14 * * *" },
      { path: "/api/cron/health", schedule: "43 11 * * *" },
    ]);
  });
});
