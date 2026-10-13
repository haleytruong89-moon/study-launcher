"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { sendJson } from "@/lib/api-client";
import { WEEKDAY_LABELS } from "@/lib/subjects";

import { emptyTemplate, type SlotOption, type TemplateValues } from "./values";

export function TemplateForm({
  initial,
  kids,
  slots,
  defaults,
  submitLabel,
}: {
  initial: TemplateValues;
  kids: { id: string; name: string }[];
  slots: SlotOption[];
  defaults: { extra: number; skill: number };
  submitLabel: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const usableSlots = slots.filter((s) => s.childId === null || s.childId === v.childId);

  function toggleDay(d: number) {
    setV((x) => ({ ...x, weekdays: x.weekdays.includes(d) ? x.weekdays.filter((w) => w !== d) : [...x.weekdays, d] }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    if (v.weekdays.length === 0) return setError("Chọn ít nhất 1 thứ trong tuần.");
    setBusy(true);
    const body = {
      childId: v.childId,
      part: v.part,
      title: v.title,
      subject: v.subject.trim() || null,
      appSlotId: v.appSlotId,
      weekdays: v.weekdays,
      minMinutes: v.minMinutes.trim() === "" ? null : Number(v.minMinutes),
      deepLink: v.deepLink.trim() || null,
      sort: v.sort,
      active: v.active,
    };
    const err = initial.id
      ? await sendJson("PATCH", `/api/admin/templates/${initial.id}`, body)
      : await sendJson("POST", "/api/admin/templates", body);
    setBusy(false);
    if (err) return setError(err);
    setSaved(true);
    if (!initial.id) setV(emptyTemplate(v.childId, v.part));
    router.refresh();
  }

  const input = "min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base font-normal";
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Cho con
        <select
          value={v.childId}
          onChange={(e) => {
            const childId = e.target.value;
            const slot = slots.find((s) => s.id === v.appSlotId);
            // A slot reserved for another child cannot stay linked: clear it visibly, not silently on save.
            const keepSlot = !slot || slot.childId === null || slot.childId === childId;
            setV({ ...v, childId, appSlotId: keepSlot ? v.appSlotId : null });
          }}
          className={input}
        >
          {kids.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">Thuộc phần</legend>
        {(
          [
            ["extra", "Phần 1 · Bài bổ sung"],
            ["skill", "Phần 2 · Kỹ năng"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" name={`${uid}-part`} checked={v.part === value} onChange={() => setV({ ...v, part: value })} className="size-5" />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Tên việc
        <input required maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Môn (tùy chọn)
        <input maxLength={40} value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        App học (tùy chọn)
        <select value={v.appSlotId ?? ""} onChange={(e) => setV({ ...v, appSlotId: e.target.value || null })} className={input}>
          <option value="">Không gắn app</option>
          {usableSlots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Những thứ trong tuần</legend>
        <div className="grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={v.weekdays.includes(d)}
              onClick={() => toggleDay(d)}
              className={`min-h-11 rounded-lg border text-sm font-bold ${v.weekdays.includes(d) ? "border-ink bg-ink text-white" : "border-ink/30 bg-white"}`}
            >
              {WEEKDAY_LABELS[d]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Thời gian tối thiểu (phút)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={240}
          value={v.minMinutes}
          onChange={(e) => setV({ ...v, minMinutes: e.target.value })}
          placeholder={`Để trống = mặc định ${v.part === "extra" ? defaults.extra : defaults.skill} phút`}
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Link mở thẳng bài (tùy chọn)
        <input type="url" inputMode="url" placeholder="https://" value={v.deepLink} onChange={(e) => setV({ ...v, deepLink: e.target.value })} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Thứ tự hiển thị
        <input type="number" min={-1000} max={1000} value={v.sort} onChange={(e) => setV({ ...v, sort: Number(e.target.value) || 0 })} className={input} />
      </label>
      {initial.id && (
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="size-5" />
          Đang dùng
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-semibold text-accent">
          Đã lưu.
        </p>
      )}
      <button type="submit" disabled={busy} className="btn bg-accent text-white disabled:opacity-60">
        {busy ? "Đang lưu…" : submitLabel}
      </button>
    </form>
  );
}
