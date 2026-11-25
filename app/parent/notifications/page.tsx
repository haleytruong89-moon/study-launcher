import { requireParentPage } from "@/lib/admin/page";
import { familyDevices } from "@/lib/push/devices";
import { vapidConfig } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { ParentHeader } from "../parent-header";
import { KeyHelper, PushControls } from "./push-controls";

export const dynamic = "force-dynamic";

/**
 * "Thông báo" (S5): a parent turns Web Push on for this phone, sends a test, and (first time
 * only) creates the VAPID keys to paste into Vercel. Parent decisions 01/11/2026: push for
 * "Xin mở trang", "Nhờ bố mẹ xem" and an evening reminder (20:00–20:59, Vercel Cron) when something waits; no quiet hours.
 */
export default async function NotificationsPage() {
  const { me } = await requireParentPage();
  const config = vapidConfig();
  // push_subscriptions has no browser grants: read the family's parent devices with service_role.
  const admin = createAdminClient();
  const { count } = await admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("profile_id", me.userId);
  const parents = await admin.from("profiles").select("id, display_name").eq("family_id", me.profile.family_id).eq("role", "parent").order("created_at");
  const ids = (parents.data ?? []).map((p) => p.id as string);
  const subs = ids.length > 0 ? await admin.from("push_subscriptions").select("profile_id, user_agent, created_at").in("profile_id", ids) : { data: [] };
  const fmt = (iso: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(new Date(iso));
  const family = familyDevices(
    (parents.data ?? []) as { id: string; display_name: string | null }[],
    (subs.data ?? []) as { profile_id: string; user_agent: string | null; created_at: string }[],
    fmt,
  );

  return (
    <>
      <ParentHeader title="Thông báo" current="/parent/notifications" />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
        <section className="flex flex-col gap-2 rounded-2xl bg-white p-4">
          <h2 className="font-bold">Bố mẹ nhận thông báo khi</h2>
          <ul className="list-disc pl-5 text-sm text-ink/80">
            <li>Con xin mở một trang bị chặn</li>
            <li>Con nhờ bố mẹ xem bài trực tiếp</li>
            <li>Buổi tối (khoảng 20:00–21:00) còn bài chưa xem, việc con đang nhờ hoặc chỗ gia sư cần bố mẹ xem</li>
          </ul>
          <p className="text-sm text-ink/70">Thông báo không chứa chữ con viết. Chạm vào thông báo để mở đúng trang duyệt.</p>
        </section>

        {config && family.length > 0 && (
          <section aria-labelledby="family-devices" className="flex flex-col gap-2 rounded-2xl bg-white p-4">
            <h2 id="family-devices" className="font-bold">
              Máy đang nhận thông báo của cả nhà
            </h2>
            <ul className="flex flex-col gap-1 text-sm">
              {family.map((p, i) => (
                <li key={i}>
                  <strong>{p.name}:</strong>{" "}
                  {p.devices.length > 0 ? (
                    p.devices.map((d) => `${d.word} (bật từ ${d.since})`).join(" · ")
                  ) : (
                    <span className="font-semibold text-red-700">chưa có máy nào · mở trang này trên điện thoại đó rồi bấm Bật thông báo</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {config ? (
          <PushControls publicKey={config.publicKey} devices={count ?? 0} />
        ) : (
          <KeyHelper appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""} />
        )}
      </main>
    </>
  );
}
