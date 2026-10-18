import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PairForm } from "./pair-form";

export const dynamic = "force-dynamic";

/** "Ghép máy": on the child's laptop, signed in as the child, with the parent's 6-digit code. */
export default async function PairPage() {
  const me = await getCurrentUser();
  if (!me?.profile) redirect("/login?next=/ghep-may");
  if (me.profile.role === "parent") redirect("/parent/devices");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold tracking-wider text-ink/70 uppercase">Cài đặt máy này</span>
        <h1 className="text-2xl font-bold">Ghép laptop với tài khoản của {me.profile.display_name}</h1>
        <p className="text-sm text-ink/75">Bố mẹ mở trang phụ huynh → “Thiết bị” → “Tạo mã ghép máy”, rồi nhập 6 số vào đây.</p>
      </div>
      <PairForm />
    </main>
  );
}
