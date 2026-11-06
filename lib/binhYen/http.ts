import "server-only";
import { NextResponse } from "next/server";
import type { ChildContext } from "@/lib/today/service";
import { LOCKED_TEXT } from "./checkin";
import { byState, type ByState } from "./session";
import { STUDY_CAP_TEXT } from "./studyCap";

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

/**
 * The corner's content routes need an OPEN Góc bình yên session (PIN, not idle, not wiped,
 * within the study-time limit). `touch`: this request is the child's activity.
 */
export async function requireByOpen(ctx: ChildContext, touch: boolean): Promise<{ ok: true; state: ByState } | { ok: false; response: NextResponse }> {
  const state = await byState(ctx, "api", touch);
  if (state.unlocked) return { ok: true, state };
  if (state.capped) return { ok: false, response: byJson({ error: STUDY_CAP_TEXT, capped: true, state }, 409) };
  return { ok: false, response: byJson({ error: LOCKED_TEXT, state }, 401) };
}
