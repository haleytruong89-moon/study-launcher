import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningAttentionRow, LearningCardRow, LearningPendingRulesRow } from "./learning";

export interface LearningRows {
  cards: LearningCardRow[];
  attention: LearningAttentionRow[];
  pendingRules: LearningPendingRulesRow[];
}

const EMPTY: LearningRows = { cards: [], attention: [], pendingRules: [] };

/**
 * L-3: the learning apps' rows for some children on one day (SQL 0021). Read with the caller's
 * own session, so RLS decides (a parent: the family; the attention lines are parents-only).
 * Never fails the page: a read error shows no tile (the rest of "Ngày của con" still works).
 */
export async function loadLearning(db: SupabaseClient, childIds: readonly string[], day: string): Promise<LearningRows> {
  if (childIds.length === 0) return EMPTY;
  try {
    const ids = [...childIds];
    const [cards, attention, rules] = await Promise.all([
      db.from("learning_cards").select("child_id, local_date, source, sessions, minutes, problems, self_solved, saved_for_later, abandoned, pending_review, report_path").in("child_id", ids).eq("local_date", day),
      db.from("learning_attention").select("child_id, local_date, source, slot, body").in("child_id", ids).eq("local_date", day),
      db.from("learning_pending_rules").select("child_id, app, pending").in("child_id", ids),
    ]);
    for (const r of [cards, attention, rules]) if (r.error) console.error("learning read failed", r.error.message);
    return {
      cards: (cards.error ? [] : (cards.data ?? [])) as LearningCardRow[],
      attention: (attention.error ? [] : (attention.data ?? [])) as LearningAttentionRow[],
      pendingRules: (rules.error ? [] : (rules.data ?? [])) as LearningPendingRulesRow[],
    };
  } catch (e) {
    console.error("learning read failed", e instanceof Error ? e.message : e);
    return EMPTY;
  }
}
