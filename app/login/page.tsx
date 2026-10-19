import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { rememberedChildren } from "@/lib/pin/device";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./login-form";
import { PinLogin } from "./pin-login";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const me = await getCurrentUser();
  if (me) redirect(next ?? "/");
  // Children remembered on this browser (httpOnly cookie); empty elsewhere.
  const kids = await rememberedChildren().catch(() => []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Study Launcher</h1>
        <p className="mt-1 text-sm text-ink/70">Đăng nhập để xem việc hôm nay.</p>
      </div>
      {kids.length > 0 ? <PinLogin kids={kids} next={next} /> : <LoginForm next={next} />}
    </main>
  );
}
