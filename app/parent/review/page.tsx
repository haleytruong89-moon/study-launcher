import Link from "next/link";
import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { addDays } from "@/lib/admin/dates";
import { photosExpiredOn, retentionDays } from "@/lib/cleanup/rules";
import { loadChildrenToday } from "@/lib/parent/load";
import { localDate, weekStart } from "@/lib/time";
import { isOkResult, longDate, vnTime } from "@/lib/today/view";
import { hoursMinutes, REVIEW_QUESTIONS, reviewWeek, type WeekStats } from "@/lib/today/week";
import { loadWeekStats, loadWeeklyReview, type WeeklyReview } from "@/lib/today/week-load";
import { OverrideSheet } from "../override-sheet";
import { ParentTabs } from "../parent-header";
import { TaskGroup } from "../task-rows";
import { VerdictButtons } from "./verdict-buttons";

export const dynamic = "force-dynamic";

/** How far back the parent can page (photos are kept longer; this keeps the page fast). */
const MAX_DAYS_BACK = 30;

interface RunRow {
  id: string;
  child_id: string;
  source: "homework" | "template";
  started_at: string | null;
  done_at: string;
  proof_paths: string[];
  parent_verdict: "ok" | "not_ok" | null;
  task_templates: { title: string; part: "extra" | "skill" } | null;
  homework_items: { subject: string; note: string | null; due_date: string } | null;
}

/**
 * "Ngày của con" (UI review 19/10/2026, replaces "Xem gộp"): one child, one day.
 * Waiting photos first with big Đạt / Chưa đạt, then what is not done yet (today), then
 * what was already marked. "Chưa đạt" is only a note: it never takes free time back.
 */
