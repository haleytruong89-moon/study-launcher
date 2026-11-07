import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { localDate } from "@/lib/time";
import { vnTime } from "@/lib/today/view";
import { ParentHeader } from "../parent-header";
import { AutoRefresh } from "../requests/request-buttons";
import { SeenButton } from "./seen-button";

export const dynamic = "force-dynamic";

interface Signal {
  id: string;
  child_id: string;
  kind: string;
  to_parent_id: string | null;
  created_at: string;
  seen_at: string | null;
  seen_by: string | null;
}

const when = (iso: string) => {
  const d = localDate(new Date(iso));
  return d === localDate(new Date()) ? vnTime(iso) : `${vnTime(iso)} ${d.slice(8, 10)}/${d.slice(5, 7)}`;
};

/**
 * "Con muốn nói chuyện" (Góc bình yên, S-BY0). Only WHO and WHEN — there is no content to show,
 * by design. Unseen first; "Đã thấy" tells the child a parent saw it. Read with the parent's
 * own session (RLS: this family, signals for both parents or for this parent).
 */
export default async function TalkPage() {
  const { me, db } = await requireParentPage();
  const children = await loadChildren(db);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data, error } = await db
    .from("by_signals")
    .select("id, child_id, kind, to_parent_id, created_at, seen_at, seen_by")
    .or(`seen_at.is.null,created_at.gte.${since}`)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (error ? [] : (data ?? [])) as Signal[];
  const unseen = rows.filter((r) => !r.seen_at);
  const seen = rows.filter((r) => r.seen_at);
  const kid = (id: string) => children.find((c) => c.id === id);
  const { data: parents } = await db.from("profiles").select("id, display_name").eq("role", "parent");
  const parentName = (id: string | null) => (id === me.profile.id ? "Bạn" : ((parents ?? []).find((p) => p.id === id)?.display_name as string | undefined) ?? "Bố/mẹ");

  return (
    <>
      <ParentHeader title="Con muốn nói chuyện" current="/parent/talk" />
      <AutoRefresh seconds={20} />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        <p className="text-sm text-ink/70">
          Con bấm “Con muốn nói chuyện” ở màn Hôm nay hoặc trong Góc bình yên. Chỉ có tên con và giờ — không có nội dung. Bấm “Đã thấy” để con biết bố mẹ đã nhận, rồi tìm con khi có thể. Sau 10 phút chưa ai bấm, con được nhắc tìm bố mẹ trực tiếp (điện thoại không nhắc lại).
        </p>
        {unseen.length === 0 && <p className="text-sm font-semibold">Không có tín hiệu nào đang chờ.</p>}
        {unseen.map((r) => (
          <article key={r.id} aria-label={`${kid(r.child_id)?.display_name ?? "Con"} muốn nói chuyện`} className="flex flex-col gap-3 rounded-2xl border-2 border-accent bg-white p-4">
            <span className="flex items-center gap-2 text-lg font-bold">
              <span aria-hidden className="size-3 rounded-full" style={{ background: kid(r.child_id)?.color ?? "#999" }} />
              {kid(r.child_id)?.display_name ?? "Con"} muốn nói chuyện
            </span>
            <span className="text-sm text-ink/75">
              Lúc {when(r.created_at)}
              {r.to_parent_id ? " · con chỉ gửi cho bạn" : " · gửi cho cả bố và mẹ"}
            </span>
            <SeenButton id={r.id} />
          </article>
        ))}
        {seen.length > 0 && (
          <section aria-labelledby="talk-seen" className="flex flex-col gap-2">
            <h2 id="talk-seen" className="text-base font-bold">
              7 ngày qua
            </h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {seen.map((r) => (
                <li key={r.id} className="rounded-xl bg-white px-3 py-2">
                  <strong>{kid(r.child_id)?.display_name ?? "Con"}</strong> · {when(r.created_at)} · {parentName(r.seen_by)} đã thấy lúc {when(r.seen_at ?? r.created_at)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
