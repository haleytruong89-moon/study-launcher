import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TemplateInput } from "@/lib/admin/schemas";
import { isFamilyChild } from "@/lib/admin/guard";

/**
 * The child must be a child of this family and the slot (if any) must be this family's and
 * apply to that child. RLS limits both lookups to the parent's family.
 * Returns a Vietnamese error message, or null when everything checks out.
 */
export async function checkTemplateRefs(db: SupabaseClient, t: TemplateInput): Promise<string | null> {
  if (!(await isFamilyChild(db, t.childId))) return "Không tìm thấy tài khoản con.";
  if (t.appSlotId) {
    const { data: slot } = await db.from("app_slots").select("id, child_id").eq("id", t.appSlotId).maybeSingle();
    if (!slot) return "Không tìm thấy app môn học.";
    if (slot.child_id !== null && slot.child_id !== t.childId) return "App này dành cho con khác.";
  }
  return null;
}
