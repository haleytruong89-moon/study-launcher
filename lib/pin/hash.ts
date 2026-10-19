import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pin: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LEN = 32;

/** "scrypt$<salt b64>$<hash b64>": a slow, salted hash (never the PIN in clear). */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pin, salt, KEY_LEN);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  const [kind, salt, hash] = (stored ?? "").split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scryptAsync(pin, Buffer.from(salt, "base64"), expected.length || KEY_LEN);
  return key.length === expected.length && timingSafeEqual(key, expected);
}
