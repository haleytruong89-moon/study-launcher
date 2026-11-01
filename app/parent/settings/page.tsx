import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { ParentHeader } from "../parent-header";
import { SettingsForm, type SettingsValues } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { me, db } = await requireParentPage();
  const children = await loadChildren(db);
  const { data: s } = await db.from("family_settings").select("*").eq("family_id", me.profile.family_id).maybeSingle();

  return (
    <>
      <ParentHeader title="Luật trong nhà" current="/parent/settings" />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        <p className="text-sm text-ink/70">
          Luật trong app = luật trong Thỏa thuận gia đình. Đổi ở đây có hiệu lực ở lần máy của con hỏi trạng thái kế tiếp.
        </p>
        {s ? (
          <SettingsForm
            initial={
              {
                breakMinutes: s.break_minutes,
                freeMinutes: s.free_minutes,
                extraMinMinutes: s.extra_min_minutes,
                skillMinMinutes: s.skill_min_minutes,
                passesPerWeek: s.passes_per_week,
                trustUpPct: s.trust_up_pct,
                trustUpWeeks: s.trust_up_weeks,
                trustDownPct: s.trust_down_pct,
                homeworkLookaheadDays: s.homework_lookahead_days,
                ...(typeof s.homework_min_upcoming === "number" ? { homeworkMinUpcoming: s.homework_min_upcoming } : {}),
                photoRetentionDays: s.photo_retention_days,
                ...(typeof s.allow_local_files === "boolean" ? { allowLocalFiles: s.allow_local_files } : {}),
              } satisfies SettingsValues
            }
            kids={children.map((c) => ({ id: c.id, name: c.display_name, bedtime: c.bedtime.slice(0, 5) }))}
          />
        ) : (
          <p role="alert" className="text-sm font-medium text-red-700">
            Chưa có cài đặt gia đình. Hãy báo Claude (thiếu dòng family_settings).
          </p>
        )}
      </main>
    </>
  );
}
