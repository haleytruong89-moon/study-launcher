"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { sendJson } from "@/lib/api-client";
import { canTurnOffTasks, DAY_TYPE_INFO, DAY_TYPES, templatesForDate, type DayType, type TemplateForDay } from "@/lib/admin/specialDay";
import { addDays } from "@/lib/time";
import { dayMonth } from "@/lib/today/view";

export interface SpecialDayRow {
  date: string;
  dayType: DayType;
  disabledTemplateIds: string[];
}

const TONE: Record<DayType, string> = {
  normal: "border-accent bg-[#E3EEEA] text-accent",
  sick: "border-[#8A2B1F] bg-[#F8E1DC] text-[#6E2218]",
  exam: "border-[#2F5D9E] bg-[#E1EAF6] text-[#21436F]",
  holiday: "border-[#7A400B] bg-[#FBE9D3] text-[#5E3108]",
};

/** "Hôm nay" · "Ngày mai" · "Thứ Ba 03/11". */
function dateText(date: string, today: string): string {
  if (date === today) return `hôm nay (${dayMonth(date)})`;
  if (date === addDays(today, 1)) return `ngày mai (${dayMonth(date)})`;
  return dayMonth(date);
}

function saveText(dayType: DayType, off: number, date: string, today: string, name: string): string {
  const when = dateText(date, today);
  if (dayType === "normal") return `Để ${when} là ngày thường cho ${name}`;
  const extra = canTurnOffTasks(dayType) && off > 0 ? ` · bỏ ${off} việc` : "";
  return `Đặt ${DAY_TYPE_INFO[dayType].label.toLowerCase()} ${when} cho ${name}${extra}`;
}

/**
 * "Ngày đặc biệt" bottom sheet (S3d), same pattern as "Mở / khóa máy": pick the day, the kind
 * of day, and (exam / holiday) the tasks to drop; ONE button that says exactly what happens.
 * The server checks everything again (date window, the child's own tasks) and logs it.
 */
