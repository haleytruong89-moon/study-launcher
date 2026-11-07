import { getCurrentUser } from "@/lib/auth";
import { isAvatarPicPath } from "@/lib/avatarPics";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * R3b: streams ONE character picture from the private `avatars` bucket, downloaded with the
 * viewer's own session (storage RLS: anyone in the family). Served from the app's origin, so
 * Góc bình yên (own-origin images only) and a locked laptop can show it.
 */
export async function GET(request: Request) {
  const me = await getCurrentUser();
  if (!me?.profile) return new Response("Bạn chưa đăng nhập.", { status: 401 });

  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!isAvatarPicPath(path, me.profile.family_id)) return new Response("Không tìm thấy ảnh.", { status: 404 });

  const db = await createClient();
  const { data, error } = await db.storage.from("avatars").download(path);
  if (error || !data) return new Response("Không tìm thấy ảnh.", { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": path.endsWith(".png") ? "image/png" : "image/jpeg",
      "Content-Disposition": `inline; filename="nhan-vat.${path.endsWith(".png") ? "png" : "jpg"}"`,
      // Paths are random and never reused (a new picture gets a new path).
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      // Never run as a page, whatever bytes follow the image header.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      Vary: "Cookie",
    },
  });
}
