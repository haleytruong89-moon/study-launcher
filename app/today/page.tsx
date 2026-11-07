import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { bySettings } from "@/lib/binhYen/session";
import { requireChild, todayView } from "@/lib/today/service";
import { isChildTab } from "@/lib/childTabs";
import { ExtensionCheck } from "./extension-check";
import { TodayScreen } from "./today-screen";

export const dynamic = "force-dynamic";

/** The child's screen (R2: 5 tabs, docs/MAN_CHINH_MOI.md §2). All state comes from the server. */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ nop?: string; tab?: string }> }) {
  const { nop, tab } = await searchParams;
  // "?nop=<homework id>" comes from the QR code on the laptop: keep it through the login.
  const back = nop && /^[0-9a-f-]{36}$/i.test(nop) ? `/login?next=${encodeURIComponent(`/today?nop=${nop}`)}` : "/login";
  const me = await getCurrentUser();
  if (!me?.profile) redirect(back);
  if (me.profile.role === "parent") redirect("/parent");

  const guard = await requireChild();
  if (!guard.ok) redirect(back);
  const { ctx } = guard;

  let initial = null;
  let byEnabled = false;
  try {
    [initial, { enabled: byEnabled }] = await Promise.all([todayView(ctx), bySettings(ctx.familyId)]);
  } catch (e) {
    console.error("today page failed", e instanceof Error ? e.message : e);
  }

  return (
    <>
      <ExtensionCheck />
      <TodayScreen
        child={{ id: ctx.childId, familyId: ctx.familyId, name: ctx.displayName, grade: ctx.grade, color: ctx.color }}
        initial={initial}
        initialTab={isChildTab(tab) ? tab : "hom-nay"}
        byEnabled={byEnabled}
      />
    </>
  );
}
