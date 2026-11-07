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

export interface LoadedPics {
  pics: AvatarPics;
  /** The value exactly as stored: a save only goes through if nobody changed it in between. */
  raw: unknown;
}

/** The child's pictures as stored (service_role; the caller has already checked who may ask). */
export async function loadPics(familyId: string, childId: string): Promise<({ ok: true } & LoadedPics) | { ok: false; notReady: boolean }> {
  const { data, error } = await createAdminClient().from("profiles").select("avatar_pics").eq("id", childId).eq("family_id", familyId).eq("role", "child").maybeSingle();
  if (error) return { ok: false, notReady: error.code === "42703" };
  if (!data) return { ok: false, notReady: false };
  return { ok: true, pics: parsePics(data.avatar_pics, familyId, childId), raw: data.avatar_pics ?? null };
}

/** Another save (a second tab or device) got there first: nothing was changed. */
export const BUSY_TEXT = "Ảnh vừa được đổi ở chỗ khác. Tải lại trang rồi thử lại nhé.";

/**
 * Saves the map ONLY if it is still what was read (compare-and-set), then deletes every file in
 * the child's folder that the saved map does not use (replaced, removed, or left by a failed
 * request). false = someone else saved in between; nothing changed.
 */
export async function savePics(familyId: string, childId: string, before: LoadedPics, after: AvatarPics): Promise<boolean> {
  const value = PIC_SLOTS.some((s) => after[s]) ? after : null;
  let q = createAdminClient().from("profiles").update({ avatar_pics: value }).eq("id", childId).eq("family_id", familyId).eq("role", "child");
  q = before.raw === null ? q.is("avatar_pics", null) : q.eq("avatar_pics", JSON.stringify(before.raw));
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  if ((data ?? []).length === 0) return false;
  await sweep(familyId, childId, after);
  return true;
}

/** Best effort: a leftover file is harmless (private, family-only) and goes at the next save. */
async function sweep(familyId: string, childId: string, keep: AvatarPics): Promise<void> {
  const folder = `${familyId}/${childId}`;
  const storage = createAdminClient().storage.from("avatars");
  const { data, error } = await storage.list(folder, { limit: 100 });
  if (error) return console.error("avatar.pics.list", error.message);
  const used = new Set(Object.values(keep));
  const gone = (data ?? []).map((o) => `${folder}/${o.name}`).filter((p) => !used.has(p));
  if (gone.length === 0) return;
  const removed = await storage.remove(gone);
  if (removed.error) console.error("avatar.pics.remove", removed.error.message);
}

/** Removes some faces (or all). false = changed elsewhere in between (nothing done). */
export async function removePics(familyId: string, childId: string, before: LoadedPics, slots: readonly Expression[]): Promise<AvatarPics | null> {
  const after: AvatarPics = { ...before.pics };
  for (const s of slots) delete after[s];
  return (await savePics(familyId, childId, before, after)) ? after : null;
}
