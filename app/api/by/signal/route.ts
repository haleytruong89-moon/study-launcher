import { z } from "zod";
import { byFailed, byJson } from "@/lib/binhYen/http";
import { SIGNAL_KINDS } from "@/lib/binhYen/rules";
import { escalateSoon, sendTalk, talkInfo } from "@/lib/binhYen/talk";
import { requireChild } from "@/lib/today/service";

export const dynamic = "force-dynamic";

/**
 * "Con muốn nói chuyện". Child session only — NOT the Góc bình yên PIN (talking is one tap,
 * BINH_YEN §4), and it works while the corner is off. GET = can I send + my last signal.
 */
export async function GET() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  escalateSoon(guard.ctx.familyId);
  try {
    return byJson(await talkInfo(guard.ctx));
  } catch {
    return byFailed("signal.read");
  }
}

// Only the child's own kinds; needs_care arrives with the text boxes (S-BY2).
const bodySchema = z.object({ kind: z.enum(SIGNAL_KINDS), to: z.uuid().nullable().default(null) }).strict();

export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return byJson({ error: "Yêu cầu không hợp lệ." }, 400);
  escalateSoon(guard.ctx.familyId);
  try {
    const result = await sendTalk(guard.ctx, parsed.data.kind, parsed.data.to);
    if (!result.ok) return byJson({ error: result.error }, result.status);
    return byJson({ ...result.info, delivered: result.delivered, repeated: result.repeated });
  } catch {
    return byFailed("signal.send");
  }
}
