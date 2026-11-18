import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { localDate } from "@/lib/time";
import { loadTimetables } from "@/lib/timetable/load";
import { ParentHeader } from "../parent-header";
import { TimetableEditor } from "./timetable-editor";

export const dynamic = "force-dynamic";

/**
 * Thời khóa biểu (18/11/2026): each child's school timetable, in versions ("Áp dụng từ"). Parents
 * only write; the child sees it in Góc học tập, and Giao bài suggests the due date from it.
 */
export default async function TimetablePage() {
  const { db } = await requireParentPage();
  const children = await loadChildren(db);
  const versions = await loadTimetables(
    db,
    children.map((c) => c.id),
  );
  const today = localDate(new Date());
  return (
    <>
      <ParentHeader title="Thời khóa biểu" current="/parent/timetable" />
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
        <p className="text-sm text-ink/75">
          Mỗi con một thời khóa biểu, có <b>ngày áp dụng</b>. Khi trường đổi lịch, thêm bản mới với ngày bắt đầu mới; bản cũ vẫn giữ lại. Con chỉ xem được, không sửa được.
        </p>
        {children.length === 0 && <p className="text-sm text-ink/70">Chưa có tài khoản con nào.</p>}
        {children.map((c) => (
          <TimetableEditor
            key={c.id}
            child={{ id: c.id, name: c.display_name, color: c.color ?? "#2B5D4F" }}
            versions={versions.filter((v) => v.childId === c.id)}
            today={today}
          />
        ))}
      </main>
    </>
  );
}
