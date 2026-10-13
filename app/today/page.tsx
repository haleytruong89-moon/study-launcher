import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignOutButton } from "../sign-out-button";

export const dynamic = "force-dynamic";

/** Placeholder: the real "Hôm nay" screen arrives in slice S2. */
export default async function TodayPage() {
  const me = await getCurrentUser();
  if (!me?.profile) redirect("/login");
  if (me.profile.role === "parent") redirect("/parent");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold" style={{ color: me.profile.color ?? undefined }}>
        Chào {me.profile.display_name}
      </h1>
      <p className="text-ink/70">Màn “Hôm nay” sẽ có ở bước sau.</p>
      <SignOutButton />
    </main>
  );
}
