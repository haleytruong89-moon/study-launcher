import Link from "next/link";
import { loadChildren, requireParentPage } from "@/lib/admin/page";
import {
  actionsInGroup,
  AUDIT_GROUP_LABEL,
  AUDIT_GROUPS,
  auditText,
  HIDDEN_ACTIONS,
  LOG_MAX,
  LOG_PAGE_SIZE,
  logHref,
  parseLogQuery,
} from "@/lib/admin/auditText";
import { addDays, localDate } from "@/lib/time";
import { dayMonth, vnTime } from "@/lib/today/view";
import { ParentHeader } from "../parent-header";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  action: string;
  payload: unknown;
  actor_id: string | null;
  created_at: string;
}

/**
 * "Nhật ký" (S3d): what happened in the family, newest first, as short Vietnamese sentences.
 * Read with the parent's own session (RLS: audit_log parent_select, this family only).
 * Rendered on the server: the raw payload never reaches the browser.
 */
export default async function LogPage({ searchParams }: { searchParams: Promise<{ con?: string; nhom?: string; so?: string }> }) {
  const { db } = await requireParentPage();
  const children = await loadChildren(db);
  const q = parseLogQuery(await searchParams, children.map((c) => c.id));

  let query = db
    .from("audit_log")
    .select("id, action, payload, actor_id, created_at")
    .not("action", "in", `(${HIDDEN_ACTIONS.join(",")})`)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(q.limit + 1);
  if (q.group) query = query.in("action", actionsInGroup(q.group));
  if (q.childId) query = query.or(`actor_id.eq.${q.childId},payload->>child_id.eq.${q.childId}`);
  const [{ data, error }, { data: people }] = await Promise.all([query, db.from("profiles").select("id, display_name, role")]);
  const rows = ((data ?? []) as Row[]).slice(0, q.limit);
  const more = (data ?? []).length > q.limit && q.limit < LOG_MAX;

  const kids = new Map(children.map((c) => [c.id, c.display_name]));
  const everyone = new Map((people ?? []).map((p) => [p.id as string, p.display_name as string]));
  const who = (r: Row) => (r.actor_id ? (everyone.get(r.actor_id) ?? "Người dùng cũ") : "Tự động");

  const today = localDate(new Date());
  const dayTitle = (d: string) => (d === today ? "Hôm nay" : d === addDays(today, -1) ? "Hôm qua" : dayMonth(d));
  const days: { date: string; rows: Row[] }[] = [];
  for (const r of rows) {
    const d = localDate(new Date(r.created_at));
    const last = days[days.length - 1];
    if (last && last.date === d) last.rows.push(r);
    else days.push({ date: d, rows: [r] });
  }

  return (
    <>
      <ParentHeader title="Nhật ký" current="/parent/log" />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-4">
        <p className="text-sm text-ink/75">Những gì đã đổi trong nhà: mở/khóa máy, giao bài, xin mở trang, chế độ Tin tưởng… Mới nhất ở trên.</p>

        <form method="get" action="/parent/log" className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="log-con" className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">
              Con
            </label>
            <select id="log-con" name="con" defaultValue={q.childId ?? ""} className="min-h-11 rounded-xl border border-ink/30 bg-white px-2 text-base font-semibold text-ink">
              <option value="">Cả nhà</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="log-nhom" className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">
              Nhóm
            </label>
            <select id="log-nhom" name="nhom" defaultValue={q.group ?? ""} className="min-h-11 rounded-xl border border-ink/30 bg-white px-2 text-base font-semibold text-ink">
              <option value="">Tất cả</option>
              {AUDIT_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {AUDIT_GROUP_LABEL[g]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="col-span-2 min-h-11 rounded-xl bg-accent font-extrabold text-white">
            Xem
          </button>
        </form>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-red-700">
            Không đọc được nhật ký — thử tải lại trang.
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-3 text-sm text-ink/75">Chưa có gì trong nhật ký{q.childId || q.group ? " khớp bộ lọc này" : ""}.</p>
        ) : (
          days.map((d) => (
            <section key={d.date} aria-label={dayTitle(d.date)} className="flex flex-col gap-1">
              <h2 className="px-1 text-xs font-extrabold tracking-wider text-ink/70 uppercase">{dayTitle(d.date)}</h2>
              <ul className="rounded-2xl bg-white px-4">
                {d.rows.map((r) => {
                  const { text, group } = auditText(r, kids);
                  return (
                    <li key={r.id} className="flex flex-col border-t border-ink/10 py-2.5 first:border-t-0">
                      <span className="font-semibold">{text}</span>
                      <span className="text-xs text-ink/70">
                        {vnTime(r.created_at)} · {who(r)}
                        {group ? ` · ${AUDIT_GROUP_LABEL[group]}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}

        {more ? (
          <Link href={logHref({ ...q, limit: q.limit + LOG_PAGE_SIZE })} scroll={false} className="flex min-h-12 items-center justify-center rounded-2xl border-[1.5px] border-accent bg-white font-extrabold text-accent">
            Xem thêm
          </Link>
        ) : rows.length >= LOG_MAX ? (
          <p className="text-center text-xs text-ink/70">Chỉ hiện {LOG_MAX} dòng gần nhất — dùng bộ lọc để tìm việc cũ hơn.</p>
        ) : null}
      </main>
    </>
  );
}
