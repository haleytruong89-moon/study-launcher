import Link from "next/link";
import { loadChildren, requireParentPage, type ChildSummary } from "@/lib/admin/page";
import { addDays } from "@/lib/admin/dates";
import { KIND_LABEL, attachmentViews } from "@/lib/files";
import { daysBetween } from "@/lib/parent/overview";
import { shortDate } from "@/lib/subjects";
import { localDate, startOfLocalDay, weekStart } from "@/lib/time";
import { ParentHeader } from "../parent-header";
import { Tag } from "../task-rows";
import { ArchiveButton } from "./archive-button";
import { HomeworkEdit } from "./homework-edit";
import { NewHomeworkSheet } from "./new-homework-sheet";

export const dynamic = "force-dynamic";

interface HomeworkRow {
  id: string;
  child_id: string;
  subject: string;
  due_date: string;
  note: string | null;
  photo_paths: string[];
  done_at: string | null;
}

/**
 * "Giao bài" (UI review 19/10/2026): filter by child, then Quá hạn / Đang chờ con làm /
 * Đã xong tuần này. The form opens from the "+ Giao bài mới" button as a sheet.
 */
export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ con?: string }> }) {
  const { me, db } = await requireParentPage();
  const children = await loadChildren(db);
  const today = localDate(new Date());
  const tomorrow = addDays(today, 1);
  const { con } = await searchParams;
  const filter = children.find((c) => c.id === con) ?? null;
  const weekFrom = startOfLocalDay(weekStart(today)).toISOString();

  let query = db
    .from("homework_items")
    .select("id, child_id, subject, due_date, note, photo_paths, done_at")
    .is("archived_at", null)
    .or(`done_at.is.null,due_date.gte.${today},done_at.gte.${weekFrom}`)
    .order("due_date")
    .order("created_at");
  if (filter) query = query.eq("child_id", filter.id);
  const { data } = await query;
  const items = (data ?? []) as HomeworkRow[];

  const overdue = items.filter((i) => !i.done_at && i.due_date < today);
  const waiting = items.filter((i) => !i.done_at && i.due_date >= today);
  const done = items.filter((i) => !!i.done_at).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  const earlyCount = done.filter((i) => localDate(new Date(i.done_at ?? 0)) <= addDays(i.due_date, -2)).length;
  const kids = children.map((c) => ({ id: c.id, name: c.display_name, color: c.color }));
  const kidOf = (id: string) => children.find((c) => c.id === id);
  const itemProps = { today, tomorrow, familyId: me.profile.family_id, showChild: !filter && children.length > 1, kidOf };

  return (
    <>
      <ParentHeader title="Bài tập" current="/parent/homework" />
      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-4 pb-24">
        {children.length === 0 ? (
          <p className="text-sm text-ink/70">Hãy tạo tài khoản con ở Thêm › Các con trước.</p>
        ) : (
          <>
            {children.length > 1 && (
              <nav aria-label="Lọc theo con" className="grid gap-1 rounded-xl bg-ink/8 p-1" style={{ gridTemplateColumns: `repeat(${children.length + 1}, minmax(0, 1fr))` }}>
                {[{ id: "", label: `Cả ${children.length} con`, color: null as string | null }, ...children.map((c) => ({ id: c.id, label: c.display_name, color: c.color }))].map((t) => {
                  const on = (filter?.id ?? "") === t.id;
                  return (
                    <Link
                      key={t.id || "all"}
                      href={t.id ? `/parent/homework?con=${t.id}` : "/parent/homework"}
                      aria-current={on ? "page" : undefined}
                      className={`flex min-h-10 items-center justify-center rounded-lg px-1 text-center text-sm font-extrabold ${on ? "bg-white shadow-sm" : ""}`}
                      style={t.color ? { color: t.color } : undefined}
                    >
                      {t.label}
                    </Link>
                  );
                })}
              </nav>
            )}
            <NewHomeworkSheet familyId={me.profile.family_id} today={today} tomorrow={tomorrow} kids={kids} defaultKidId={filter?.id} />

            <Group title="Quá hạn · chưa làm" danger items={overdue} empty={null} {...itemProps} />
            <Group title="Đang chờ con làm" items={waiting} empty="Không có bài nào đang chờ." {...itemProps} />
            {done.length > 0 && (
              <details className="rounded-2xl bg-white px-4">
                <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between font-extrabold">
                  Đã xong tuần này ({done.length})
                  <span className="text-sm font-semibold text-ink/70">
                    {earlyCount > 0 ? `★ ${earlyCount} bài sớm ›` : "›"}
                  </span>
                </summary>
                <ul className="flex flex-col gap-2 pb-3">
                  {done.map((i) => (
                    <Item key={i.id} item={i} {...itemProps} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </main>
    </>
  );
}

interface ItemProps {
  today: string;
  tomorrow: string;
  familyId: string;
  showChild: boolean;
  kidOf: (id: string) => ChildSummary | undefined;
}

function Group({ title, items, danger = false, empty, ...rest }: ItemProps & { title: string; items: HomeworkRow[]; danger?: boolean; empty: string | null }) {
  if (items.length === 0 && empty === null) return null;
  return (
    <section aria-label={`${title} (${items.length})`} className="flex flex-col gap-2">
      <h2 className={`text-xs font-extrabold tracking-wider uppercase ${danger ? "text-[#8A2B1F]" : "text-ink/70"}`}>
        {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-3 text-sm text-ink/70">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <Item key={i.id} item={i} {...rest} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Item({ item: i, today, tomorrow, familyId, showChild, kidOf }: ItemProps & { item: HomeworkRow }) {
  const kid = kidOf(i.child_id);
  const files = attachmentViews(i.photo_paths);
  const images = files.filter((f) => f.kind === "image");
  const docs = files.filter((f) => f.kind !== "image");
  const early = !!i.done_at && localDate(new Date(i.done_at)) <= addDays(i.due_date, -2);
  const label = `${i.subject} nộp ${shortDate(i.due_date)}`;
  const tag = i.done_at
    ? { label: early ? "Xong sớm ★" : "Đã xong", tone: "ok" as const }
    : i.due_date < today
      ? { label: `Trễ ${daysBetween(i.due_date, today)} ngày`, tone: "late" as const }
      : { label: i.due_date === today ? "Nộp hôm nay" : i.due_date === tomorrow ? "Nộp mai" : `Nộp ${shortDate(i.due_date)}`, tone: i.due_date <= tomorrow ? ("wait" as const) : ("todo" as const) };
  return (
    <li aria-label={label} className={`flex flex-col gap-2 rounded-2xl bg-white p-3 ${!i.done_at && i.due_date < today ? "border-[1.5px] border-[#E7B4AA]" : ""}`}>
      <div className="flex items-start gap-2.5">
        {kid && <span aria-hidden className="mt-2 size-2.5 shrink-0 rounded-full" style={{ background: kid.color ?? "#999" }} />}
        <div className="flex min-w-0 grow flex-col">
          <span className="font-extrabold">{i.subject}</span>
          <span className="text-[13px] text-ink/70">
            {showChild && kid ? `${kid.display_name} · ` : ""}hạn {i.due_date === today ? "hôm nay" : shortDate(i.due_date)}
            {files.length > 0 ? ` · ${files.length} tệp` : ""}
          </span>
        </div>
        <Tag {...tag} />
      </div>
      {i.note && <p className="text-sm">{i.note}</p>}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {images.map((f, n) => (
            <a key={f.path} href={f.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- private file streamed by our own route */}
              <img src={f.url} alt={`Ảnh ${n + 1} bài ${i.subject}`} className="h-16 w-12 rounded-lg object-cover" />
            </a>
          ))}
          {docs.map((f, n) => (
            <a key={f.path} href={f.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-accent/50 px-3 text-sm font-bold text-accent">
              {KIND_LABEL[f.kind]} {n + 1} ↗
            </a>
          ))}
        </div>
      )}
      {kid && (
        <div className="-mb-1 flex flex-wrap justify-end gap-1 border-t border-ink/10 pt-1">
          <HomeworkEdit
            item={{ id: i.id, childId: i.child_id, subject: i.subject, dueDate: i.due_date, note: i.note, paths: i.photo_paths }}
            kid={{ id: kid.id, name: kid.display_name, color: kid.color }}
            familyId={familyId}
            today={today}
            tomorrow={tomorrow}
            label={label}
          />
          <ArchiveButton id={i.id} label={label} />
        </div>
      )}
    </li>
  );
}
