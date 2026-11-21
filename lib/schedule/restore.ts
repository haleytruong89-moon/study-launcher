/**
 * "Khôi phục bản trước" (parent decision 21/11/2026): what restoring one Nhật ký entry of a child's
 * schedule change does. PURE; the route runs it with service_role, scoped to the family.
 *
 * - A timetable version the child CREATED (before = null) is removed: the version that applied
 *   before it applies again. Nothing the family entered earlier is touched.
 * - An edited version gets its previous periods / times / uniform / label / note back.
 * - An extra class the child added is turned off; an edited or turned-off one gets its previous
 *   fields back (including `active`).
 */
export type RestoreStep =
  | { table: "timetables"; op: "delete"; id: string }
  | { table: "timetables"; op: "update"; id: string; values: Record<string, unknown> }
  | { table: "extra_classes"; op: "update"; id: string; values: Record<string, unknown> }
  | { error: string };

export const RESTORABLE = ["schedule.timetable", "schedule.extra.save", "schedule.extra.off"] as const;

const obj = (x: unknown): Record<string, unknown> | null => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
const NO = { error: "Mục này không khôi phục được." };

export function restorePlan(entry: { action: string; payload: unknown }): RestoreStep {
  const p = obj(entry.payload);
  const id = typeof p?.id === "string" ? p.id : null;
  if (!p || !id) return NO;
  const before = p.before === null || p.before === undefined ? null : obj(p.before);
  if (p.before !== null && p.before !== undefined && !before) return NO;
  if (entry.action === "schedule.timetable") {
    if (!before) return { table: "timetables", op: "delete", id };
    const values: Record<string, unknown> = {};
    for (const k of ["label", "note", "periods", "times", "uniform"]) if (k in before) values[k] = before[k];
    return { table: "timetables", op: "update", id, values };
  }
  if (entry.action === "schedule.extra.save" || entry.action === "schedule.extra.off") {
    if (!before) return { table: "extra_classes", op: "update", id, values: { active: false } };
    const values: Record<string, unknown> = {};
    for (const k of ["subject", "sessions", "place", "bring", "note", "app_slot_id", "active"]) if (k in before) values[k] = before[k];
    return { table: "extra_classes", op: "update", id, values };
  }
  return NO;
}
