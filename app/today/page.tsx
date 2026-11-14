import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { storedAvatar } from "@/lib/avatar";
import { readAvatar, type StoredLook } from "@/lib/avatarServer";
import { voiceFor } from "@/lib/binhYen/catalog";
import { bySettings } from "@/lib/binhYen/session";
import { requireChild, todayView } from "@/lib/today/service";
import { isChildTab } from "@/lib/childTabs";
import { tutorEnabled, tutorOrigin } from "@/lib/tutor/entry";
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

  const guard = await requireChild(me); // same request: reuse the user read above
  if (!guard.ok) redirect(back);
  const { ctx } = guard;

  let initial = null;
  let byEnabled = false;
  let stored: StoredLook = { avatar: null, pics: {}, icon: null };
  try {
    [initial, { enabled: byEnabled }, stored] = await Promise.all([todayView(ctx), bySettings(ctx.familyId), readAvatar(ctx).catch(() => stored)]);
  } catch (e) {
    console.error("today page failed", e instanceof Error ? e.message : e);
  }

  return (
    <>
      {/* The laptop tab bar is a fixed left column (R2): keep the banner clear of it. */}
      <div className="lg:pl-52">
        <ExtensionCheck />
      </div>
      <TodayScreen
        child={{
          id: ctx.childId,
          familyId: ctx.familyId,
          name: ctx.displayName,
          grade: ctx.grade,
          color: ctx.color,
          look: storedAvatar(stored.avatar, voiceFor(ctx.grade)).avatar,
          pics: stored.pics,
        }}
        initial={initial}
        initialTab={isChildTab(tab) ? tab : "hom-nay"}
        byEnabled={byEnabled}
        tutor={tutorEnabled(tutorOrigin(process.env.TUTOR_APP_ORIGIN), ctx.grade)}
      />
    </>
  );
}
