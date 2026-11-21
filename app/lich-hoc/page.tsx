import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SessionKeeper } from "../session-keeper";
import { getCurrentUser } from "@/lib/auth";
import { loadSchedule } from "@/lib/schedule/load";
import { localDate } from "@/lib/time";
import { requireChild } from "@/lib/today/service";
import { ScheduleEditor, type ScheduleInitial } from "./schedule-editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Lịch học của con" };

/**
 * "Lịch học của con" (parent decisions 21/11/2026): the child edits their own timetable, extra
 * classes (học thêm / gia sư) and subject list. Every save goes through the server; the parents
 * see each change in Nhật ký and can restore the previous version. Parents are sent to their page.
 */
export default async function LichHocPage() {
  const me = await getCurrentUser();
  if (!me?.profile) redirect(`/login?next=${encodeURIComponent("/lich-hoc")}`);
  if (me.profile.role === "parent") redirect("/parent/timetable");
  const guard = await requireChild(me);
  if (!guard.ok) redirect("/login");
  const { ctx } = guard;

  let initial: ScheduleInitial = { today: localDate(new Date()), versions: [], extras: [], prefs: [], slots: [] };
  try {
    const [data, slots] = await Promise.all([loadSchedule(ctx.db, [ctx.childId]), ctx.db.from("app_slots").select("id, label, kind").eq("active", true)]);
    initial = {
      today: initial.today,
      versions: data.versions,
      extras: data.extras,
      prefs: data.prefs.map(({ key, label, color, bring }) => ({ key, label, color, bring })),
      slots: (slots.data ?? []).filter((s) => s.kind !== "placeholder").map((s) => ({ id: s.id as string, label: s.label as string })),
    };
  } catch (e) {
    console.error("lich-hoc page failed", e instanceof Error ? e.message : e);
  }

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 py-5 sm:px-5">
      <SessionKeeper />
      <ScheduleEditor name={ctx.displayName} color={ctx.color ?? "#2F5D9E"} initial={initial} />
    </main>
  );
}
