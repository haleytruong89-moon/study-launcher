import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Expression } from "@/lib/avatar";
import { PIC_SLOTS, parsePics, type AvatarPics } from "@/lib/avatarPics";
import type { ChildContext } from "@/lib/today/service";

export interface StoredLook {
  avatar: unknown;
  pics: AvatarPics;
  icon: string | null;
}

/**
 * Reads the child's own character, Picrew pictures and icon (as the child: RLS, SELECT only).
 * Before migrations 0011 / 0012 a column does not exist yet: fall back step by step, so pages
 * keep working with the default character ("Hình tạm").
 */
export async function readAvatar(ctx: ChildContext): Promise<StoredLook> {
  const full = await ctx.db.from("profiles").select("avatar, avatar_pics, icon").eq("id", ctx.childId).maybeSingle();
  if (!full.error && full.data) {
    return { avatar: full.data.avatar ?? null, pics: parsePics(full.data.avatar_pics, ctx.familyId, ctx.childId), icon: (full.data.icon as string | null) ?? null };
  }
  if (full.error) console.error("avatar.read", full.error.code);
  const noPics = await ctx.db.from("profiles").select("avatar, icon").eq("id", ctx.childId).maybeSingle();
  if (!noPics.error && noPics.data) return { avatar: noPics.data.avatar ?? null, pics: {}, icon: (noPics.data.icon as string | null) ?? null };
  const iconOnly = await ctx.db.from("profiles").select("icon").eq("id", ctx.childId).maybeSingle();
  return { avatar: null, pics: {}, icon: (iconOnly.data?.icon as string | null | undefined) ?? null };
}

/** Postgres "column does not exist" / storage "bucket not found": the migration has not run yet. */
export const NOT_READY_TEXT = "Tải ảnh sẽ chạy sau khi bố mẹ cập nhật app. Con cứ dùng nhân vật tự tạo trước nhé.";

/** The child's pictures as stored (service_role; the caller has already checked who may ask). */
export async function loadPics(familyId: string, childId: string): Promise<{ ok: true; pics: AvatarPics } | { ok: false; notReady: boolean }> {
  const { data, error } = await createAdminClient().from("profiles").select("avatar_pics").eq("id", childId).eq("family_id", familyId).eq("role", "child").maybeSingle();
  if (error) return { ok: false, notReady: error.code === "42703" };
  if (!data) return { ok: false, notReady: false };
  return { ok: true, pics: parsePics(data.avatar_pics, familyId, childId) };
}

export async function savePics(familyId: string, childId: string, pics: AvatarPics): Promise<void> {
  const value = PIC_SLOTS.some((s) => pics[s]) ? pics : null;
  const { error } = await createAdminClient().from("profiles").update({ avatar_pics: value }).eq("id", childId).eq("family_id", familyId).eq("role", "child");
  if (error) throw new Error(error.message);
}

/** Deletes files no face uses any more. Best effort: a leftover file is harmless (private, family-only). */
export async function deleteUnused(before: AvatarPics, after: AvatarPics): Promise<void> {
  const keep = new Set(Object.values(after));
  const gone = [...new Set(Object.values(before))].filter((p): p is string => !!p && !keep.has(p));
  if (gone.length === 0) return;
  const { error } = await createAdminClient().storage.from("avatars").remove(gone);
  if (error) console.error("avatar.pics.remove", error.message);
}

/** Removes some faces (or all): row first, then the files. */
export async function removePics(familyId: string, childId: string, before: AvatarPics, slots: readonly Expression[]): Promise<AvatarPics> {
  const after: AvatarPics = { ...before };
  for (const s of slots) delete after[s];
  await savePics(familyId, childId, after);
  await deleteUnused(before, after);
  return after;
}
