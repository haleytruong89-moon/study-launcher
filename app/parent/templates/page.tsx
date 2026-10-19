import Link from "next/link";
import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { formatWeekdays } from "@/lib/subjects";
import { ParentHeader } from "../parent-header";
import { TemplateForm } from "./template-form";
import { emptyTemplate, type SlotOption } from "./values";

export const dynamic = "force-dynamic";

interface TemplateRow {
  id: string;
  child_id: string;
  part: "extra" | "skill";
  title: string;
  subject: string | null;
  app_slot_id: string | null;
  weekdays: number[];
  min_minutes: number | null;
  deep_link: string | null;
  sort: number;
  active: boolean;
}

const WEEK = [
  [1, "T2"],
  [2, "T3"],
  [3, "T4"],
  [4, "T5"],
  [5, "T6"],
  [6, "T7"],
  [7, "CN"],
] as const;

/** "Lịch việc mỗi tuần" (UI review 19/10/2026): one child at a time, the week at a glance, then edit. */
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ con?: string }> }) {
  const { me, db } = await requireParentPage();
  const children = await loadChildren(db);
  const { con } = await searchParams;
  const shown = children.find((c) => c.id === con) ?? children[0];
  const allKids = children.map((c) => ({ id: c.id, name: c.display_name }));
  const kids = allKids.filter((k) => k.id === shown?.id);

  const [{ data: rows }, { data: slotRows }, { data: settings }] = await Promise.all([
    db
      .from("task_templates")
      .select("id, child_id, part, title, subject, app_slot_id, weekdays, min_minutes, deep_link, sort, active")
      .order("active", { ascending: false })
      .order("sort")
      .order("created_at"),
    db.from("app_slots").select("id, child_id, label, active").eq("active", true).order("subject"),
    db.from("family_settings").select("extra_min_minutes, skill_min_minutes").eq("family_id", me.profile.family_id).maybeSingle(),
  ]);
  const templates = (rows ?? []) as TemplateRow[];
  const slots: SlotOption[] = (slotRows ?? []).map((s) => ({ id: s.id, childId: s.child_id, label: s.label }));
  const defaults = { extra: settings?.extra_min_minutes ?? 20, skill: settings?.skill_min_minutes ?? 20 };

  return (
    <>
      <ParentHeader title="Lịch việc mỗi tuần" current="/parent/templates" />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        <p className="text-sm text-ink/70">
          Bài bổ sung (bắt buộc) và kỹ năng lặp lại theo thứ trong tuần. Bài trên lớp thì giao ở tab “Giao bài”.
        </p>
        {children.length > 1 && (
          <nav aria-label="Chọn con" className="grid gap-1 rounded-xl bg-ink/8 p-1" style={{ gridTemplateColumns: `repeat(${children.length}, minmax(0, 1fr))` }}>
            {children.map((c) => (
              <Link
                key={c.id}
                href={`/parent/templates?con=${c.id}`}
                aria-current={c.id === shown?.id ? "page" : undefined}
                className={`flex min-h-10 items-center justify-center rounded-lg text-sm font-extrabold ${c.id === shown?.id ? "bg-white shadow-sm" : ""}`}
                style={{ color: c.color ?? undefined }}
              >
                {c.display_name}
              </Link>
            ))}
          </nav>
        )}
        {shown && (
          <section aria-label={`Tuần của ${shown.display_name}`} className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink/75">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-3.5 rounded border border-[#9DB6D8] bg-[#E3ECF7]" />
                Bài bổ sung
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-3.5 rounded border border-[#9CC2B0] bg-[#E4EFE9]" />
                Kỹ năng
              </span>
            </div>
            <ul className="rounded-2xl bg-white px-4">
              {WEEK.map(([d, name]) => {
                const today = templates.filter((t) => t.child_id === shown.id && t.active && t.weekdays.includes(d));
                return (
                  <li key={d} aria-label={name} className="flex items-start gap-3 border-t border-ink/10 py-2.5 first:border-t-0">
                    <span className="w-8 shrink-0 pt-1.5 font-extrabold">{name}</span>
                    <span className="flex grow flex-wrap gap-1.5">
                      {today.length === 0 ? (
                        <span className="pt-1.5 text-sm text-ink/60">Nghỉ</span>
                      ) : (
                        today.map((t) => (
                          <a
                            key={t.id}
                            href={`#tpl-${t.id}`}
                            className={`inline-flex min-h-9 items-center rounded-lg px-2.5 text-[13px] font-bold ${t.part === "extra" ? "bg-[#E3ECF7] text-[#1F4778]" : "bg-[#E4EFE9] text-[#1E443A]"}`}
                          >
                            {t.title} · {t.min_minutes ?? (t.part === "extra" ? defaults.extra : defaults.skill)}′
                          </a>
                        ))
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <a href="#tpl-new" className="inline-flex min-h-11 items-center self-start text-sm font-bold text-accent">
              + Thêm việc
            </a>
          </section>
        )}

        {kids.length === 0 ? (
          <p className="text-sm text-ink/70">Hãy tạo tài khoản con ở trang Tổng quan trước.</p>
        ) : (
          kids.map((k) => (
            <section key={k.id} aria-labelledby={`tpl-${k.id}`} className="flex flex-col gap-3">
              <h2 id={`tpl-${k.id}`} className="text-lg font-semibold">
                Việc của {k.name}
              </h2>
              {(["extra", "skill"] as const).map((part) => {
                const mine = templates.filter((t) => t.child_id === k.id && t.part === part);
                return (
                  <div key={part} className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-ink/70">{part === "extra" ? "Phần 1 · Bài bổ sung" : "Phần 2 · Kỹ năng"}</h3>
                    {mine.length === 0 ? (
                      <p className="text-sm text-ink/60">Chưa có.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {mine.map((t) => (
                          <li key={t.id} id={`tpl-${t.id}`} className={`scroll-mt-4 rounded-xl border border-ink/10 bg-white p-3 ${t.active ? "" : "opacity-60"}`}>
                            <details>
                              <summary className="flex min-h-11 cursor-pointer list-none flex-col justify-center">
                                <span className="font-semibold">
                                  {t.title}
                                  {t.active ? "" : " (đã tắt)"}
                                </span>
                                <span className="text-sm text-ink/70">
                                  {formatWeekdays(t.weekdays)} · tối thiểu {t.min_minutes ?? (part === "extra" ? defaults.extra : defaults.skill)} phút
                                  {t.subject ? ` · ${t.subject}` : ""}
                                </span>
                                <span className="text-sm font-semibold text-accent">Sửa</span>
                              </summary>
                              <div className="pt-4">
                                <TemplateForm
                                  kids={allKids}
                                  slots={slots}
                                  defaults={defaults}
                                  submitLabel="Lưu thay đổi"
                                  initial={{
                                    id: t.id,
                                    childId: t.child_id,
                                    part: t.part,
                                    title: t.title,
                                    subject: t.subject ?? "",
                                    appSlotId: t.app_slot_id,
                                    weekdays: t.weekdays,
                                    minMinutes: t.min_minutes === null ? "" : String(t.min_minutes),
                                    deepLink: t.deep_link ?? "",
                                    sort: t.sort,
                                    active: t.active,
                                  }}
                                />
                              </div>
                            </details>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
          ))
        )}

        {kids[0] && (
          <section aria-labelledby="tpl-new" className="flex flex-col gap-3">
            <h2 id="tpl-new" className="text-lg font-semibold">
              Thêm việc
            </h2>
            <TemplateForm kids={allKids} slots={slots} defaults={defaults} initial={emptyTemplate(kids[0].id)} submitLabel="Thêm việc" />
          </section>
        )}
      </main>
    </>
  );
}
