/**
 * D2 A5 (parent decision 12/11/2026): "Làm thêm" runs (R8a) in the parent's views. A child may
 * start a done template again; those extra runs never need Đạt / Chưa đạt, so the review page
 * groups them under their task and no "chưa xem" counter counts them. PURE (no I/O): the rule is
 * the day state's own (`splitTemplateRuns`, interpretation 10), applied to task_runs rows.
 */
import { splitTemplateRuns, type TaskRunInput } from "@/lib/dayState";
import { hoursMinutes } from "@/lib/today/week";

/** The task_runs columns this needs (snake_case, as read from the database). */
export interface RunRowLite {
  id: string;
  child_id: string;
  local_date: string;
  source: "homework" | "template";
  template_id: string | null;
  started_at: string | null;
  done_at: string | null;
}

export interface ExtraSummary {
  /** Finished extra runs. */
  count: number;
  /** Their minutes together (rounded once). */
  minutes: number;
}

const groupKey = (r: RunRowLite) => `${r.child_id}|${r.local_date}|${r.template_id}`;

function groups(rows: readonly RunRowLite[]): Map<string, RunRowLite[]> {
  const out = new Map<string, RunRowLite[]>();
  for (const r of rows) {
    if (r.source !== "template" || r.template_id === null) continue; // homework is never "Làm thêm"
    const list = out.get(groupKey(r)) ?? [];
    list.push(r);
    out.set(groupKey(r), list);
  }
  return out;
}

function asInput(r: RunRowLite): TaskRunInput {
  return { id: r.id, localDate: r.local_date, source: "template", homeworkItemId: null, templateId: r.template_id, startedAt: r.started_at, doneAt: r.done_at, proofPaths: [] };
}

/**
 * The extra runs among the rows, and for each required run the summary of its FINISHED extra
 * runs. Pass every finished run of the template that day (the required one included, whatever
 * its verdict), else the required run cannot be found.
 */
export function splitExtraRuns(rows: readonly RunRowLite[]): { extra: Set<string>; byRequired: Map<string, ExtraSummary> } {
  const extra = new Set<string>();
  const byRequired = new Map<string, ExtraSummary>();
  for (const list of groups(rows).values()) {
    const { requiredId, extraIds } = splitTemplateRuns(list.map(asInput));
    for (const id of extraIds) extra.add(id);
    if (requiredId === null) continue;
    let count = 0;
    let ms = 0;
    for (const r of list) {
      if (!extraIds.includes(r.id) || r.done_at === null || r.started_at === null) continue;
      count++;
      ms += Math.max(0, Date.parse(r.done_at) - Date.parse(r.started_at));
    }
    if (count > 0) byRequired.set(requiredId, { count, minutes: Math.round(ms / 60_000) });
  }
  return { extra, byRequired };
}

/** Finished runs still waiting for Đạt / Chưa đạt; "Làm thêm" runs never do. */
export function countUnreviewed(rows: readonly (RunRowLite & { parent_verdict: string | null })[]): number {
  const { extra } = splitExtraRuns(rows);
  return rows.filter((r) => r.done_at !== null && r.parent_verdict === null && !extra.has(r.id)).length;
}

/** "Làm thêm: 2 lần · 1 giờ 5 phút" under the task on the review page. */
export function extraLine(s: ExtraSummary): string {
  return `Làm thêm: ${s.count} lần · ${hoursMinutes(s.minutes)}`;
}
