import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rememberDevice } from "@/lib/pin/device";
import { createClient } from "@/lib/supabase/server";

/**
 * Called by the child's screen (and after a password login): remembers this browser so the
 * child can sign in again here with the PIN. A parent session does nothing. A session that
 * was issued before the parent's "Đăng xuất con khỏi mọi máy" may not remember a browser.
 */
export async function POST() {
  const me = await getCurrentUser();
  if (!me?.profile) return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  if (me.profile.role !== "child") return new NextResponse(null, { status: 204 });
  try {
    const { data } = await (await createClient()).auth.getClaims();
    const iat = typeof data?.claims?.iat === "number" ? data.claims.iat : null;
    const ok = await rememberDevice(me.userId, me.profile.family_id, iat);
    if (!ok) return NextResponse.json({ error: "Phiên đăng nhập cũ — hãy đăng nhập lại bằng mật khẩu." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("pin.remember failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Không nhớ được máy này." }, { status: 500 });
  }
}
