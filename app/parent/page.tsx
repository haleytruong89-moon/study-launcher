import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "../sign-out-button";
import { AddChildForm } from "./add-child-form";

export const dynamic = "force-dynamic";

export default async function ParentPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.profile) redirect("/setup");
  if (me.profile.role !== "parent") redirect("/today");

  const supabase = await createClient();
  const { data: children } = await supabase
    .from("profiles")
    .select("id, display_name, grade, color")
    .eq("role", "child")
    .order("created_at");

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Xin chào {me.profile.display_name}</h1>
          <p className="text-sm text-ink/70">Trang phụ huynh</p>
        </div>
        <SignOutButton />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Các con</h2>
        {children && children.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {children.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3">
                <span aria-hidden className="size-3 rounded-full" style={{ background: c.color ?? "#999" }} />
                <span className="font-medium">{c.display_name}</span>
                {c.grade ? <span className="text-sm text-ink/60">lớp {c.grade}</span> : null}
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
  );
}
