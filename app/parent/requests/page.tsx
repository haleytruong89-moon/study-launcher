import { wideDomainOffer } from "@/lib/admin/allowlist";
import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { localDate, startOfLocalDay } from "@/lib/time";
import { vnTime } from "@/lib/today/view";
import { ParentHeader } from "../parent-header";
import { templateName } from "@/lib/parent/overview";
import { reportMinutes, reportRange } from "@/lib/today/report";
import { ConfirmButtons } from "./confirm-buttons";
import { ReportButtons } from "./report-buttons";
import { AutoRefresh, DecisionButtons } from "./request-buttons";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  approved_15m: "Đã mở 15 phút",
  approved_day: "Đã mở đến hết hôm nay",
  approved_permanent: "Đã thêm vào danh sách",
  denied: "Không đồng ý",
};

interface Req {
  id: string;
  child_id: string;
  url: string;
  domain: string;
  reason: string | null;
  status: string;
  created_at: string;
  decided_at: string | null;
}

/** "Xin mở" (S3d): the children's requests to open a blocked site. Refreshes every 30 s. */
export default async function RequestsPage() {
  const { db } = await requireParentPage();
  const children = await loadChildren(db);
  const since = startOfLocalDay(localDate(new Date())).toISOString();
  const { data } = await db
    .from("unlock_requests")
    .select("id, child_id, url, domain, reason, status, created_at, decided_at")
    .or(`status.eq.pending,created_at.gte.${since}`)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as Req[];
  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");
  const kid = (id: string) => children.find((c) => c.id === id);
  // "Nhờ bố mẹ xem trực tiếp" of today (no rows before migration 0006: the query just fails).
  const asks = await db
    .from("task_runs")
    .select("id, child_id, confirm_requested_at, homework_items(subject, note)")
    .eq("local_date", localDate(new Date()))
    .not("confirm_requested_at", "is", null)
    .is("done_at", null)
    .order("confirm_requested_at");
  const askRows = (asks.error ? [] : (asks.data ?? [])) as unknown as { id: string; child_id: string; confirm_requested_at: string; homework_items: { subject: string; note: string | null } | null }[];
  // "Con quên bấm Bắt đầu?" of today (0020; before the migration the query fails: no section).
  const reports = await db
    .from("task_run_reports")
    .select("id, child_id, started_at, ended_at, requested_at, task_templates(title, subject)")
    .eq("local_date", localDate(new Date()))
    .eq("status", "pending")
    .order("requested_at");
  const reportRows = (reports.error ? [] : (reports.data ?? [])) as unknown as { id: string; child_id: string; started_at: string; ended_at: string; requested_at: string; task_templates: { title: string; subject: string | null } | null }[];

  return (
    <>
      <ParentHeader title="Con nhờ bố mẹ" current="/parent/requests" />
      <AutoRefresh seconds={30} />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        {askRows.length > 0 && (
          <section id="nho-xem" aria-labelledby="ask-h" className="flex flex-col gap-3">
            <h2 id="ask-h" className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">
              Nhờ xem bài trực tiếp ({askRows.length})
            </h2>
            {askRows.map((r) => {
              const subject = r.homework_items?.subject ?? "Bài";
              return (
                <article key={r.id} aria-label={`Nhờ xem ${subject}`} className="flex flex-col gap-3 rounded-2xl border-2 border-accent bg-white p-4">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span aria-hidden className="size-3 rounded-full" style={{ background: kid(r.child_id)?.color ?? "#999" }} />
                      {kid(r.child_id)?.display_name ?? "Con"} · {vnTime(r.confirm_requested_at)}
                    </span>
                    <span className="text-lg font-bold">{subject}</span>
                    {r.homework_items?.note && <span className="text-sm">{r.homework_items.note}</span>}
                    <span className="text-sm text-ink/70">Con không nộp được ảnh. Xem vở của con rồi bấm.</span>
                  </div>
                  <ConfirmButtons runId={r.id} label={subject} />
                </article>
              );
            })}
          </section>
        )}
        {reportRows.length > 0 && (
          <section id="quen-bam" aria-labelledby="report-h" className="flex scroll-mt-4 flex-col gap-3">
            <h2 id="report-h" className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">
              Con quên bấm Bắt đầu ({reportRows.length})
            </h2>
            {reportRows.map((r) => {
              const title = r.task_templates ? templateName(r.task_templates.title, r.task_templates.subject) : "Việc";
              const range = reportRange({ startedAt: r.started_at, endedAt: r.ended_at });
              return (
                <article key={r.id} aria-label={`Nhờ xác nhận ${title}`} className="flex flex-col gap-3 rounded-2xl border-2 border-accent bg-white p-4">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span aria-hidden className="size-3 rounded-full" style={{ background: kid(r.child_id)?.color ?? "#999" }} />
                      {kid(r.child_id)?.display_name ?? "Con"} · nhờ lúc {vnTime(r.requested_at)}
                    </span>
                    <span className="text-lg font-bold">{title}</span>
                    <span className="text-base">
                      {range} ({reportMinutes(r.started_at, r.ended_at)} phút)
                    </span>
                    <span className="text-sm text-ink/70">Con làm nhưng quên bấm Bắt đầu. Đồng ý thì lượt này được tính như con đã bấm Bắt đầu → Xong.</span>
                  </div>
                  <ReportButtons reportId={r.id} label={`${title} ${range}`} />
                </article>
              );
            })}
          </section>
        )}
        {(askRows.length > 0 || reportRows.length > 0) && <h2 className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">Xin mở trang</h2>}
        {pending.length === 0 && <p className="text-sm text-ink/70">Không có yêu cầu mở trang nào đang chờ.</p>}
        {pending.map((r) => (
          <section key={r.id} aria-label={`Yêu cầu ${r.domain}`} className="flex flex-col gap-3 rounded-2xl border-2 border-accent bg-white p-4">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-bold">
                <span aria-hidden className="size-3 rounded-full" style={{ background: kid(r.child_id)?.color ?? "#999" }} />
                {kid(r.child_id)?.display_name ?? "Con"} · {vnTime(r.created_at)}
              </span>
              <span className="text-lg font-bold break-all">{r.domain}</span>
              <a href={r.url} target="_blank" rel="noreferrer noopener" className="text-xs break-all text-accent underline">
                {r.url.length > 120 ? `${r.url.slice(0, 120)}…` : r.url}
              </a>
              {r.reason && <span className="text-sm">“{r.reason}”</span>}
            </div>
            <DecisionButtons id={r.id} domain={r.domain} wide={wideDomainOffer(r.domain)} />
          </section>
        ))}

        {done.length > 0 && (
          <section aria-labelledby="rq-done" className="flex flex-col gap-2">
            <h2 id="rq-done" className="text-base font-bold">
              Hôm nay đã trả lời
            </h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {done.map((r) => (
                <li key={r.id} className="rounded-xl bg-white px-3 py-2">
                  <strong>{kid(r.child_id)?.display_name ?? "Con"}</strong> · {r.domain} · {STATUS[r.status] ?? r.status}
                  {r.decided_at ? ` (${vnTime(r.decided_at)})` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
