/**
 * `Server-Timing` header for the polled routes, so a slow answer can be read in the browser's
 * devtools (Network -> Timing). Durations only: no names, ids or any other data of the child.
 *   auth  = who is asking (session / device token)
 *   db    = reading the day (all database trips after auth)
 *   total = the whole handler
 */
export class ServerTimer {
  private readonly t0 = performance.now();
  private marks: [string, number][] = [];
  private last = this.t0;

  /** Records the time since the previous mark (or the start) under `name`. */
  mark(name: "auth" | "db"): void {
    const t = performance.now();
    this.marks.push([name, t - this.last]);
    this.last = t;
  }

  header(): string {
    const parts = [...this.marks, ["total", performance.now() - this.t0] as [string, number]];
    return parts.map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`).join(", ");
  }
}
