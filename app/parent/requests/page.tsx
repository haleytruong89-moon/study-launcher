import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { localDate, startOfLocalDay } from "@/lib/time";
import { vnTime } from "@/lib/today/view";
import { ParentHeader } from "../parent-header";
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

  return (
    <>
      <ParentHeader title="Con xin mở trang" current="/parent/requests" />
      <AutoRefresh seconds={30} />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        {pending.length === 0 && <p className="text-sm text-ink/70">Không có yêu cầu nào đang chờ.</p>}
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
            <DecisionButtons id={r.id} domain={r.domain} />
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
