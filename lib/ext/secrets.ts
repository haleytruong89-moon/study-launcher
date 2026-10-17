import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Device token handed to the extension once; only its SHA-256 is stored. */
export function newDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 6-digit pairing code (leading zeros kept). */
export function newPairCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Code hash is bound to the child, so a code can never pair a sibling's laptop. */
export function hashPairCode(childId: string, code: string): string {
  return createHash("sha256").update(`${childId}:${code}`).digest("hex");
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Bearer token from an Authorization header, or null. */
export function bearer(request: Request): string | null {
  const h = request.headers.get("authorization") ?? "";
  const m = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(h.trim());
  return m?.[1] ?? null;
}

export const PAIR_CODE_MINUTES = 10;
export const PAIR_CODE_MAX_ATTEMPTS = 5;
