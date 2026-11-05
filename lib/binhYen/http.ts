import "server-only";
import { NextResponse } from "next/server";

/** JSON answer of the /api/by/* routes: never cached. */
export function byJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Failure of a /api/by/* route. D5: logs only WHERE it failed — never a value, a Postgres
 * message (it can quote a row) or anything the child sent.
 */
export function byFailed(where: string) {
  console.error(`by.${where} failed`);
  return byJson({ error: "Máy chủ đang lỗi, thử lại sau ít phút." }, 500);
}
