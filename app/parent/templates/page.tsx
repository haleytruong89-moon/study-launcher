import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { formatWeekdays } from "@/lib/subjects";
import { ParentHeader } from "../parent-header";
import { emptyTemplate, TemplateForm, type SlotOption } from "./template-form";

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

export default async function TemplatesPage() {
  const { me, db } = await requireParentPage();
  const children = await loadChildren(db);
  const kids = children.map((c) => ({ id: c.id, name: c.display_name }));

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
      <ParentHeader title="Mẫu việc theo thứ" current="/parent/templates" />
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-6">
        <p className="text-sm text-ink/70">
          Bài bổ sung (Phần 1) và kỹ năng (Phần 2) lặp lại theo thứ trong tuần. Bài trên lớp thì giao ở trang “Giao bài”.
        </p>

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
                          <li key={t.id} className={`rounded-xl border border-ink/10 bg-white p-3 ${t.active ? "" : "opacity-60"}`}>
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
                                  kids={kids}
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
            <TemplateForm kids={kids} slots={slots} defaults={defaults} initial={emptyTemplate(kids[0].id)} submitLabel="Thêm việc" />
          </section>
        )}
      </main>
    </>
  );
}
