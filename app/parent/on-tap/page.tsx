import Link from "next/link";
import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { studyAppUrl } from "@/lib/studyApps";
import { ParentHeader } from "../parent-header";
import { StudyAppActions } from "./study-app-actions";
import { StudyAppUpload } from "./upload-form";

export const dynamic = "force-dynamic";

/**
 * App ôn tập (SQL 0029): the parent uploads the .html review apps made in Xưởng ôn tập, copies
 * each app's address into a supplementary task (Lịch việc mỗi tuần › Link), turns apps on / off.
 */
export default async function StudyAppsPage() {
  const { db } = await requireParentPage();
  const children = await loadChildren(db);
  const kids = children.map((c) => ({ id: c.id, name: c.display_name }));
  const { data } = await db
    .from("study_apps")
    .select("id, child_id, slug, title, active, updated_at")
    .order("active", { ascending: false })
    .order("title");
  const apps = (data ?? []) as { id: string; child_id: string | null; slug: string; title: string; active: boolean; updated_at: string }[];
  const nameOf = (id: string | null) => (id ? (kids.find((k) => k.id === id)?.name ?? "?") : "Cả nhà");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return (
    <>
      <ParentHeader title="App ôn tập" current="/parent/on-tap" />
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-6">
        <div className="flex flex-col gap-2 text-sm text-ink/70">
          <p>
            Tải lên app ôn tập (tệp .html làm ở Xưởng ôn tập). Con mở app ngay trên Launcher, ở cả iPad lẫn laptop đang khóa, không cần
            đăng nhập gì thêm. App không gọi được trang nào khác.
          </p>
          <p>
            Để giao làm bài: chép link của app → vào{" "}
            <Link href="/parent/templates" className="font-semibold text-accent underline">
              Lịch việc mỗi tuần
            </Link>{" "}
            → thêm <b>Bài bổ sung</b> (tên bắt đầu bằng “Ôn thi” nếu là bài ôn thi) → dán vào ô <b>Link</b>.
          </p>
        </div>

        <section aria-labelledby="app-list" className="flex flex-col gap-3">
          <h2 id="app-list" className="text-lg font-semibold">
            Danh sách app
          </h2>
          {apps.length === 0 ? (
            <p className="text-sm text-ink/70">Chưa có app nào.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {apps.map((a) => (
                <li key={a.id} className={`flex flex-col gap-2 rounded-2xl bg-white p-4 ${a.active ? "" : "opacity-70"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex flex-col">
                      <span className="font-bold">{a.title}</span>
                      <span className="text-sm text-ink/70">
                        {nameOf(a.child_id)} · /on-tap/{a.slug}
                        {a.active ? "" : " · đang tắt"}
                      </span>
                    </span>
                  </div>
                  <StudyAppActions id={a.id} slug={a.slug} active={a.active} url={studyAppUrl(appUrl, a.slug)} />
                </li>
              ))}
            </ul>
          )}
          <Link href="/on-tap" className="text-sm font-semibold text-accent underline">
            Xem trang Ôn tập
          </Link>
        </section>

        <section aria-labelledby="app-new" className="flex flex-col gap-3">
          <h2 id="app-new" className="text-lg font-semibold">
            Thêm app · thay tệp
          </h2>
          <p className="text-sm text-ink/70">
            Tải lên tệp cùng <b>địa chỉ</b> với một app đã có thì app đó được thay bằng tệp mới (link giữ nguyên). Tiến độ con đã làm
            nằm trên máy của con nên vẫn còn, trừ khi app mới đổi cách lưu.
          </p>
          <StudyAppUpload kids={kids} existing={apps.map((a) => ({ slug: a.slug, title: a.title, childId: a.child_id }))} />
        </section>
      </main>
    </>
  );
}
