import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { ParentHeader } from "../parent-header";
import { SlotForm } from "./slot-form";
import { EMPTY_SLOT, type SlotValues } from "./values";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<SlotValues["kind"], string> = {
  internal: "App nhà mình",
  external: "App bên ngoài",
  placeholder: "Đang xây",
};

export default async function SlotsPage() {
  const { db } = await requireParentPage();
  const children = await loadChildren(db);
  const kids = children.map((c) => ({ id: c.id, name: c.display_name }));
  const { data } = await db
    .from("app_slots")
    .select("id, child_id, subject, kind, label, url, allow_domains, active")
    .order("active", { ascending: false })
    .order("subject");
  const slots = data ?? [];
  const nameOf = (id: string | null) => (id ? (kids.find((k) => k.id === id)?.name ?? "?") : "Cả nhà");

  return (
    <>
      <ParentHeader title="App môn học" current="/parent/slots" />
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-6">
        <p className="text-sm text-ink/70">
          Mỗi môn gắn với một app học. Khi máy đang khóa, con vẫn mở được các app này. App “đang xây” hiện cho con biết nhưng không tính vào việc phải làm.
        </p>

        <section aria-labelledby="slot-list" className="flex flex-col gap-3">
          <h2 id="slot-list" className="text-lg font-semibold">
            Danh sách app
          </h2>
          {slots.length === 0 ? (
            <p className="text-sm text-ink/70">Chưa có app nào.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {slots.map((s) => (
                <li key={s.id} className={`rounded-xl border border-ink/10 bg-white p-3 ${s.active ? "" : "opacity-60"}`}>
                  <details>
                    <summary className="flex min-h-11 cursor-pointer list-none flex-col justify-center">
                      <span className="font-semibold">
                        {s.subject} · {s.label}
                        {s.active ? "" : " (đã tắt)"}
                      </span>
                      <span className="text-sm text-ink/70">
                        {KIND_LABEL[s.kind as SlotValues["kind"]]} · {nameOf(s.child_id)}
                        {s.allow_domains.length > 0 ? ` · ${s.allow_domains.join(", ")}` : ""}
                      </span>
                      <span className="text-sm font-semibold text-accent">Sửa</span>
                    </summary>
                    <div className="pt-4">
                      <SlotForm
                        kids={kids}
                        submitLabel="Lưu thay đổi"
                        initial={{
                          id: s.id,
                          childId: s.child_id,
                          subject: s.subject,
                          kind: s.kind,
                          label: s.label,
                          url: s.url ?? "",
                          allowDomains: s.allow_domains,
                          active: s.active,
                        }}
                      />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="slot-new" className="flex flex-col gap-3">
          <h2 id="slot-new" className="text-lg font-semibold">
            Thêm app
          </h2>
          <SlotForm kids={kids} initial={EMPTY_SLOT} submitLabel="Thêm app" />
        </section>
      </main>
    </>
  );
}
