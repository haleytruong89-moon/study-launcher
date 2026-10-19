import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rememberDevice } from "@/lib/pin/device";

/**
 * Called by the child's screen (and after a password login): remembers this browser so the
 * child can sign in again here with the PIN. A parent session does nothing.
 */
export async function POST() {
  const me = await getCurrentUser();
  if (!me?.profile) return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  if (me.profile.role !== "child") return new NextResponse(null, { status: 204 });
  try {
    await rememberDevice(me.userId, me.profile.family_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("pin.remember failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Không nhớ được máy này." }, { status: 500 });
  }
}
