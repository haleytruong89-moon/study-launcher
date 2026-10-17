"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** `onDark`: outline style for coloured headers (the child's screen). */
export function SignOutButton({ onDark = false }: { onDark?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={onDark ? "btn border border-white/50 bg-transparent text-sm text-white" : "btn border border-ink/20 bg-white text-ink"}
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Đăng xuất
    </button>
  );
}
