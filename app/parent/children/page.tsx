import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { createAdminClient } from "@/lib/supabase/admin";
import { AddChildForm } from "../add-child-form";
import { ChildEdit } from "../child-edit";
import { ParentHeader } from "../parent-header";

export const dynamic = "force-dynamic";

/** "Các con": name, grade, colour, password (moved here from the old Tổng quan). */
export default async function ChildrenPage() {
  const { db } = await requireParentPage();
  const children = await loadChildren(db);
  // Whether a PIN is set (the hash column is server-only; only a yes/no leaves the server).
  // The ids come from the parent's own session (RLS), so only this family's children.
  const pinSet = new Set<string>();
  const remembered = new Map<string, number>();
  if (children.length > 0) {
    const { data: devices } = await createAdminClient()
      .from("pin_devices")
      .select("child_id")
      .in(
        "child_id",
        children.map((c) => c.id),
      )
      .is("revoked_at", null);
    for (const d of devices ?? []) remembered.set(d.child_id as string, (remembered.get(d.child_id as string) ?? 0) + 1);
    const { data } = await createAdminClient()
      .from("profiles")
      .select("id")
      .in(
        "id",
        children.map((c) => c.id),
      )
      .not("pin_hash", "is", null);
    for (const r of data ?? []) pinSet.add(r.id as string);
  }

  return (
    <>
      <ParentHeader title="Các con" current="/parent/children" />
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-6">
        <section aria-labelledby="ch-list" className="flex flex-col gap-3">
          <h2 id="ch-list" className="text-lg font-semibold">
            Tài khoản của con
          </h2>
          {children.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {children.map((c) => (
                <li key={c.id} className="rounded-xl border border-ink/10 bg-white px-4 py-2">
                  <details>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3">
                      <span aria-hidden className="size-3 rounded-full" style={{ background: c.color ?? "#999" }} />
                      <span className="font-medium">{c.display_name}</span>
                      {c.grade ? <span className="text-sm text-ink/60">lớp {c.grade}</span> : null}
                      <span className="ml-auto text-sm font-semibold text-accent">Sửa</span>
                    </summary>
                    <ChildEdit child={{ id: c.id, displayName: c.display_name, grade: c.grade, color: c.color }} pinSet={pinSet.has(c.id)} remembered={remembered.get(c.id) ?? 0} />
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/70">Chưa có tài khoản con nào.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Thêm tài khoản con</h2>
          <AddChildForm />
        </section>
      </main>
    </>
  );
}
