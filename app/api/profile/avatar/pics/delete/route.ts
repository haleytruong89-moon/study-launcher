import { NextResponse } from "next/server";
import { z } from "zod";
import { PIC_SLOTS } from "@/lib/avatarPics";
import { NOT_READY_TEXT, loadPics, removePics } from "@/lib/avatarServer";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

const bodySchema = z.union([z.object({ slot: z.enum(["calm", "smile", "sad", "angry"]) }).strict(), z.object({ all: z.literal(true) }).strict()]);

/** R3b: the child takes a picture off one face, or all of them (back to the character made in the app). */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Thiếu hoặc sai thông tin.", 400);

  try {
    const current = await loadPics(ctx.familyId, ctx.childId);
    if (!current.ok) return current.notReady ? jsonError(NOT_READY_TEXT, 503) : jsonError("Không tìm thấy hồ sơ của con.", 404);
    const slots = "all" in parsed.data ? PIC_SLOTS : [parsed.data.slot];
    const pics = await removePics(ctx.familyId, ctx.childId, current.pics, slots);
    return NextResponse.json({ pics });
  } catch (e) {
    return serverError("profile.avatar.pics.delete", e);
  }
}
