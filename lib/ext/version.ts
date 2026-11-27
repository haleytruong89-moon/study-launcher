/**
 * Extension version reported on each poll (V1, 27/11/2026, SQL 0031 `extension_devices.ext_version`).
 * PURE. Extension 0.4.0 is the first that blocks the family's "Luôn chặn" list while the laptop
 * is open; older laptops are only WARNED about on the parent's Thiết bị page, never locked.
 */

/** First version that blocks the always-block list in the open state. */
export const MIN_ALWAYS_BLOCK_VERSION = "0.4.0";

const SEMVER_RE = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;

/** The header value when it is a plain x.y.z version, else null (nothing is stored). */
export function extVersionFromHeader(value: string | null): string | null {
  const v = value?.trim() ?? "";
  return SEMVER_RE.test(v) ? v : null;
}

/** True when the version is missing, malformed, or lower than `min` (numeric compare). */
export function isOutdatedExtension(version: string | null, min: string = MIN_ALWAYS_BLOCK_VERSION): boolean {
  const a = version ? SEMVER_RE.exec(version.trim()) : null;
  const b = SEMVER_RE.exec(min);
  if (!a || !b) return true;
  for (let i = 1; i <= 3; i++) {
    const x = Number(a[i]);
    const y = Number(b[i]);
    if (x !== y) return x < y;
  }
  return false;
}
