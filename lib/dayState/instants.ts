/** Instant helpers of the day state: ISO <-> ms (malformed input throws, rule 16), the VN day start. */

import { startOfLocalDay } from "../time";

export const startOfLocalDayMs = (date: string): number => startOfLocalDay(date).getTime();

export const MINUTE_MS = 60_000;

export function toMs(value: string, field: string): number {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) throw new Error(`computeDayState: invalid instant in ${field}: ${value}`);
  return t;
}

export function toMsOrNull(value: string | null, field: string): number | null {
  return value === null ? null : toMs(value, field);
}

export function iso(ms: number): string {
  return new Date(ms).toISOString();
}