export default async function ChildDayPage({ searchParams }: { searchParams: Promise<{ con?: string; ngay?: string }> }) {
  const { me, db } = await requireParentPage();
  const children = await loadChildren(db);
  const now = new Date();
  const today = localDate(now);
  const params = await searchParams;
  const child = children.find((c) => c.id === params.con) ?? children[0];
  const day = pickDay(params.ngay, today);

  if (!child) {
    return (
      <>
        <main className="mx-auto max-w-lg px-4 py-6 text-sm text-ink/70">Chưa có tài khoản con nào.</main>
        <ParentTabs current="/parent/review" />
      </>
    );
  }

  const [{ data }, live, { data: settings }] = await Promise.all([
    db
      .from("task_runs")
      .select("id, child_id, source, started_at, done_at, proof_paths, parent_verdict, task_templates(title, part), homework_items(subject, note, due_date)")
      .eq("child_id", child.id)
      .eq("local_date", day)
      .not("done_at", "is", null)
      .order("done_at"),
    day === today ? loadChildrenToday(db, me.profile.family_id, [child], today, now) : Promise.resolve([]),
    db.from("family_settings").select("photo_retention_days").eq("family_id", me.profile.family_id).maybeSingle(),
  ]);
  const runs = (data ?? []) as unknown as RunRow[];
  const state = live[0]?.state ?? null;
  const o = live[0]?.overview ?? null;

  // S3e: photos of a day past the family's retention were deleted by the weekly job (the run
  // keeps its proof_paths so counts stay right): show a neutral note, do not sign dead links.
  const retention = settings?.photo_retention_days as number | undefined;
  const photoNote: PhotoNote = photosExpiredOn(day, now, retention) ? { expired: true, days: retentionDays(retention) ?? 0 } : { expired: false };
  const proofPaths = photoNote.expired ? [] : runs.flatMap((r) => r.proof_paths);
  const signed = new Map<string, string>();
  if (proofPaths.length > 0) {
    const { data: urls } = await db.storage.from("proofs").createSignedUrls(proofPaths, 60 * 60);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  // The weekly review of the week under review (or last week), with the child's answers.
  const reviewOpen = reviewWeek(now);
  const week = reviewOpen ?? addDays(weekStart(today), -7);
  let weekly: { stats: WeekStats; review: WeeklyReview | null } | null = null;
  try {
    const [stats, review] = await Promise.all([loadWeekStats(db, child.id, week, child.bedtime), loadWeeklyReview(db, child.id, week)]);
    weekly = { stats, review };
  } catch (e) {
    console.error("review weekly failed", e instanceof Error ? e.message : e);
  }

  const waiting = runs.filter((r) => r.parent_verdict === null);
  const marked = runs.filter((r) => r.parent_verdict !== null);
  const minutes = runs.reduce((sum, r) => sum + minutesOf(r), 0);
  const result = state?.week.find((d) => d.date === day)?.result;
  const dayOk = day === today ? (result ? (isOkResult(result) ? "Đạt" : "Chưa") : "—") : "—";
  const color = child.color ?? "#2B5D4F";
  const href = (con: string, d: string) => `/parent/review?con=${con}${d === today ? "" : `&ngay=${d}`}`;
  const prev = addDays(day, -1);
  const next = addDays(day, 1);
  const canPrev = prev >= addDays(today, -MAX_DAYS_BACK);
  const override =
    state?.status === "OPEN_OVERRIDE" ? `đang mở${state.openUntil ? ` đến ${vnTime(state.openUntil)}` : ""}` : state?.status === "LOCK_OVERRIDE" ? "đang khóa" : null;

  return (
    <>
      <header className="text-white" style={{ background: color }}>
        <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 pt-2 pb-4">
          <Link href="/parent" className="-ml-1 inline-flex min-h-11 items-center self-start px-1 font-bold">
            ‹ Hôm nay
          </Link>
          {children.length > 1 && (
            <nav aria-label="Chọn con" className="grid gap-1 rounded-xl bg-white/20 p-1" style={{ gridTemplateColumns: `repeat(${children.length}, minmax(0, 1fr))` }}>
              {children.map((c) => (
                <Link
                  key={c.id}
                  href={href(c.id, day)}
                  aria-current={c.id === child.id ? "page" : undefined}
                  className={`flex min-h-10 items-center justify-center rounded-lg text-sm font-extrabold ${c.id === child.id ? "bg-white" : ""}`}
                  style={c.id === child.id ? { color } : undefined}
                >
                  {c.display_name}
                </Link>
              ))}
            </nav>
          )}
          <div className="flex items-center justify-between gap-2">
            {canPrev ? (
              <Link href={href(child.id, prev)} aria-label="Ngày trước" className="flex size-11 items-center justify-center rounded-xl border-[1.5px] border-white/60 text-xl">
                ‹
              </Link>
            ) : (
              <span className="size-11" />
            )}
            <div className="text-center">
              <h1 className="text-xl font-extrabold">{longDate(day).replace(/,.*$/, "")} {day.slice(8, 10)}/{day.slice(5, 7)}</h1>
              <p className="text-sm font-semibold opacity-90">{day === today ? "Hôm nay" : day === addDays(today, -1) ? "Hôm qua" : `${daysAgo(day, today)} ngày trước`}</p>
            </div>
            {day < today ? (
              <Link href={href(child.id, next)} aria-label="Ngày sau" className="flex size-11 items-center justify-center rounded-xl border-[1.5px] border-white/60 text-xl">
                ›
              </Link>
            ) : (
              <span className="size-11" />
            )}
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat label="việc xong" value={o && day === today ? `${o.done}/${o.total}` : String(runs.length)} />
            <Stat label="thời gian học" value={`${minutes}′`} />
            <Stat label="ngày đạt" value={dayOk} />
          </dl>
        </div>
      </header>

      <main aria-label={`Ngày của ${child.display_name}`} className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-4">
        <p className="text-sm text-ink/70">“Chưa đạt” chỉ để ghi nhận và nói chuyện lại với con, không lấy lại giờ tự do.</p>

        <section aria-labelledby="dv-wait" className="flex flex-col gap-2">
          <h2 id="dv-wait" className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">
            Chờ bố mẹ xem ({waiting.length})
          </h2>
          {waiting.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-3 text-sm text-ink/70">{runs.length === 0 ? "Chưa có việc nào xong." : "Đã xem hết."}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {waiting.map((r) => (
                <RunCard key={r.id} run={r} signed={signed} photoNote={photoNote} big />
              ))}
            </ul>
          )}
        </section>

        {o && (o.overdue.length > 0 || o.today.some((r) => !isDoneTag(r.tag.label)) || o.upcoming.length > 0) && (
          <section aria-labelledby="dv-todo" className="rounded-2xl bg-white px-4 pb-3">
            <h2 id="dv-todo" className="sr-only">
              Chưa làm
            </h2>
            <TaskGroup title="Quá hạn" rows={o.overdue} danger />
            <TaskGroup title="Còn lại hôm nay" rows={o.today.filter((r) => !isDoneTag(r.tag.label))} />
            <TaskGroup title="Sắp tới" rows={o.upcoming} />
          </section>
        )}

        {marked.length > 0 && (
          <section aria-labelledby="dv-marked" className="flex flex-col gap-2">
            <h2 id="dv-marked" className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">
              Đã xem ({marked.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {marked.map((r) => (
                <RunCard key={r.id} run={r} signed={signed} photoNote={photoNote} />
              ))}
            </ul>
          </section>
        )}

        {weekly && <WeeklyBlock {...weekly} open={!!reviewOpen} />}
      </main>

      {day === today && state && o && (
        <div className="fixed inset-x-0 bottom-16 z-10 border-t border-ink/10 bg-bg/95 px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto grid max-w-lg">
            <OverrideSheet
              childId={child.id}
              name={child.display_name}
              open={state.open}
              override={override}
              now={`${o.pill.toLowerCase()} · ${o.machine.replace("Máy: ", "máy ")}`}
              triggerClass="min-h-12 rounded-2xl bg-ink font-extrabold text-white"
              triggerLabel={`Mở / khóa máy của ${child.display_name}`}
            />
          </div>
        </div>
      )}
      {day === today && <div className="h-20" />}
      <ParentTabs current="/parent/review" />
    </>
  );
}

