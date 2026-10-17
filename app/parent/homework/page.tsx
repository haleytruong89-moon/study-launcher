import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { addDays } from "@/lib/admin/dates";
import { KIND_LABEL, attachmentViews } from "@/lib/files";
import { shortDate } from "@/lib/subjects";
import { localDate } from "@/lib/time";
import { ParentHeader } from "../parent-header";
import { ArchiveButton } from "./archive-button";
import { HomeworkEdit } from "./homework-edit";
import { HomeworkForm } from "./homework-form";

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

export default async function HomeworkPage() {
  const { me, db } = await requireParentPage();
  const children = await loadChildren(db);
  const today = localDate(new Date());

  // Open work (any due date) plus anything due from today on, newest due date last.
  const { data } = await db
    .from("homework_items")
    .select("id, child_id, subject, due_date, note, photo_paths, done_at")
    .is("archived_at", null)
    .or(`done_at.is.null,due_date.gte.${today}`)
    .order("due_date")
    .order("created_at");
  const items = (data ?? []) as HomeworkRow[];

  const tomorrow = addDays(today, 1);

  return (
    <>
      <ParentHeader title="Giao bài tập" current="/parent/homework" />
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-6">
        {children.length === 0 ? (
          <p className="text-sm text-ink/70">Hãy tạo tài khoản con ở trang Tổng quan trước.</p>
        ) : (
          <HomeworkForm
            familyId={me.profile.family_id}
            today={today}
            tomorrow={tomorrow}
            kids={children.map((c) => ({ id: c.id, name: c.display_name, color: c.color }))}
          />
        )}

        {children.map((c) => {
          const mine = items.filter((i) => i.child_id === c.id);
          return (
            <section key={c.id} aria-labelledby={`hw-${c.id}`} className="flex flex-col gap-3">
              <h2 id={`hw-${c.id}`} className="text-lg font-semibold">
                Bài đã giao · {c.display_name}
              </h2>
              {mine.length === 0 ? (
                <p className="text-sm text-ink/70">Chưa có bài nào.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {mine.map((i) => {
                    const files = attachmentViews(i.photo_paths);
                    const images = files.filter((f) => f.kind === "image");
                    const docs = files.filter((f) => f.kind !== "image");
                    const early = !!i.done_at && localDate(new Date(i.done_at)) <= addDays(i.due_date, -2);
                    const label = `${i.subject} nộp ${shortDate(i.due_date)}`;
                    return (
                      <li key={i.id} className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex grow flex-col">
                            <span className="font-semibold">{i.subject}</span>
                            <span className="text-sm text-ink/70">
                              Nộp {i.due_date === today ? "hôm nay" : shortDate(i.due_date)}
                              {i.due_date < today && !i.done_at ? " · quá hạn" : ""}
                              {i.done_at ? " · con đã làm xong" : ""}
                              {early ? " · ★ sớm" : ""}
                            </span>
                          </div>
                          <HomeworkEdit
                            item={{ id: i.id, childId: c.id, subject: i.subject, dueDate: i.due_date, note: i.note, paths: i.photo_paths }}
                            kid={{ id: c.id, name: c.display_name, color: c.color }}
                            familyId={me.profile.family_id}
                            today={today}
                            tomorrow={tomorrow}
                            label={label}
                          />
                          <ArchiveButton id={i.id} label={label} />
                        </div>
                        {i.note && <p className="text-sm">{i.note}</p>}
                        {files.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            {images.map((f, n) => (
                              <a key={f.path} href={f.url} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element -- private file streamed by our own route */}
                                <img src={f.url} alt={`Ảnh ${n + 1} bài ${i.subject}`} className="h-20 w-16 rounded-lg object-cover" />
                              </a>
                            ))}
                            {docs.map((f, n) => (
                              <a
                                key={f.path}
                                href={f.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-11 items-center rounded-full border border-accent/50 px-3 text-sm font-bold text-accent"
                              >
                                {KIND_LABEL[f.kind]} {n + 1} ↗
                              </a>
                            ))}
                          </div>
                        )}
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
