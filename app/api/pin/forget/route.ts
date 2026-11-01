import { NextResponse } from "next/server";
import { forgetThisDevice } from "@/lib/pin/device";

/**
 * "Quên máy này" on the login screen (audit 24/10): this browser stops offering PIN login
 * for every child it remembered. Needs no session: it only acts on this browser's own
 * httpOnly cookie, so it cannot affect any other browser.
 */
export async function POST() {
  try {
    await forgetThisDevice();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("pin.forget failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Không quên được máy này, thử lại." }, { status: 500 });
  }
}
