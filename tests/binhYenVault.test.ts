import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITERATIONS,
  createVault,
  loadEntries,
  loadMeta,
  open,
  saveEntries,
  saveMeta,
  seal,
  unlockVault,
  wipeVault,
  type KeyValueStore,
} from "@/lib/binhYen/vault";

// Spike S2 (docs/BINH_YEN.md Q1–Q3): private text encrypted with the child's own PIN.
const FAST = 1000; // tests use few PBKDF2 rounds; one test measures the real setting
const nguyen = "11111111-1111-4111-8111-111111111111";
const an = "22222222-2222-4222-8222-222222222222";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe("vault", () => {
  it("round trip: the right PIN opens the text, Vietnamese intact", async () => {
    const { meta, key } = await createVault(nguyen, "482916", FAST);
    const entry = await seal(key, nguyen, "Hôm nay bị điểm kém, buồn ghê 😔");
    const again = await unlockVault(meta, nguyen, "482916");
    expect(again).not.toBeNull();
    expect(await open(again!, nguyen, entry)).toBe("Hôm nay bị điểm kém, buồn ghê 😔");
  });

  it("a wrong PIN does not unlock", async () => {
    const { meta } = await createVault(nguyen, "482916", FAST);
    expect(await unlockVault(meta, nguyen, "482917")).toBeNull();
    expect(await unlockVault(meta, nguyen, "12345")).toBeNull();
  });

  it("an entry copied to the sibling does not open, even with the same PIN", async () => {
    const { key } = await createVault(nguyen, "111111", FAST);
    const entry = await seal(key, nguyen, "bí mật");
    expect(await open(key, an, entry)).toBeNull();
    const { meta } = await createVault(nguyen, "111111", FAST);
    expect(await unlockVault(meta, an, "111111")).toBeNull();
  });

  it("a changed byte is detected", async () => {
    const { key } = await createVault(nguyen, "482916", FAST);
    const entry = await seal(key, nguyen, "abc");
    const bytes = atob(entry.ct).split("");
    bytes[0] = String.fromCharCode(bytes[0]!.charCodeAt(0) ^ 1);
    expect(await open(key, nguyen, { ...entry, ct: btoa(bytes.join("")) })).toBeNull();
  });

  it("the same text twice gives different ciphertext (random IV); nothing readable is stored", async () => {
    const store = memoryStore();
    const { meta, key } = await createVault(nguyen, "482916", FAST);
    const a = await seal(key, nguyen, "cùng một câu");
    const b = await seal(key, nguyen, "cùng một câu");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
    saveMeta(store, meta);
    saveEntries(store, nguyen, [a, b]);
    expect([...store.data.values()].join(" ")).not.toContain("cùng");
    expect(loadMeta(store, nguyen)?.childId).toBe(nguyen);
    expect(loadEntries(store, nguyen)).toHaveLength(2);
    expect(loadEntries(store, an)).toEqual([]);
  });

  it("wipe removes the vault and every entry (PIN wiped by a parent / 'Xóa hết của con')", async () => {
    const store = memoryStore();
    const { meta, key } = await createVault(nguyen, "482916", FAST);
    saveMeta(store, meta);
    saveEntries(store, nguyen, [await seal(key, nguyen, "x")]);
    saveEntries(store, an, []);
    wipeVault(store, nguyen);
    expect(loadMeta(store, nguyen)).toBeNull();
    expect(loadEntries(store, nguyen)).toEqual([]);
    expect(store.data.has(`by:v1:${an}:entries`)).toBe(true);
  });

  it("broken storage never throws", () => {
    const store = memoryStore();
    store.setItem(`by:v1:${nguyen}:vault`, "{not json");
    store.setItem(`by:v1:${nguyen}:entries`, "{}");
    expect(loadMeta(store, nguyen)).toBeNull();
    expect(loadEntries(store, nguyen)).toEqual([]);
  });

  it("unlock with the real setting stays under ~2 s (measured for the PR)", async () => {
    const { meta } = await createVault(nguyen, "482916", DEFAULT_ITERATIONS);
    const t0 = performance.now();
    expect(await unlockVault(meta, nguyen, "482916")).not.toBeNull();
    const ms = performance.now() - t0;
    console.log(`PBKDF2 ${DEFAULT_ITERATIONS} rounds unlock: ${Math.round(ms)} ms`);
    expect(ms).toBeLessThan(2000);
  }, 15000);
});
