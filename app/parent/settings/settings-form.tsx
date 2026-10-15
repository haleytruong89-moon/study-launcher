"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";

export interface SettingsValues {
  breakMinutes: number;
  freeMinutes: number;
  extraMinMinutes: number;
  skillMinMinutes: number;
  passesPerWeek: number;
  trustUpPct: number;
  trustUpWeeks: number;
  trustDownPct: number;
  homeworkLookaheadDays: number;
  photoRetentionDays: number;
}

const FIELDS: { key: keyof SettingsValues; label: string; hint?: string; min: number; max: number }[] = [
  { key: "breakMinutes", label: "Nghỉ giữa 2 phần (phút)", hint: "0 = không có nghỉ", min: 0, max: 60 },
  { key: "freeMinutes", label: "Giờ tự do sau khi xong (phút)", min: 0, max: 240 },
  { key: "extraMinMinutes", label: "Tối thiểu mỗi bài bổ sung (phút)", hint: "Từng việc có thể đặt riêng", min: 0, max: 180 },
  { key: "skillMinMinutes", label: "Tối thiểu mỗi kỹ năng (phút)", hint: "Từng việc có thể đặt riêng", min: 0, max: 180 },
  { key: "passesPerWeek", label: "Thẻ miễn mỗi tuần", min: 0, max: 7 },
  { key: "homeworkLookaheadDays", label: "Hiện bài trên lớp trước hạn (ngày)", hint: "1 = bài nộp ngày mai hiện từ hôm nay", min: 0, max: 7 },
  { key: "trustUpPct", label: "Lên Tin tưởng: tỷ lệ ngày đạt (%)", min: 0, max: 100 },
  { key: "trustUpWeeks", label: "Lên Tin tưởng: số tuần liên tiếp", min: 1, max: 12 },
  { key: "trustDownPct", label: "Gợi ý quay về Khóa khi tuần dưới (%)", min: 0, max: 100 },
  { key: "photoRetentionDays", label: "Giữ ảnh bài (ngày)", min: 7, max: 365 },
];

interface Kid {
  id: string;
  name: string;
  bedtime: string;
}

export function SettingsForm({ initial, kids }: { initial: SettingsValues; kids: Kid[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<keyof SettingsValues, string>>(
    () => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])) as Record<keyof SettingsValues, string>,
  );
  const [bedtimes, setBedtimes] = useState<Record<string, string>>(() => Object.fromEntries(kids.map((k) => [k.id, k.bedtime])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const numbers = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]));
    if (Object.values(numbers).some((n) => !Number.isInteger(n))) return setError("Các ô phải là số nguyên.");
    setBusy(true);
    const err = await sendJson("PUT", "/api/admin/settings", {
      ...numbers,
      bedtimes: kids.map((k) => ({ childId: k.id, bedtime: bedtimes[k.id] })),
    });
    setBusy(false);
    if (err) return setError(err);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-sm font-semibold">
          {f.label}
          <input
            type="number"
            inputMode="numeric"
            required
            min={f.min}
            max={f.max}
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base font-normal"
          />
          {f.hint && <span className="text-xs font-normal text-ink/60">{f.hint}</span>}
        </label>
      ))}

      {kids.length > 0 && (
        <fieldset className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-white p-4">
          <legend className="px-1 text-sm font-bold">Giờ ngủ (ngày tính “đạt” khi xong trước giờ này)</legend>
          {kids.map((k) => (
            <label key={k.id} className="flex items-center justify-between gap-3 text-sm font-semibold">
              Giờ ngủ của {k.name}
              <input
                type="time"
                required
                value={bedtimes[k.id] ?? "21:30"}
                onChange={(e) => setBedtimes((b) => ({ ...b, [k.id]: e.target.value }))}
                className="min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base font-normal"
              />
            </label>
          ))}
        </fieldset>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-semibold text-accent">
          Đã lưu cài đặt.
        </p>
      )}
      <button type="submit" disabled={busy} className="btn bg-accent text-white disabled:opacity-60">
        {busy ? "Đang lưu…" : "Lưu cài đặt"}
      </button>
    </form>
  );
}
