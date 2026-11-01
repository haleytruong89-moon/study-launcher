/**
 * Góc bình yên — the child's private text, encrypted on the child's own laptop with a key
 * made from the child's own Góc bình yên PIN (docs/BINH_YEN.md D1, Q1–Q3). Spike S2.
 *
 * - Web Crypto only (browser + Node ≥ 20): PBKDF2-SHA256 → AES-GCM-256. No library, no server.
 * - One vault per child per browser: a random salt + a "check" value that tells a wrong PIN
 *   apart from a right one without decrypting any entry. The key is derived ONCE per unlock.
 * - Every entry has its own random IV and is bound to the child id (AES-GCM additional data),
 *   so an entry copied into a sibling's vault does not open.
 * - Honest limit (shown to the child in "Ai thấy gì?"): a 6-digit PIN has 1,000,000 values.
 *   PBKDF2 makes each guess slow (~0.1 s on a server CPU, a little more on a school laptop) so a person cannot just try, but a
 *   determined technical attacker with the browser data could. It stops casual reading.
 * - Forgotten / wiped PIN = the text is gone (wipeVault). There is no recovery by design.
 */

export const VAULT_VERSION = 1;
export const DEFAULT_ITERATIONS = 600_000; // OWASP 2023 guidance for PBKDF2-HMAC-SHA256

export interface VaultMeta {
  v: number;
  childId: string;
  iter: number;
  /** base64 salt (16 bytes) */
  salt: string;
  /** Encrypted constant: decrypts only with the right PIN. */
  check: SealedEntry;
}

export interface SealedEntry {
  /** base64 IV (12 bytes) */
  iv: string;
  /** base64 ciphertext + tag */
  ct: string;
}

const CHECK_TEXT = "goc-binh-yen-check-v1";
const enc = new TextEncoder();
const dec = new TextDecoder();

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("Web Crypto is not available");
  return c.subtle;
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const raw = atob(s);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(n));
  globalThis.crypto.getRandomValues(b);
  return b;
}

const isPin = (pin: string) => /^\d{6}$/.test(pin);

async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Encrypts one text for this child. */
export async function seal(key: CryptoKey, childId: string, text: string): Promise<SealedEntry> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(childId) }, key, enc.encode(text)));
  return { iv: toB64(iv), ct: toB64(ct) };
}

/** Decrypts one entry; null when the key, child or data do not match (never throws). */
export async function open(key: CryptoKey, childId: string, entry: SealedEntry): Promise<string | null> {
  try {
    const plain = await subtle().decrypt({ name: "AES-GCM", iv: fromB64(entry.iv), additionalData: enc.encode(childId) }, key, fromB64(entry.ct));
    return dec.decode(plain);
  } catch {
    return null;
  }
}

/** First time: the child sets a Góc bình yên PIN. Returns the vault description + an unlocked key. */
export async function createVault(childId: string, pin: string, iter = DEFAULT_ITERATIONS): Promise<{ meta: VaultMeta; key: CryptoKey }> {
  if (!isPin(pin)) throw new Error("PIN must be 6 digits");
  const salt = randomBytes(16);
  const key = await deriveKey(pin, salt, iter);
  const check = await seal(key, childId, CHECK_TEXT);
  return { meta: { v: VAULT_VERSION, childId, iter, salt: toB64(salt), check }, key };
}

/** Unlock with the PIN: the key, or null when the PIN is wrong / the vault is for another child. */
export async function unlockVault(meta: VaultMeta, childId: string, pin: string): Promise<CryptoKey | null> {
  if (meta.v !== VAULT_VERSION || meta.childId !== childId || !isPin(pin)) return null;
  const key = await deriveKey(pin, fromB64(meta.salt), meta.iter);
  return (await open(key, childId, meta.check)) === CHECK_TEXT ? key : null;
}

// --- Browser storage (localStorage-compatible), one key per child -----------------------

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const metaKey = (childId: string) => `by:v1:${childId}:vault`;
const entriesKey = (childId: string) => `by:v1:${childId}:entries`;

export function loadMeta(store: KeyValueStore, childId: string): VaultMeta | null {
  try {
    const raw = store.getItem(metaKey(childId));
    return raw ? (JSON.parse(raw) as VaultMeta) : null;
  } catch {
    return null;
  }
}

export function saveMeta(store: KeyValueStore, meta: VaultMeta): void {
  store.setItem(metaKey(meta.childId), JSON.stringify(meta));
}

export function loadEntries(store: KeyValueStore, childId: string): SealedEntry[] {
  try {
    const raw = store.getItem(entriesKey(childId));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as SealedEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveEntries(store: KeyValueStore, childId: string, entries: SealedEntry[]): void {
  store.setItem(entriesKey(childId), JSON.stringify(entries));
}

/** PIN wiped by a parent, or "Xóa hết của con": the vault and every entry are gone. */
export function wipeVault(store: KeyValueStore, childId: string): void {
  store.removeItem(metaKey(childId));
  store.removeItem(entriesKey(childId));
}
