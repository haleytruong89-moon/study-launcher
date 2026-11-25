import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STUDY_APP_HEADERS, isStudyAppPathOf, isValidStudyAppSlug } from "@/lib/studyApps";

export const dynamic = "force-dynamic";

const NOT_FOUND = "Không tìm thấy app ôn tập này (có thể bố mẹ đã tắt).";

/**
 * Ôn tập trong Launcher (SQL 0029): ONE review app, streamed from the private `study-apps` bucket
 * with the viewer's own session. RLS decides who sees what: a parent sees every app of the family
 * (also the ones turned off, to try them); a child only the active apps meant for them or for the
 * whole family. Served on the Launcher's address, so the locked laptop and the iPad open it with
 * the Launcher login alone. The page gets no network at all (STUDY_APP_CSP).
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getCurrentUser();
  if (!me) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `/on-tap/${isValidStudyAppSlug(slug) ? slug : ""}`);
    return NextResponse.redirect(login, 303);
  }
  if (!me.profile || !isValidStudyAppSlug(slug)) return notFound();

  const db = await createClient();
  const { data: app } = await db
    .from("study_apps")
    .select("file_path")
    .eq("family_id", me.profile.family_id)
    .eq("slug", slug)
    .maybeSingle();
  if (!app || !isStudyAppPathOf(app.file_path, me.profile.family_id)) return notFound();

  const { data: file, error } = await db.storage.from("study-apps").download(app.file_path);
  if (error || !file) return notFound();

  return new Response(file, { headers: { ...STUDY_APP_HEADERS, Vary: "Cookie" } });
}

function notFound() {
  return new Response(NOT_FOUND, {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
