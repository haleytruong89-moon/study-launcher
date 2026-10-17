import { getCurrentUser } from "@/lib/auth";
import { fileKind, mimeOf } from "@/lib/files";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Streams ONE homework attachment from the private `homework` bucket, downloaded with the
 * viewer's own session (storage RLS: parents read their family, a child reads only their
 * own folder). Served from the app's origin so a locked laptop can open PDFs and photos
 * without allowing the storage domain in the extension. Word/Excel are downloaded.
 */
export async function GET(request: Request) {
  const me = await getCurrentUser();
  if (!me?.profile) return new Response("Bạn chưa đăng nhập.", { status: 401 });

  const path = new URL(request.url).searchParams.get("path") ?? "";
  const [family, child, date, name, ...rest] = path.split("/");
  const kind = fileKind(path);
  const mime = mimeOf(path);
  if (
    rest.length > 0 ||
    family !== me.profile.family_id ||
    !child ||
    !UUID.test(child) ||
    (me.profile.role === "child" && child !== me.userId) ||
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !name ||
    !kind ||
    !mime
  ) {
    return new Response("Không tìm thấy tệp.", { status: 404 });
  }

  const db = await createClient();
  const { data, error } = await db.storage.from("homework").download(path);
  if (error || !data) return new Response("Không tìm thấy tệp.", { status: 404 });

  const ext = name.slice(name.lastIndexOf(".") + 1);
  const inline = kind === "image" || kind === "pdf";
  return new Response(data, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="bai-tap.${ext}"`,
      // Paths are random and never reused, so the browser may keep a private copy.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
