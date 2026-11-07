import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { voiceFor } from "@/lib/binhYen/catalog";
import { byState, type ByState } from "@/lib/binhYen/session";
import { escalateSoon, talkInfo, type TalkInfo } from "@/lib/binhYen/talk";
import { requireChild } from "@/lib/today/service";
import { BinhYenScreen } from "./binh-yen-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Góc bình yên",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Góc bình yên (BINH_YEN.md). The child's own corner: the server decides whether it is on and
 * whether this browser has a visit going on; the page only shows it. No separate PIN (07/11/2026). Parents are sent away.
 * No third-party script runs here (Content-Security-Policy in next.config.ts).
 */
export default async function BinhYenPage() {
  const me = await getCurrentUser();
  if (!me?.profile) redirect(`/login?next=${encodeURIComponent("/binh-yen")}`);
  if (me.profile.role === "parent") redirect("/parent");
  const guard = await requireChild();
  if (!guard.ok) redirect("/login");
  const { ctx } = guard;
  escalateSoon(ctx.familyId);

  let state: ByState | null = null;
  let talk: TalkInfo | null = null;
  try {
    // Opening the page: a visit going on in this browser continues (or reports the study-time
    // limit). A page cannot set cookies, so a NEW visit is started by the screen (POST /api/by/open).
    [state, talk] = await Promise.all([byState(ctx, "page", true), talkInfo(ctx)]);
  } catch {
    console.error("by.page failed");
  }

  return <BinhYenScreen child={{ id: ctx.childId, name: ctx.displayName, color: ctx.color }} voice={voiceFor(ctx.grade)} initial={state} initialTalk={talk} />;
}
