import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { addDays } from "@/lib/admin/dates";
import { shortDate } from "@/lib/subjects";
import { localDate } from "@/lib/time";
import { ParentHeader } from "../parent-header";
import { ArchiveButton } from "./archive-button";
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

  const paths = items.flatMap((i) => i.photo_paths);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await db.storage.from("homework").createSignedUrls(paths, 60 * 60);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

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
            tomorrow={addDays(today, 1)}
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
                  {mine.map((i) => (
                    <li key={i.id} className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="font-semibold">{i.subject}</span>
                          <span className="text-sm text-ink/70">
                            Nộp {i.due_date === today ? "hôm nay" : shortDate(i.due_date)}
                            {i.due_date < today && !i.done_at ? " · quá hạn" : ""}
                            {i.done_at ? " · con đã làm xong" : ""}
                          </span>
                        </div>
                        <ArchiveButton id={i.id} label={`${i.subject} nộp ${shortDate(i.due_date)}`} />
                      </div>
                      {i.note && <p className="text-sm">{i.note}</p>}
                      {i.photo_paths.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {i.photo_paths.map((p, n) =>
                            signed.get(p) ? (
                              <a key={p} href={signed.get(p)} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                                <img
                                  src={signed.get(p)}
                                  alt={`Ảnh ${n + 1} bài ${i.subject}`}
                                  className="h-20 w-16 rounded-lg object-cover"
                                />
                              </a>
                            ) : null,
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </main>
    </>
  );
}
