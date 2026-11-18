import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_LOST_COOKIE, AUTH_LOST_MAX_AGE, encodeLost, hasAuthCookie, lostCode } from "@/lib/authLost";

/** Refreshes the Supabase session cookie on each request (used by proxy.ts). */
export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response; // not configured yet: let pages show a clear error

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const hadSession = hasAuthCookie(request.cookies.getAll().map((c) => c.name));
  const { data, error } = await supabase.auth.getUser();
  // 18/11/2026: a session cookie came in but no user came out → the session ended on its own.
  // Note why (first loss only) so the next PIN login can put it in the journal.
  if (hadSession && (error || !data.user) && !request.cookies.get(AUTH_LOST_COOKIE)) {
    const code = lostCode(error);
    console.warn("auth.session_lost", code, request.nextUrl.pathname);
    response.cookies.set(AUTH_LOST_COOKIE, encodeLost({ code, at: new Date().toISOString(), path: request.nextUrl.pathname }), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_LOST_MAX_AGE,
    });
  }
  return response;
}
