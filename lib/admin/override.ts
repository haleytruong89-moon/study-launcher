/**
 * Parent overrides (DESIGN section 6, S3c). PURE: computes the override row from the SERVER
 * clock. The newest override of today wins and expires at `until` (parent decision
 * 14/10/2026); every `until` is clipped at the next 00:00.
 */
import { nextMidnight } from "@/lib/time";

export type OverrideAction = "open" | "lock" | "extend" | "clear";

export interface OverrideRow {
  kind: "open_until" | "lock_until";
  until: string;
}

/** Durations offered on the screen (minutes); null = until the end of today. */
export const OPEN_CHOICES = [15, 30, 60, null] as const;
export const LOCK_CHOICES = [30, 60, null] as const;
export const EXTEND_CHOICES = [15, 30] as const;

const MINUTE = 60_000;

/**
 * - open / lock: from now for `minutes` (null = until 00:00).
 * - extend ("cộng N phút"): a new open_until from max(current openUntil, now) + minutes.
 * - clear ("về bình thường"): a new row that has already expired, so it supersedes the
 *   current override and the normal flow applies (an older override never comes back).
 */
export function overrideRow(
  action: OverrideAction,
  minutes: number | null,
  now: Date,
  current: { openUntil: string | null; overrideActive: boolean },
): { ok: true; row: OverrideRow } | { ok: false; error: string } {
  const midnight = nextMidnight(now).getTime();
  const clip = (ms: number) => new Date(Math.min(ms, midnight)).toISOString();
  const nowMs = now.getTime();
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60)) return { ok: false, error: "Số phút không hợp lệ." };

  switch (action) {
    case "open":
      return { ok: true, row: { kind: "open_until", until: clip(minutes === null ? midnight : nowMs + minutes * MINUTE) } };
    case "lock":
      return { ok: true, row: { kind: "lock_until", until: clip(minutes === null ? midnight : nowMs + minutes * MINUTE) } };
    case "extend": {
      if (minutes === null) return { ok: false, error: "Chọn số phút cộng thêm." };
      const from = Math.max(nowMs, current.openUntil ? new Date(current.openUntil).getTime() : nowMs);
      if (from >= midnight) return { ok: false, error: "Máy đang mở đến hết hôm nay rồi." };
      return { ok: true, row: { kind: "open_until", until: clip(from + minutes * MINUTE) } };
    }
    case "clear":
      if (!current.overrideActive) return { ok: false, error: "Không có lệnh mở/khóa nào đang chạy." };
      return { ok: true, row: { kind: "open_until", until: new Date(nowMs).toISOString() } };
  }
}
