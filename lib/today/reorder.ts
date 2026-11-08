/** Moves one item (Góc học tập drag ⋮⋮, R6c). Invalid indexes: an unchanged copy. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || to < 0 || from >= out.length || to >= out.length || from === to) return out;
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x as T);
  return out;
}

/**
 * The new order after dropping row `from` on row `to` (R6c). Done rows stay where they are:
 * they cannot be dragged and are not drop targets. null = nothing to save.
 */
export function dropOrder(keys: readonly string[], done: ReadonlySet<string>, from: string, to: string): string[] | null {
  const a = keys.indexOf(from);
  const b = keys.indexOf(to);
  if (a < 0 || b < 0 || a === b || done.has(from) || done.has(to)) return null;
  return reorder(keys, a, b);
}
