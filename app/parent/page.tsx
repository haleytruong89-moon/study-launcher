import Link from "next/link";
import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { AddChildForm } from "./add-child-form";
import { ChildEdit } from "./child-edit";
import { ParentHeader } from "./parent-header";

export const dynamic = "force-dynamic";

export default async function ParentPage() {
  const { me, db } = await requireParentPage();
  const children = await loadChildren(db);

  return (
    <>
      <ParentHeader title={`Xin chào ${me.profile.display_name}`} current="/parent" />
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Các con</h2>
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
                    <ChildEdit child={{ id: c.id, displayName: c.display_name, grade: c.grade, color: c.color }} />
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/70">Chưa có tài khoản con nào.</p>
          )}
          {children.length > 0 && (
            <Link href="/parent/homework" className="btn bg-accent text-white">
              Giao bài cho con
            </Link>
          )}
          {children.length > 0 && (
            <nav aria-label="Lối tắt" className="grid grid-cols-3 gap-2">
              {[
                { href: "/parent/devices", label: "Thiết bị", sub: "Ghép laptop" },
                { href: "/parent/allowlist", label: "Trang học", sub: "Trang được mở" },
                { href: "/parent/requests", label: "Xin mở", sub: "Con xin mở trang" },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-ink/15 bg-white px-2 text-center">
                  <span className="text-sm font-bold">{l.label}</span>
                  <span className="text-xs text-ink/65">{l.sub}</span>
                </Link>
              ))}
            </nav>
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
