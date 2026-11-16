import { beforeEach, describe, expect, it, vi } from "vitest";

// --- GET /api/sites: child only, the child's OWN session (RLS), never service_role ---

vi.mock("server-only", () => ({}));
const env = vi.hoisted(() => ({ me: null as unknown, tables: [] as string[], rows: {} as Record<string, unknown[]> }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => env.me }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: async () => {
        env.tables.push(table);
        return { data: env.rows[table] ?? [], error: null };
      },
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the sites list must never use service_role");
  },
}));

const { GET } = await import("@/app/api/sites/route");
const child = { userId: "child-1", email: "c@x", profile: { id: "child-1", family_id: "fam-1", role: "child", display_name: "An", grade: 6, color: null } };

describe("GET /api/sites", () => {
  beforeEach(() => {
    env.me = child;
    env.tables = [];
    env.rows = {};
  });

  it("401 when not signed in, 403 for a parent", async () => {
    env.me = null;
    expect((await GET()).status).toBe(401);
    env.me = { ...child, profile: { ...child.profile, role: "parent" } };
    expect((await GET()).status).toBe(403);
    expect(env.tables).toHaveLength(0);
  });

  it("reads app slots and the allowlist with the child's session and groups them", async () => {
    env.rows = { allowlist_entries: [{ domain: "dictionary.cambridge.org", grp: "dictionary", expires_at: null }] };
    const r = await GET();
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(env.tables.sort()).toEqual(["allowlist_entries", "app_slots"]);
    expect(await r.json()).toEqual({ groups: [{ title: "Từ điển, dịch", links: [{ label: "dictionary.cambridge.org", sub: null, href: "https://dictionary.cambridge.org" }] }] });
  });
});
