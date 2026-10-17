import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { STATUS_LABEL } from "@/lib/admin/status";
import { computeDayState } from "@/lib/dayState";
import { localDate } from "@/lib/time";
import { loadDay } from "@/lib/today/load";
import { vnTime } from "@/lib/today/view";
import { ParentHeader } from "../parent-header";
import { ControlButtons } from "./control-buttons";

export const dynamic = "force-dynamic";

/** "Mở/khóa" (S3c): each child's live status + open / lock / extend / back to normal. */
export default async function ControlPage() {
  const { me, db } = await requireParentPage();
  const children = await loadChildren(db);
  const now = new Date();
  const today = localDate(now);

  const rows = await Promise.all(
    children.map(async (c) => {
      try {
        const { input } = await loadDay(db, c.id, me.profile.family_id, today);
        const s = computeDayState(input, now);
        const override = s.status === "OPEN_OVERRIDE" || s.status === "LOCK_OVERRIDE";
        return { c, s, override, error: false };
      } catch (e) {
        console.error("control status failed", e instanceof Error ? e.message : e);
        return { c, s: null, override: false, error: true };
      }
    }),
  );

  return (
    <>
      <ParentHeader title="Mở / khóa máy của con" current="/parent/control" />
      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
        <p className="text-sm text-ink/70">
          Dùng khi cần: mở cho con tra cứu, khóa khi đến giờ ăn, cộng thêm vài phút. Có hiệu lực trên máy con trong khoảng 1 phút, mọi lệnh dừng muộn nhất lúc 00:00 và được ghi nhật ký.
        </p>
        {rows.length === 0 && <p className="text-sm text-ink/70">Chưa có tài khoản con nào.</p>}
        {rows.map(({ c, s, override, error }) => (
          <section key={c.id} aria-labelledby={`ctl-${c.id}`} className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
            <div className="flex flex-col gap-1">
              <h2 id={`ctl-${c.id}`} className="flex items-center gap-2 text-base font-bold">
                <span aria-hidden className="size-3 rounded-full" style={{ background: c.color ?? "#999" }} />
                {c.display_name}
              </h2>
              {error || !s ? (
                <span role="alert" className="text-sm text-red-700">
                  Không đọc được trạng thái.
                </span>
              ) : (
                <span className="text-sm" aria-label={`Trạng thái của ${c.display_name}`}>
                  <strong className={s.open ? "text-[#7A400B]" : "text-ink"}>{s.open ? "Đang mở" : "Đang chỉ mở trang học"}</strong>
                  {" · "}
                  {STATUS_LABEL[s.status]}
                  {s.openUntil ? ` đến ${vnTime(s.openUntil)}` : ""}
                  {` · Phần 1: ${s.part1.done}/${s.part1.total} · Phần 2: ${s.part2.done}/${s.part2.total}`}
                </span>
              )}
            </div>
            {s && <ControlButtons childId={c.id} name={c.display_name} open={s.open} override={override} />}
          </section>
        ))}
      </main>
    </>
  );
}
