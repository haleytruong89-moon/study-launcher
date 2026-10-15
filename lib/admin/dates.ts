/** Calendar arithmetic on local dates (YYYY-MM-DD). No time zone involved: dates are already local. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid local date: ${date}`);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
