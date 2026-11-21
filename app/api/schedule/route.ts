import { NextResponse } from "next/server";
import { localDate } from "@/lib/time";
import { loadSchedule } from "@/lib/schedule/load";
import { requireChild, serverError } from "@/lib/today/service";

export const dynamic = "force-dynamic";

/**
 * GET (child, 21/11/2026): the child's own schedule — timetable versions, extra classes, subject
 * prefs — and the app slots they can name as "Cô giao bài ở". Read with the child's own session
 * (RLS: only their rows).
 */
export async function GET() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  try {
    const [data, slots] = await Promise.all([loadSchedule(ctx.db, [ctx.childId]), ctx.db.from("app_slots").select("id, label, kind").eq("active", true)]);
    return NextResponse.json(
      {
        today: localDate(new Date()),
        versions: data.versions,
        extras: data.extras,
        prefs: data.prefs.map(({ key, label, color, bring }) => ({ key, label, color, bring })),
        slots: (slots.data ?? []).filter((s) => s.kind !== "placeholder").map((s) => ({ id: s.id as string, label: s.label as string })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return serverError("schedule", e);
  }
}
