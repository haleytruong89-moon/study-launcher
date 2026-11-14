import type { NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  return refreshSession(request);
}

// API routes are skipped (perf, 14/11/2026): every route reads the user itself through
// lib/supabase/server.ts, which can refresh and set the session cookie in a Route Handler, and
// the extension's /api/ext/* calls carry a device token, not a session. Running the refresh here
// too cost one extra Supabase Auth round trip on every 30-second poll and every tap.
// Pages still go through it: Server Components cannot write cookies.
export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|downloads/).*)"],
};
