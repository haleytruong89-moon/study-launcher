import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { FEEDBACK_LABELS, isFeedbackKind, tableMissing } from "@/lib/feedback/rules";
import { localDate } from "@/lib/time";
import { vnTime } from "@/lib/today/view";
import { ParentHeader } from "../parent-header";
import { ReadButton } from "./read-button";

export const dynamic = "force-dynamic";

interface Feedback {
  id: string;
  child_id: string;
  kind: string;
  body: string;
  created_at: string;
  seen_at: string | null;
}

const when = (iso: string) => {
  const d = localDate(new Date(iso));
  return `${vnTime(iso)} ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
};

/**
 * "Góp ý của con" (parent decision 07/11/2026): what the children said about the APP, newest
 * first. Read with the parent's own session (RLS: this family). "Đã đọc" sets seen_at only.
 * No push for new feedback — parents read it here.
 */
export default async function FeedbackPage() {
  const { db } = await requireParentPage();
  const children = await loadChildren(db);
  const { data, error } = await db.from("app_feedback").select("id, child_id, kind, body, created_at, seen_at").order("created_at", { ascending: false }).limit(100);
  const rows = (error ? [] : (data ?? [])) as Feedback[];
  const kid = (id: string) => children.find((c) => c.id === id);

  return (
    <>
      <ParentHeader title="Góp ý của con" current="/parent/feedback" />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
        <p className="text-sm text-ink/70">
          Con gửi từ nút “💡 Góp ý” ở màn Hôm nay (hoặc “Góp ý cho app” trong Góc bình yên). Con được báo trước là bố mẹ sẽ đọc. Không có thông báo đẩy cho góp ý — bố mẹ xem ở đây.
        </p>
        {tableMissing(error) && (
          <p role="note" className="rounded-xl bg-[#FBF0D6] p-3 text-sm font-semibold text-[#5E3D00]">
            Phần Góp ý sẽ dùng được sau khi merge (bảng mới được tạo lúc merge).
          </p>
        )}
        {error && !tableMissing(error) && (
          <p role="alert" className="text-sm font-medium text-red-700">
            Chưa tải được góp ý, thử lại sau.
          </p>
        )}
        {!error && rows.length === 0 && <p className="text-sm font-semibold">Chưa có góp ý nào.</p>}
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <article
                aria-label={`Góp ý của ${kid(r.child_id)?.display_name ?? "con"}`}
                className={`flex flex-col gap-2 rounded-2xl bg-white p-4 ${r.seen_at ? "" : "border-2 border-accent"}`}
              >
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span aria-hidden className="size-3 rounded-full" style={{ background: kid(r.child_id)?.color ?? "#999" }} />
                  <strong>{kid(r.child_id)?.display_name ?? "Con"}</strong>
                  <span>· {isFeedbackKind(r.kind) ? FEEDBACK_LABELS[r.kind] : r.kind}</span>
                  <span className="text-ink/60">· {when(r.created_at)}</span>
                  {!r.seen_at && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">Mới</span>}
                </span>
                <p className="text-base break-words whitespace-pre-wrap">{r.body}</p>
                {r.seen_at ? <span className="text-xs text-ink/60">Đã đọc lúc {when(r.seen_at)}</span> : <ReadButton id={r.id} />}
              </article>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
