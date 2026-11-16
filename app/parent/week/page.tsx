import Link from "next/link";
import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { nextWeek, periodLabel, pickWeek, prevWeek } from "@/lib/parent/weekDigest";
import { loadChildWeek, type ChildWeek } from "@/lib/parent/weekDigestLoad";
import { localDate } from "@/lib/time";
import { hoursMinutes, latestReviewWeek, REVIEW_QUESTIONS } from "@/lib/today/week";
import { ParentHeader } from "../parent-header";

export const dynamic = "force-dynamic";

/**
 * L-5 "Tổng kết tuần" (parent decisions 15–16/11/2026): both children's week (Saturday before →
 * Friday), read at 20:00 Friday. One block per child, side by side only so the parents read it
 * in one place: no points, no ranking, no comparison. "Gợi ý kèm con cuối tuần" is drawn from
 * the data by fixed rules (never AI). The "chỗ hổng lặp lại" part waits for the tutor app
 * (slices G5/G7) and is not shown yet.
 */
export default async function WeekPage({ searchParams }: { searchParams: Promise<{ tuan?: string }> }) {
  const { db } = await requireParentPage();
  const now = new Date();
  const today = localDate(now);
  const latest = latestReviewWeek(now);
  const week = pickWeek((await searchParams).tuan, latest);
  const children = await loadChildren(db);
  const weeks = await Promise.all(children.map((c) => loadChildWeek(db, c, week, today)));
  const newer = nextWeek(week, latest);

  return (
    <>
      <ParentHeader title="Tổng kết tuần" current="/parent/week" />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
        <nav aria-label="Chọn tuần" className="flex items-center justify-between gap-2">
          <Link href={`/parent/week?tuan=${prevWeek(week)}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white font-bold" aria-label="Tuần trước">
            ‹
          </Link>
          <h1 className="text-lg font-extrabold">Tuần {periodLabel(week)}</h1>
          {newer ? (
            <Link href={`/parent/week?tuan=${newer}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white font-bold" aria-label="Tuần sau">
              ›
            </Link>
          ) : (
            <span className="min-w-11" />
          )}
        </nav>
        <p className="text-sm text-ink/70">Tính 7 ngày từ Thứ Bảy tuần trước đến Thứ Sáu. Chỉ để bố mẹ đọc, không chấm điểm hay so sánh hai con.</p>
        {children.length === 0 && <p className="text-sm text-ink/70">Chưa có tài khoản con nào.</p>}
        {weeks.map((w) => (
          <ChildWeekBlock key={w.child.id} w={w} />
        ))}
      </main>
    </>
  );
}

function ChildWeekBlock({ w }: { w: ChildWeek }) {
  const color = w.child.color ?? "#2B5D4F";
  return (
    <section aria-label={w.child.display_name} className="overflow-hidden rounded-2xl bg-white">
      <h2 className="px-4 py-3 text-lg font-extrabold text-white" style={{ background: color }}>
        {w.child.display_name}
      </h2>
      <div className="flex flex-col gap-4 px-4 py-3.5 text-sm">
        <div aria-label="Tuần qua" className="flex flex-col gap-1">
          <h3 className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">Tuần qua</h3>
          {w.stats ? (
            <>
              <p className="text-base font-bold">{w.stats.okDays}/7 ngày đạt</p>
              <p className="text-ink/80">
                {hoursMinutes(w.stats.minutes)} học · làm sớm {w.stats.early} bài · theo kế hoạch {w.stats.planKeptDays}/{w.stats.planDays} ngày
              </p>
            </>
          ) : (
            <p className="text-ink/60">Chưa đọc được số liệu tuần này.</p>
          )}
        </div>

        <div aria-label="Con tự viết" className="flex flex-col gap-1">
          <h3 className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">Con tự viết</h3>
          {w.review && (w.review.wentWell || w.review.changeNext) ? (
            <>
              <p>
                <strong>{REVIEW_QUESTIONS.wentWell}</strong> {w.review.wentWell ?? "—"}
              </p>
              <p>
                <strong>{REVIEW_QUESTIONS.changeNext}</strong> {w.review.changeNext ?? "—"}
              </p>
            </>
          ) : (
            <p className="text-ink/60">Con chưa viết (mở từ 17:00 Thứ Sáu đến hết Thứ Bảy).</p>
          )}
        </div>

        {(w.tutor || w.pendingRules > 0) && (
          <div aria-label="Gia sư AI" className="flex flex-col gap-1">
            <h3 className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">Gia sư AI</h3>
            {w.tutor && (
              <p>
                {w.tutor.minutes} phút · {w.tutor.problems} bài hỏi cô
                {w.tutor.selfSolved > 0 ? ` · ${w.tutor.selfSolved} tự làm xong` : ""}
              </p>
            )}
            {w.tutor && w.tutor.carry > 0 && <p>Mang sang buổi gia sư: {w.tutor.carry} bài (để dành hỏi thầy, chờ thầy xem)</p>}
            {w.pendingRules > 0 && <p>{w.pendingRules} luật dạy chờ bố mẹ duyệt</p>}
          </div>
        )}

        <div aria-label="Gợi ý kèm con cuối tuần" className="flex flex-col gap-1.5">
          <h3 className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">Gợi ý kèm con cuối tuần</h3>
          {w.suggestions.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {w.suggestions.map((s) => (
                <li key={s} className="rounded-xl bg-bg px-3 py-2">
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink/70">Tuần này không có bài Chưa đạt, quá hạn hay để dành. Cuối tuần có thể hỏi con điều con thích nhất tuần qua.</p>
          )}
        </div>
      </div>
    </section>
  );
}
