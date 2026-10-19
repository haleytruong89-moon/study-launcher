import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireChild, todayView } from "@/lib/today/service";
import { TodayScreen } from "./today-screen";

export const dynamic = "force-dynamic";

/** The child's "Hôm nay" (mockup Main.dc.html). All state comes from the server. */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ nop?: string }> }) {
  const { nop } = await searchParams;
  // "?nop=<homework id>" comes from the QR code on the laptop: keep it through the login.
  const back = nop && /^[0-9a-f-]{36}$/i.test(nop) ? `/login?next=${encodeURIComponent(`/today?nop=${nop}`)}` : "/login";
  const me = await getCurrentUser();
  if (!me?.profile) redirect(back);
  if (me.profile.role === "parent") redirect("/parent");

  const guard = await requireChild();
  if (!guard.ok) redirect(back);
  const { ctx } = guard;

  let initial = null;
  try {
    initial = await todayView(ctx);
  } catch (e) {
    console.error("today page failed", e instanceof Error ? e.message : e);
  }

  return (
    <TodayScreen
      child={{ id: ctx.childId, familyId: ctx.familyId, name: ctx.displayName, grade: ctx.grade, color: ctx.color }}
      initial={initial}
    />
  );
}
