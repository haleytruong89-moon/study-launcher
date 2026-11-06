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
 * whether this browser holds an open session; the page only shows it. Parents are sent away.
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
    // Opening the page is activity: an open session is kept alive, an idle one is closed.
    [state, talk] = await Promise.all([byState(ctx, "page", true), talkInfo(ctx)]);
  } catch {
    console.error("by.page failed");
  }

  return <BinhYenScreen child={{ id: ctx.childId, name: ctx.displayName, color: ctx.color }} voice={voiceFor(ctx.grade)} initial={state} initialTalk={talk} />;
}
