import { requireParentPage } from "@/lib/admin/page";
import { vapidConfig } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { ParentHeader } from "../parent-header";
import { KeyHelper, PushControls } from "./push-controls";

export const dynamic = "force-dynamic";

/**
 * "Thông báo" (S5): a parent turns Web Push on for this phone, sends a test, and (first time
 * only) creates the VAPID keys to paste into Vercel. Parent decisions 01/11/2026: push for
 * "Xin mở trang", "Nhờ bố mẹ xem" and a 21:45 reminder when something waits; no quiet hours.
 */
export default async function NotificationsPage() {
  const { me } = await requireParentPage();
  const config = vapidConfig();
  // push_subscriptions has no browser grants: count this parent's devices with service_role.
  const { count } = await createAdminClient().from("push_subscriptions").select("id", { count: "exact", head: true }).eq("profile_id", me.userId);

  return (
    <>
      <ParentHeader title="Thông báo" current="/parent/notifications" />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
        <section className="flex flex-col gap-2 rounded-2xl bg-white p-4">
          <h2 className="font-bold">Bố mẹ nhận thông báo khi</h2>
          <ul className="list-disc pl-5 text-sm text-ink/80">
            <li>Con xin mở một trang bị chặn</li>
            <li>Con nhờ bố mẹ xem bài trực tiếp</li>
            <li>21:45 còn bài chưa xem hoặc việc con đang nhờ</li>
          </ul>
          <p className="text-sm text-ink/70">Thông báo không chứa chữ con viết. Chạm vào thông báo để mở đúng trang duyệt.</p>
        </section>

        {config ? (
          <PushControls publicKey={config.publicKey} devices={count ?? 0} />
        ) : (
          <KeyHelper appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""} />
        )}
      </main>
    </>
  );
}
