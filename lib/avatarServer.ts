import "server-only";
import type { ChildContext } from "@/lib/today/service";

/**
 * Reads the child's own character + icon (as the child: RLS, SELECT only).
 * Before migration 0011 the avatar column does not exist: fall back to the icon alone,
 * so pages keep working with the default character ("Hình tạm").
 */
export async function readAvatar(ctx: ChildContext): Promise<{ avatar: unknown; icon: string | null }> {
  const full = await ctx.db.from("profiles").select("avatar, icon").eq("id", ctx.childId).maybeSingle();
  if (!full.error && full.data) return { avatar: full.data.avatar ?? null, icon: (full.data.icon as string | null) ?? null };
  if (full.error) console.error("avatar.read", full.error.code);
  const iconOnly = await ctx.db.from("profiles").select("icon").eq("id", ctx.childId).maybeSingle();
  return { avatar: null, icon: (iconOnly.data?.icon as string | null | undefined) ?? null };
}
