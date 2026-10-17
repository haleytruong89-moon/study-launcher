"use client";

import { useState } from "react";
import { HomeworkForm, type EditItem } from "./homework-form";

/** "Sửa" on an assigned homework: opens the same form, pre-filled (S2c). */
export function HomeworkEdit({
  item,
  kid,
  familyId,
  today,
  tomorrow,
  label,
}: {
  item: EditItem;
  kid: { id: string; name: string; color: string | null };
  familyId: string;
  today: string;
  tomorrow: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        aria-label={`Sửa bài ${label}`}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-accent"
      >
        Sửa
      </button>
    );
  }
  return (
    <div className="basis-full border-t border-ink/10 pt-3">
      <HomeworkForm familyId={familyId} today={today} tomorrow={tomorrow} kids={[kid]} edit={item} onDone={() => setOpen(false)} />
    </div>
  );
}