export function SpecialDaySheet({
  childId,
  name,
  today,
  maxDate,
  templates,
  days,
  triggerClass,
  triggerLabel,
}: {
  childId: string;
  name: string;
  today: string;
  maxDate: string;
  /** The child's active task templates (all weekdays). */
  templates: TemplateForDay[];
  /** Special days already set from today on. */
  days: SpecialDayRow[];
  triggerClass: string;
  triggerLabel: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(today);
  const [dayType, setDayType] = useState<DayType>("normal");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function load(next: string) {
    const row = days.find((d) => d.date === next);
    setDate(next);
    setDayType(row?.dayType ?? "normal");
    setOff(new Set(row?.disabledTemplateIds ?? []));
    setError(null);
  }

  const tasks = templatesForDate(templates, date);
  const offCount = tasks.filter((t) => off.has(t.id)).length;
  const tomorrow = addDays(today, 1);
  const titleId = `sd-${childId}`;

  async function save() {
    setBusy(true);
    setError(null);
    const ids = canTurnOffTasks(dayType) ? tasks.filter((t) => off.has(t.id)).map((t) => t.id) : [];
    const err = await sendJson("POST", "/api/admin/special-days", { childId, date, dayType, disabledTemplateIds: ids });
    setBusy(false);
    if (err) return setError(err);
    setDone(`Đã lưu: ${saveText(dayType, ids.length, date, today, name)}.`);
    dialog.current?.close();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        onClick={() => {
          setDone(null);
          load(today);
          dialog.current?.showModal();
        }}
      >
        {triggerLabel}
      </button>
      {done && (
        <p role="status" className="col-span-full text-sm font-semibold">
          {done}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="mx-auto mt-auto mb-0 max-h-[92dvh] w-full overflow-y-auto max-w-lg rounded-t-3xl bg-bg p-0 text-ink backdrop:bg-black/45"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="flex flex-col gap-4 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-ink/25" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-xl font-extrabold">
                Ngày đặc biệt của {name}
              </h2>
              <p className="text-sm text-ink/75">Ốm, thi hoặc lễ — đặt cho hôm nay hoặc ngày sắp tới.</p>
            </div>
            <button type="button" aria-label="Đóng" onClick={() => dialog.current?.close()} className="size-11 shrink-0 rounded-xl bg-ink/10 text-lg">
              ✕
            </button>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-extrabold tracking-wider text-ink/70 uppercase">Ngày nào</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { d: today, label: "Hôm nay" },
                { d: tomorrow, label: "Ngày mai" },
              ].map((o) => (
                <button
                  key={o.d}
                  type="button"
                  aria-pressed={date === o.d}
                  onClick={() => load(o.d)}
                  className={`flex min-h-13 flex-col items-center justify-center rounded-2xl border-2 font-extrabold ${date === o.d ? "border-ink bg-ink text-white" : "border-ink/15 bg-white"}`}
                >
                  {o.label}
                  <span className="text-xs font-semibold opacity-80">{dayMonth(o.d)}</span>
                </button>
              ))}
            </div>
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border-2 border-ink/15 bg-white px-4 text-sm font-bold">
              Ngày khác
              <input
                type="date"
                min={today}
                max={maxDate}
                value={date}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v && v >= today && v <= maxDate) load(v);
                }}
                className="min-h-11 bg-transparent text-base font-semibold"
              />
            </label>
            {days.length > 0 && (
              <p className="text-xs text-ink/70">
                Đã đặt: {days.map((d) => `${DAY_TYPE_INFO[d.dayType].label} ${dayMonth(d.date)}`).join(" · ")}
              </p>
            )}
          </fieldset>

          <div role="radiogroup" aria-label="Loại ngày" className="grid grid-cols-2 gap-2">
            {DAY_TYPES.map((t) => {
              const on = t === dayType;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDayType(t)}
                  className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 px-2 text-center font-extrabold ${on ? TONE[t] : "border-ink/15 bg-white"}`}
                >
                  {DAY_TYPE_INFO[t].label}
                  <span className="text-xs font-semibold opacity-80">{DAY_TYPE_INFO[t].sub}</span>
                </button>
              );
            })}
          </div>

          {canTurnOffTasks(dayType) && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-extrabold tracking-wider text-ink/70 uppercase">Bỏ việc nào hôm đó</legend>
              {tasks.length === 0 ? (
                <p className="text-sm text-ink/75">Hôm đó không có bài bổ sung hay kỹ năng nào.</p>
              ) : (
                tasks.map((t) => (
                  <label key={t.id} className={`flex min-h-13 items-center gap-3 rounded-2xl border-2 bg-white px-4 font-bold ${off.has(t.id) ? "border-ink" : "border-ink/15"}`}>
                    <input
                      type="checkbox"
                      checked={off.has(t.id)}
                      onChange={(e) => {
                        const next = new Set(off);
                        if (e.target.checked) next.add(t.id);
                        else next.delete(t.id);
                        setOff(next);
                      }}
                      className="size-5 accent-ink"
                    />
                    <span className="flex flex-col">
                      {t.title}
                      <span className="text-xs font-semibold text-ink/70">{t.part === "extra" ? "Phần 1 · bài bổ sung" : "Phần 2 · kỹ năng"}</span>
                    </span>
                  </label>
                ))
              )}
              <p className="text-xs text-ink/70">Bài trên lớp vẫn giữ nguyên — muốn dời thì sửa hạn ở Giao bài.</p>
            </fieldset>
          )}

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button type="button" disabled={busy} onClick={() => void save()} className="min-h-14 rounded-2xl bg-accent px-3 text-base font-extrabold text-white disabled:opacity-60">
            {saveText(dayType, canTurnOffTasks(dayType) ? offCount : 0, date, today, name)}
          </button>
          <p className="-mt-1 text-center text-xs text-ink/70">Máy con đổi trong khoảng 1 phút · ghi vào nhật ký</p>
        </div>
      </dialog>
    </>
  );
}
