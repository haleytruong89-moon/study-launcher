import { NextResponse } from "next/server";

/** Liveness check for preview deployments. Returns no secrets and touches no data. */
export function GET() {
  return NextResponse.json({ ok: true });
}
