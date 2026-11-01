/**
 * Child PIN (parent decision 19/10/2026): 6 digits, set by a parent, usable only on a
 * browser where the child once signed in with the real password. PURE (browser + server).
 */
export const PIN_LENGTH = 6;
export const PIN_MAX_TRIES = 5;
export const PIN_LOCK_MINUTES = 15;
/** httpOnly cookie that marks a remembered browser (random token; only its hash is stored). */
export const PIN_DEVICE_COOKIE = "sl_pin_device";

/** Why a new PIN is not accepted (Vietnamese), or null when it is fine. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "PIN phải gồm đúng 6 chữ số.";
  if (/^(\d)\1{5}$/.test(pin)) return "PIN dễ đoán quá (6 số giống nhau). Chọn số khác.";
  const digits = pin.split("").map(Number);
  const steps = digits.slice(1).map((d, i) => d - (digits[i] ?? 0));
  if (steps.every((x) => x === 1) || steps.every((x) => x === -1)) return "PIN dễ đoán quá (dãy số liền nhau). Chọn số khác.";
  return null;
}

/** Message after a wrong PIN: tries left, or the lock. */
export function wrongPinMessage(tryNumber: number): string {
  const left = PIN_MAX_TRIES - tryNumber;
  return left > 0 ? `PIN chưa đúng. Còn ${left} lần thử.` : `Sai ${PIN_MAX_TRIES} lần. Đợi ${PIN_LOCK_MINUTES} phút rồi thử lại, hoặc nhờ bố mẹ.`;
}

/**
 * True when the session was issued before the parent's last "sign out everywhere".
 * `iat` only has whole seconds, so a login in the same second as the sign-out counts as new
 * (the server's own throw-away session from that second is already signed out).
 */
export function staleAfterRevoke(issuedAtSec: number | null, lastRevokedAt: string | null): boolean {
  if (!lastRevokedAt) return false;
  if (issuedAtSec === null) return true;
  return issuedAtSec < Math.floor(Date.parse(lastRevokedAt) / 1000);
}
