import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { auditText } from "@/lib/admin/auditText";
import { loadSchedule, loadSlotChoices } from "@/lib/schedule/load";
import { toQuickExtras } from "@/lib/schedule/quickExtras";
import { RESTORABLE } from "@/lib/schedule/restore";
import { localDate } from "@/lib/time";
import { ParentHeader } from "../parent-header";
import { RestoreButton } from "./restore-button";
import { ExtraPaste } from "./extra-paste";
import { TimetableEditor } from "./timetable-editor";

export const dynamic = "force-dynamic";

const SCHEDULE_ACTIONS = ["schedule.timetable", "schedule.extra.save", "schedule.extra.off", "schedule.restore"];
const when = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", hour12: false }).format(new Date(iso));

/**
 * Thời khóa biểu (18/11/2026) + lịch học con tự quản (21/11/2026): each child's school timetable
 * in versions, their extra classes, and the recent changes the children made, each with
 * "Khôi phục bản trước". Parents can still paste a timetable themselves.
 */
export default async function TimetablePage() {
  const { db } = await requireParentPage();
  const children = await loadChildren(db);
  const ids = children.map((c) => c.id);
  const [{ versions, extras }, log, slots] = await Promise.all([
    loadSchedule(db, ids),
    db.from("audit_log").select("id, action, payload, actor_id, created_at").in("action", SCHEDULE_ACTIONS).order("created_at", { ascending: false }).limit(20),
    // 22/11/2026: the apps a class can give homework on, for "Dán học thêm".
    loadSlotChoices(db, ids),
  ]);
  const names = new Map(children.map((c) => [c.id, c.display_name]));
  const entries = (log.data ?? []) as { id: string; action: string; payload: Record<string, unknown> | null; actor_id: string | null; created_at: string }[];
  const restored = new Set(entries.filter((e) => e.action === "schedule.restore").map((e) => String(e.payload?.of ?? "")));
  const today = localDate(new Date());
  return (
    <>
      <ParentHeader title="Thời khóa biểu" current="/parent/timetable" />
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
        <p className="text-sm text-ink/75">
          Mỗi con một thời khóa biểu, có <b>ngày áp dụng</b>. Từ 21/11 <b>con tự sửa</b> thời khóa biểu và học thêm ở Góc học tập → Lịch của con → Sửa lịch học; bố mẹ cũng <b>dán được cả danh sách học thêm</b> ở mục của từng con. Mỗi lần con sửa hiện ở mục “Con sửa gần đây” bên dưới, bố mẹ khôi phục được bản trước.
        </p>

        <section aria-label="Con sửa gần đây" className="flex flex-col gap-2 rounded-2xl bg-white p-4">
          <h2 className="text-lg font-extrabold">Con sửa gần đây</h2>
          {entries.length === 0 ? (
            <p className="text-sm text-ink/70">Chưa có thay đổi nào.</p>
          ) : (
            <ul className="flex flex-col">
              {entries.map((e) => (
                <li key={e.id} className="flex flex-col gap-1.5 border-t border-ink/10 py-2.5 first:border-t-0">
                  <span className="text-xs text-ink/60">{when(e.created_at)}</span>
                  <span className="text-sm">{auditText({ action: e.action, payload: e.payload, actor_id: e.actor_id }, names).text}</span>
                  {(RESTORABLE as readonly string[]).includes(e.action) &&
                    (restored.has(e.id) ? <span className="text-xs font-semibold text-ink/60">Đã khôi phục</span> : <RestoreButton auditId={e.id} />)}
                </li>
              ))}
            </ul>
          )}
        </section>

        {children.length === 0 && <p className="text-sm text-ink/70">Chưa có tài khoản con nào.</p>}
        {children.map((c) => {
          const mine = extras.filter((x) => x.childId === c.id);
          return (
            <div key={c.id} className="flex flex-col gap-3">
              <TimetableEditor child={{ id: c.id, name: c.display_name, color: c.color ?? "#2B5D4F" }} versions={versions.filter((v) => v.childId === c.id)} today={today} />
              <ExtraPaste
                child={{ id: c.id, name: c.display_name }}
                extras={mine}
                slots={slots.get(c.id) ?? []}
                initialText={toQuickExtras(mine, slots.get(c.id) ?? [])}
              />
            </div>
          );
        })}
      </main>
    </>
  );
}