function pickDay(raw: string | undefined, today: string): string {
  if (raw === "hom-qua") return addDays(today, -1);
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today && raw >= addDays(today, -MAX_DAYS_BACK)) return raw;
  return today;
}

function daysAgo(day: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
}

const isDoneTag = (label: string) => /^(Xong|Đạt|Chưa đạt|Chờ xem)/.test(label);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse rounded-xl bg-white/15 px-1 py-2">
      <dt className="text-xs font-semibold">{label}</dt>
      <dd className="text-xl font-extrabold">{value}</dd>
    </div>
  );
}

type PhotoNote = { expired: true; days: number } | { expired: false };

function RunCard({ run: r, signed, photoNote, big = false }: { run: RunRow; signed: Map<string, string>; photoNote: PhotoNote; big?: boolean }) {
  const title = r.source === "homework" ? `${r.homework_items?.subject ?? "Bài"} · bài trên lớp` : (r.task_templates?.title ?? "Việc");
  const early = r.source === "homework" && !!r.homework_items && localDate(new Date(r.done_at)) <= addDays(r.homework_items.due_date, -2);
  const kind = r.source === "homework" ? (early ? " · ★ sớm" : "") : r.task_templates?.part === "skill" ? " · kỹ năng" : " · bài bổ sung";
  const photos = r.proof_paths.map((p) => signed.get(p)).filter((u): u is string => !!u);
  const missing = r.proof_paths.length > 0 && photos.length === 0;
  return (
    <li aria-label={title} className="flex flex-col gap-2.5 rounded-2xl bg-white p-3">
      <div className="flex gap-3">
        {photos.length > 0 && (
          <div className="flex shrink-0 gap-1.5">
            {photos.slice(0, big ? 2 : 1).map((u, n) => (
              <a key={u} href={u} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                <img src={u} alt={`Ảnh ${n === 0 ? "bài" : n + 1} ${title}`} className={big ? "h-28 w-22 rounded-lg object-cover" : "h-14 w-11 rounded-md object-cover"} />
              </a>
            ))}
          </div>
        )}
        <div className="flex min-w-0 grow flex-col gap-1">
          <span className={big ? "text-base font-extrabold" : "font-bold"}>{title}</span>
          {r.homework_items?.note && big && <span className="text-sm text-ink/80">{r.homework_items.note}</span>}
          <span className="text-[13px] text-ink/70">
            {minutesOf(r)} phút{kind} · xong {vnTime(r.done_at)}
            {photos.length > 1 ? ` · ${photos.length} ảnh` : ""}
          </span>
          {missing && (
            <span className="self-start rounded-md bg-ink/6 px-2 py-0.5 text-[13px] font-semibold text-ink/65">
              {photoNote.expired ? `Ảnh đã xóa sau ${photoNote.days} ngày` : "Không mở được ảnh"}
            </span>
          )}
          {!big && <VerdictButtons runId={r.id} initial={r.parent_verdict} label={title} />}
        </div>
      </div>
      {big && <VerdictButtons runId={r.id} initial={r.parent_verdict} label={title} big />}
    </li>
  );
}

function WeeklyBlock({ stats, review, open }: { stats: WeekStats; review: WeeklyReview | null; open: boolean }) {
  const end = addDays(stats.weekStart, 6);
  return (
    <details open={open} className="rounded-2xl bg-white px-4" aria-label="Tổng kết tuần">
      <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-2 font-extrabold">
        <span>
          Tổng kết tuần {stats.weekStart.slice(8, 10)}/{stats.weekStart.slice(5, 7)} – {end.slice(8, 10)}/{end.slice(5, 7)}
        </span>
        <span className="text-sm font-semibold text-ink/70">{stats.okDays}/7 ngày đạt ›</span>
      </summary>
      <div className="flex flex-col gap-1.5 pb-3 text-sm">
        <span className="text-ink/75">
          Làm sớm {stats.early} bài · {hoursMinutes(stats.minutes)} học · theo kế hoạch {stats.planKeptDays}/{stats.planDays} ngày
        </span>
        {review ? (
          <>
            <span>
              <strong>{REVIEW_QUESTIONS.wentWell}</strong> {review.wentWell ?? "—"}
            </span>
            <span>
              <strong>{REVIEW_QUESTIONS.changeNext}</strong> {review.changeNext ?? "—"}
            </span>
          </>
        ) : (
          <span className="text-ink/60">Con chưa viết tổng kết (mở từ 17:00 Chủ nhật đến hết Thứ Hai).</span>
        )}
      </div>
    </details>
  );
}

function minutesOf(r: RunRow): number {
  if (!r.started_at) return 0;
  return Math.max(0, Math.round((new Date(r.done_at).getTime() - new Date(r.started_at).getTime()) / 60_000));
}
