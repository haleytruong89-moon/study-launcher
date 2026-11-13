/**
 * A fake Supabase client that answers every query from fixtures and measures ROUND-TRIP DEPTH:
 * a query's depth is 1 + the deepest query that had already finished when it started. Queries
 * started together (Promise.all) share a depth; a query that waits for another is one deeper.
 * The deepest value is the number of sequential trips to the database for one request.
 */

export type FakeError = { code?: string; message: string };
export interface FakeQuery {
  table: string;
  op: "select" | "update" | "upsert" | "insert";
  columns: string;
  filters: string[];
  single: boolean;
  maybeSingle: boolean;
}
/** Return `{ error }` to fail the query, otherwise the rows (array) or the row (object / null). */
export type Answer = (q: FakeQuery) => { data?: unknown; error?: FakeError } | undefined;

export class Tracker {
  log: { what: string; depth: number }[] = [];
  private finished = 0;

  start(what: string): () => void {
    const depth = this.finished + 1;
    this.log.push({ what, depth });
    return () => {
      this.finished = Math.max(this.finished, depth);
    };
  }

  get depth(): number {
    return this.log.reduce((m, l) => Math.max(m, l.depth), 0);
  }
}

class Builder {
  private q: FakeQuery;
  constructor(
    table: string,
    private tracker: Tracker,
    private answer: Answer,
  ) {
    this.q = { table, op: "select", columns: "", filters: [], single: false, maybeSingle: false };
  }
  select(columns = "*") {
    if (this.q.op === "select") this.q.columns = columns;
    return this;
  }
  update() {
    this.q.op = "update";
    return this;
  }
  upsert() {
    this.q.op = "upsert";
    return this;
  }
  insert() {
    this.q.op = "insert";
    return this;
  }
  single() {
    this.q.single = true;
    return this;
  }
  maybeSingle() {
    this.q.maybeSingle = true;
    return this;
  }
  private filter(name: string, args: unknown[]) {
    this.q.filters.push(`${name}(${args.map(String).join(",")})`);
    return this;
  }
  eq(...a: unknown[]) {
    return this.filter("eq", a);
  }
  neq(...a: unknown[]) {
    return this.filter("neq", a);
  }
  gte(...a: unknown[]) {
    return this.filter("gte", a);
  }
  lte(...a: unknown[]) {
    return this.filter("lte", a);
  }
  lt(...a: unknown[]) {
    return this.filter("lt", a);
  }
  is(...a: unknown[]) {
    return this.filter("is", a);
  }
  in(...a: unknown[]) {
    return this.filter("in", a);
  }
  or(...a: unknown[]) {
    return this.filter("or", a);
  }
  not(...a: unknown[]) {
    return this.filter("not", a);
  }
  order(...a: unknown[]) {
    return this.filter("order", a);
  }
  limit(...a: unknown[]) {
    return this.filter("limit", a);
  }
  then<R1, R2>(ok: (v: { data: unknown; error: FakeError | null; count?: number }) => R1, bad?: (e: unknown) => R2) {
    const done = this.tracker.start(`${this.q.op} ${this.q.table} [${this.q.columns}]`);
    const a = this.answer(this.q) ?? {};
    let data: unknown = a.error ? null : (a.data ?? (this.q.single || this.q.maybeSingle ? null : []));
    if (!a.error && (this.q.single || this.q.maybeSingle) && Array.isArray(data)) data = data[0] ?? null;
    const error = a.error ?? (this.q.single && data === null ? { code: "PGRST116", message: "no rows" } : null);
    return new Promise<{ data: unknown; error: FakeError | null }>((resolve) =>
      setImmediate(() => {
        done();
        resolve({ data: error ? null : data, error });
      }),
    ).then(ok, bad);
  }
}

export function fakeClient(tracker: Tracker, answer: Answer, userId = "child-1") {
  return {
    from: (table: string) => new Builder(table, tracker, answer),
    auth: {
      getUser: () => {
        const done = tracker.start("auth.getUser");
        return new Promise((resolve) =>
          setImmediate(() => {
            done();
            resolve({ data: { user: { id: userId, email: "x@study-launcher.local" } }, error: null });
          }),
        );
      },
    },
  };
}
