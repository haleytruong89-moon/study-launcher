import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const me = await getCurrentUser();
  if (me) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Study Launcher</h1>
        <p className="mt-1 text-sm text-ink/70">Đăng nhập để xem việc hôm nay.</p>
      </div>
      <LoginForm />
    </main>
  );
}
