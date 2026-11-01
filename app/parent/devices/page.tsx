import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { EXT_MISSING, EXT_UNINSTALLED, lastExtEvents, whenText, type AuditEventRow } from "@/lib/ext/alerts";
import { ParentHeader } from "../parent-header";
import { PairCodeButton, RevokeButton } from "./device-buttons";

export const dynamic = "force-dynamic";

interface DeviceRow {
  id: string;
  child_id: string;
  label: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_at: string;
  incognito_allowed?: boolean | null;
}

const STALE_MINUTES = 10;

function seen(iso: string | null, now: number): string {
  if (!iso) return "chưa thấy hỏi máy chủ lần nào";
  const min = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  if (min < 24 * 60) return `${Math.round(min / 60)} giờ trước`;
  return `${Math.round(min / 1440)} ngày trước`;
}

/** "Thiết bị" (S4b): pair a child's laptop with a 6-digit code, see / remove laptops. */
export default async function DevicesPage() {
  const { db } = await requireParentPage();
  const children = await loadChildren(db);
  const { data } = await db
    .from("extension_devices")
    // Explicit columns: token_hash is never readable by browsers (column grants).
    .select("id, child_id, label, last_seen_at, revoked_at, created_at, incognito_allowed")
    .is("revoked_at", null)
    .order("created_at");
  const devices = (data ?? []) as DeviceRow[];
  // S6: last "extension bị gỡ" per laptop and "mở Launcher không có extension" per child.
  const { data: events } = await db
    .from("audit_log")
    .select("action, actor_id, payload, created_at")
    .in("action", [EXT_UNINSTALLED, EXT_MISSING])
    .order("created_at", { ascending: false })
    .limit(200);
  const last = lastExtEvents((events ?? []) as AuditEventRow[]);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();

  return (
    <>
      <ParentHeader title="Thiết bị của con" current="/parent/devices" />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        <section aria-labelledby="how" className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4 text-sm">
          <h2 id="how" className="text-base font-bold">
            Cài lên laptop của con (làm 1 lần mỗi máy)
          </h2>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>
              Trên laptop con, tải{" "}
              <a href="/downloads/study-launcher-extension.zip" className="font-semibold text-accent underline">
                study-launcher-extension.zip
              </a>{" "}
              và giải nén.
            </li>
            <li>
              Mở <strong>edge://extensions</strong> (hoặc chrome://extensions) → bật <strong>Chế độ nhà phát triển</strong> → <strong>Tải tiện ích đã giải nén</strong> → chọn thư mục vừa giải nén.
            </li>
            <li>
              Bấm <strong>Chi tiết</strong> của extension → bật <strong>Cho phép trong InPrivate</strong> (Chrome: “Cho phép ở chế độ ẩn danh”), để cửa sổ ẩn danh cũng bị chặn.
            </li>
            <li>Đăng nhập tài khoản của con trên trình duyệt đó, mở trang <strong>/ghep-may</strong>.</li>
            <li>Bấm “Tạo mã ghép máy” bên dưới, đọc 6 số cho con nhập (mã hết hạn sau 10 phút).</li>
          </ol>
          <p className="text-ink/65">Đây là bản chạy thử: con có thể tắt extension nếu biết cách. Bản không tắt được sẽ đăng lên cửa hàng sau khi chạy thử ổn.</p>
          <p className="text-ink/65">
            Bố mẹ được báo (nếu đã bật Thêm › Thông báo) khi extension <strong>bị gỡ</strong>, hoặc khi con mở Study Launcher trên Chrome/Edge máy tính mà <strong>extension không trả lời</strong>. Laptop tắt máy thì không báo.
          </p>
        </section>

        {children.map((c) => {
          const mine = devices.filter((d) => d.child_id === c.id);
          const missing = last.missing.get(c.id);
          return (
            <section key={c.id} aria-labelledby={`dev-${c.id}`} className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
              <h2 id={`dev-${c.id}`} className="flex items-center gap-2 text-base font-bold">
                <span aria-hidden className="size-3 rounded-full" style={{ background: c.color ?? "#999" }} />
                {c.display_name}
              </h2>
              {mine.length === 0 ? (
                <p className="text-sm text-ink/70">Chưa ghép máy nào.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {mine.map((d) => {
                    const removed = last.uninstalled.get(d.id);
                    const stale = !d.last_seen_at || now - new Date(d.last_seen_at).getTime() > STALE_MINUTES * 60_000;
                    return (
                      <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-bg px-3 py-2">
                        <div className="flex grow flex-col">
                          <span className="font-semibold">{d.label ?? "Laptop"}</span>
                          <span className={`text-xs ${stale ? "font-semibold text-[#8A2B1F]" : "text-ink/70"}`}>
                            Lần cuối hỏi máy chủ: {seen(d.last_seen_at, now)}
                            {stale ? " — máy tắt, ngoài mạng, hoặc extension có thể đã bị tắt" : ""}
                          </span>
                          {removed && (
                            <span className="text-xs font-semibold text-[#8A2B1F]">
                              Extension trên máy này đã bị gỡ ({whenText(removed.at, new Date(now))}). Cài lại và ghép lại với con, rồi bấm “Gỡ” cho dòng máy cũ này.
                            </span>
                          )}
                          {d.incognito_allowed === false && (
                            <span className="text-xs font-semibold text-[#8A2B1F]">
                              Cửa sổ ẩn danh (InPrivate) chưa bị chặn: vào trang extension → Chi tiết → bật “Cho phép trong InPrivate”.
                            </span>
                          )}
                        </div>
                        <RevokeButton id={d.id} label={d.label ?? "Laptop"} />
                      </li>
                    );
                  })}
                </ul>
              )}
              {missing && (
                <p className="rounded-xl bg-[#F7E4E0] px-3 py-2 text-xs text-[#8A2B1F]">
                  <strong>
                    Lần gần nhất {c.display_name} mở Study Launcher trên trình duyệt không có extension: {missing.browser ?? "máy tính"}, {whenText(missing.at, new Date(now))}.
                  </strong>{" "}
                  Thường do: chưa cài extension trên trình duyệt / hồ sơ (profile) đó, extension bị tắt ở trang tiện ích, cửa sổ ẩn danh chưa được cho phép, hoặc “Quyền truy cập trang web” bị đổi sang “Khi nhấp”. Mỗi ngày báo tối đa 1 lần.
                </p>
              )}
              <PairCodeButton childId={c.id} name={c.display_name} />
            </section>
          );
        })}
      </main>
    </>
  );
}
