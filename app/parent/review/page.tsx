import Link from "next/link";
import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { addDays } from "@/lib/admin/dates";
import { computeDayState, type Status } from "@/lib/dayState";
import { shortDate } from "@/lib/subjects";
import { loadDay } from "@/lib/today/load";
import { vnTime } from "@/lib/today/view";
import { localDate } from "@/lib/time";
import { ParentHeader } from "../parent-header";
import { VerdictButtons } from "./verdict-buttons";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<Status, string> = {
  LOCK_P1: "Đang làm Phần 1",
  BREAK_OFFER: "Xong Phần 1, chưa nghỉ",
  BREAK: "Đang nghỉ",
  LOCK_P2: "Đang làm Phần 2",
  FREE: "Đang giờ tự do",
  LOCK_END: "Đã hết giờ tự do",
  OPEN_SICK: "Ngày ốm — máy mở cả ngày",
  OPEN_TRUST: "Chế độ Tin tưởng",
  OPEN_OVERRIDE: "Bố mẹ đang mở máy",
  LOCK_OVERRIDE: "Bố mẹ đang khóa máy",
};

interface RunRow {
  id: string;
  child_id: string;
  source: "homework" | "template";
  started_at: string | null;
  done_at: string;
  proof_paths: string[];
  parent_verdict: "ok" | "not_ok" | null;
  task_templates: { title: string; part: "extra" | "skill" } | null;
  homework_items: { subject: string; note: string | null } | null;
}

/** Evening review (SPEC 2.6 "Xem gộp buổi tối"): finished work, minutes, proof photos, verdict. */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ ngay?: string }> }) {
  const { me, db } = await requireParentPage();
  const children = await loadChildren(db);
  const today = localDate(new Date());
  const yesterday = addDays(today, -1);
  const day = (await searchParams).ngay === "hom-qua" ? yesterday : today;

  const { data } = await db
    .from("task_runs")
    .select("id, child_id, source, started_at, done_at, proof_paths, parent_verdict, task_templates(title, part), homework_items(subject, note)")
    .eq("local_date", day)
    .not("done_at", "is", null)
    .order("done_at");
  const runs = (data ?? []) as unknown as RunRow[];

  const proofPaths = runs.flatMap((r) => r.proof_paths);
  const signed = new Map<string, string>();
  if (proofPaths.length > 0) {
    const { data: urls } = await db.storage.from("proofs").createSignedUrls(proofPaths, 60 * 60);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  // Today's live status per child: display only, nothing is written from here.
  const status = new Map<string, { label: string; p1: string; p2: string; ok: boolean }>();
  if (day === today) {
    for (const c of children) {
      try {
        const { input } = await loadDay(db, c.id, me.profile.family_id, today);
        const s = computeDayState(input, new Date());
        const todayResult = s.week[s.week.length - 1]?.result;
        status.set(c.id, {
          label: STATUS_LABEL[s.status],
          p1: `${s.part1.done}/${s.part1.total}`,
          p2: `${s.part2.done}/${s.part2.total}`,
          ok: todayResult === "ok" || todayResult === "pass" || todayResult === "sick",
        });
      } catch (e) {
        console.error("review status failed", e instanceof Error ? e.message : e);
      }
    }
  }

  return (
    <>
      <ParentHeader title="Xem gộp buổi tối" current="/parent/review" />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        <nav aria-label="Chọn ngày" className="flex gap-2">
          {[
            { href: "/parent/review", label: `Hôm nay ${shortDate(today)}`, on: day === today },
            { href: "/parent/review?ngay=hom-qua", label: `Hôm qua ${shortDate(yesterday)}`, on: day === yesterday },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.on ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${l.on ? "border-ink bg-ink text-white" : "border-ink/25 bg-white"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-ink/70">
          Ảnh bài đã làm + thời gian học. “Chưa đạt” chỉ để ghi nhận và nói chuyện lại với con, không lấy lại giờ tự do.
        </p>

        {children.length === 0 && <p className="text-sm text-ink/70">Chưa có tài khoản con nào.</p>}
        {children.map((c) => {
          const mine = runs.filter((r) => r.child_id === c.id);
          const minutes = mine.reduce((sum, r) => sum + minutesOf(r), 0);
          const st = status.get(c.id);
          return (
            <section key={c.id} aria-labelledby={`rv-${c.id}`} className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
              <div className="flex flex-col gap-1">
                <h2 id={`rv-${c.id}`} className="flex items-center gap-2 text-base font-extrabold">
                  <span aria-hidden className="size-3 rounded-full" style={{ background: c.color ?? "#999" }} />
                  Xem gộp · {c.display_name}
                </h2>
                <span className="text-sm text-ink/70">
                  {mine.length} việc xong · {minutes} phút
                  {st ? ` · Phần 1: ${st.p1} · Phần 2: ${st.p2} · ${st.label}${st.ok ? " · ngày đạt ✓" : ""}` : ""}
                </span>
              </div>
              {mine.length === 0 ? (
                <p className="text-sm text-ink/60">Chưa có việc nào xong.</p>
              ) : (
                <ul className="flex flex-col">
                  {mine.map((r) => {
                    const title = r.source === "homework" ? `${r.homework_items?.subject ?? "Bài"} · bài trên lớp` : (r.task_templates?.title ?? "Việc");
                    const kind = r.source === "homework" ? "" : r.task_templates?.part === "skill" ? " · kỹ năng" : " · bài bổ sung";
                    const photos = r.proof_paths.map((p) => signed.get(p)).filter((u): u is string => !!u);
                    return (
                      <li key={r.id} aria-label={title} className="flex gap-3 border-t border-ink/10 py-3 first:border-t-0">
                        {photos.length > 0 ? (
                          <a href={photos[0]} target="_blank" rel="noreferrer" className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                            <img src={photos[0]} alt={`Ảnh bài ${title}`} className="h-20 w-16 rounded-lg object-cover" />
                          </a>
                        ) : null}
                        <div className="flex min-w-0 grow flex-col gap-1.5">
                          <span className="font-bold">{title}</span>
                          <span className="text-sm text-ink/70">
                            {minutesOf(r)} phút{kind} · xong {vnTime(r.done_at)}
                            {photos.length > 1 ? ` · ${photos.length} ảnh` : ""}
                          </span>
                          <VerdictButtons runId={r.id} initial={r.parent_verdict} label={title} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </main>
    </>
  );
}

function minutesOf(r: RunRow): number {
  if (!r.started_at) return 0;
  return Math.max(0, Math.round((new Date(r.done_at).getTime() - new Date(r.started_at).getTime()) / 60_000));
}
