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
  /** Absent until migration 0002 has run (then the field is hidden). */
  homeworkMinUpcoming?: number;
  photoRetentionDays: number;
  /** Absent until migration 0007 has run (then the switch is hidden). */
  allowLocalFiles?: boolean;
  /** Góc bình yên (0008). Absent until that migration has run (then the section is hidden). */
  byEnabled?: boolean;
  byStudyMinutes?: number;
  byIdleLockMinutes?: number;
}

type Group = "time" | "homework" | "trust" | "photos" | "by";
const GROUPS: { group: Group; title: string }[] = [
  { group: "time", title: "Giờ học, nghỉ, giờ tự do" },
  { group: "homework", title: "Bài tập" },
  { group: "trust", title: "Chế độ Tin tưởng (hệ thống chỉ gợi ý, bố mẹ quyết)" },
  { group: "photos", title: "Ảnh bài" },
];

const FIELDS: { key: keyof SettingsValues; group: Group; label: string; hint?: string; min: number; max: number }[] = [
  { key: "breakMinutes", group: "time", label: "Nghỉ giữa 2 phần (phút)", hint: "0 = không có nghỉ", min: 0, max: 60 },
  { key: "freeMinutes", group: "time", label: "Giờ tự do sau khi xong (phút)", min: 0, max: 240 },
  { key: "extraMinMinutes", group: "time", label: "Tối thiểu mỗi bài bổ sung (phút)", hint: "Từng việc có thể đặt riêng", min: 0, max: 180 },
  { key: "skillMinMinutes", group: "time", label: "Tối thiểu mỗi kỹ năng (phút)", hint: "Từng việc có thể đặt riêng", min: 0, max: 180 },
  { key: "passesPerWeek", group: "time", label: "Thẻ miễn mỗi tuần", min: 0, max: 7 },
  {
    key: "homeworkLookaheadDays", group: "homework",
    label: "“Phải xong hôm nay”: bài có hạn trong (ngày)",
    hint: "1 = bài nộp hôm nay và ngày mai phải xong hôm nay; bài xa hơn hiện ở “Sắp tới”",
    min: 0,
    max: 7,
  },
  {
    key: "homeworkMinUpcoming", group: "homework",
    label: "Ngày không có bài đến hạn: con tự chọn làm trước (bài)",
    hint: "0 = không bắt buộc. Con chọn bài nào trong “Sắp tới” cũng được",
    min: 0,
    max: 5,
  },
  { key: "trustUpPct", group: "trust", label: "Lên Tin tưởng: tỷ lệ ngày đạt (%)", min: 0, max: 100 },
  { key: "trustUpWeeks", group: "trust", label: "Lên Tin tưởng: số tuần liên tiếp", min: 1, max: 12 },
  { key: "trustDownPct", group: "trust", label: "Gợi ý quay về Khóa khi tuần dưới (%)", min: 0, max: 100 },
  { key: "photoRetentionDays", group: "photos", label: "Giữ ảnh bài (ngày)", min: 7, max: 365 },
  { key: "byIdleLockMinutes", group: "by", label: "Tự khóa sau bao lâu không chạm (phút)", hint: "Từ 2 đến 15 phút", min: 2, max: 15 },
  { key: "byStudyMinutes", group: "by", label: "Trong giờ học: mỗi lần tối đa (phút)", hint: "Ít nhất 5 phút · áp dụng khi có phần chọn cảm xúc (bản sau)", min: 5, max: 60 },
];

interface Kid {
  id: string;
  name: string;
  bedtime: string;
}

export function SettingsForm({ initial, kids, byPushReady = false }: { initial: SettingsValues; kids: Kid[]; byPushReady?: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<keyof SettingsValues, string>>(
    () =>
      Object.fromEntries(Object.entries(initial).filter(([k]) => k !== "allowLocalFiles" && k !== "byEnabled").map(([k, v]) => [k, String(v)])) as Record<keyof SettingsValues, string>,
  );
  const [localFiles, setLocalFiles] = useState(initial.allowLocalFiles === true);
  const [byOn, setByOn] = useState(initial.byEnabled === true);
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
      ...(initial.allowLocalFiles === undefined ? {} : { allowLocalFiles: localFiles }),
      ...(initial.byEnabled === undefined ? {} : { byEnabled: byOn }),
      bedtimes: kids.map((k) => ({ childId: k.id, bedtime: bedtimes[k.id] })),
    });
    setBusy(false);
    if (err) return setError(err);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {GROUPS.map((g) => (
        <fieldset key={g.group} className="flex flex-col gap-4 rounded-2xl bg-white p-4">
          <legend className="float-left mb-1 text-xs font-extrabold tracking-wider text-ink/70 uppercase">{g.title}</legend>
          {FIELDS.filter((f) => f.group === g.group && initial[f.key] !== undefined).map((f) => (
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
        </fieldset>
      ))}

      {initial.allowLocalFiles !== undefined && (
        <fieldset className="flex flex-col gap-2 rounded-2xl bg-white p-4">
          <legend className="float-left mb-1 text-xs font-extrabold tracking-wider text-ink/70 uppercase">File trên máy của con</legend>
          <label className="flex min-h-11 items-start gap-3 text-sm font-semibold">
            <input type="checkbox" checked={localFiles} onChange={(e) => setLocalFiles(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-accent" />
            <span className="flex flex-col gap-0.5">
              Cho mở file HTML và PDF trên máy trong giờ học
              <span className="text-xs font-normal text-ink/65">
                Ví dụ app ôn thi .html, đề .pdf tải về hoặc nhận qua Zalo. Link trong file mà dẫn ra web vẫn bị chặn như thường. Cần extension bản mới (0.3).
              </span>
            </span>
          </label>
        </fieldset>
      )}

      {initial.byEnabled !== undefined && (
        <fieldset aria-label="Góc bình yên" className="flex flex-col gap-4 rounded-2xl bg-white p-4">
          <legend className="float-left mb-1 text-xs font-extrabold tracking-wider text-ink/70 uppercase">Góc bình yên</legend>
          <p className="text-xs text-ink/70">
            Góc riêng của con để gọi tên cảm xúc và làm dịu. Bố mẹ <strong>không xem được nội dung</strong>, chỉ nhận tín hiệu “Con muốn nói chuyện”. Con tự đặt PIN riêng.
            Chỉ bật sau khi đã nói chuyện với con. Bản này có: PIN riêng, chọn cảm xúc → gợi ý → hoạt động, nút muốn nói chuyện; chưa có ô để con viết chữ. Bật xong, màn Hôm nay của con có nút “🌿 Góc bình yên”. Nút “Con muốn nói chuyện” trên màn Hôm nay hiện khi có điện thoại bố mẹ bật thông báo, dù Góc bình yên bật hay tắt.
          </p>
          {!byPushReady && (
            <p role="note" className="rounded-xl bg-[#FBF0D6] p-3 text-xs font-semibold text-[#5E3D00]">
              Chưa có điện thoại nào của bố mẹ bật thông báo (Thêm › Thông báo). Khi đó con không thấy nút “Con muốn nói chuyện”. Nên bật thông báo trước khi bật Góc bình yên.
            </p>
          )}
          <label className="flex min-h-11 items-start gap-3 text-sm font-semibold">
            <input type="checkbox" checked={byOn} onChange={(e) => setByOn(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-accent" />
            <span className="flex flex-col gap-0.5">
              Bật Góc bình yên cho các con
              <span className="text-xs font-normal text-ink/65">Tắt: khu này ẩn đi (PIN và dữ liệu của con vẫn giữ nguyên).</span>
            </span>
          </label>
          {FIELDS.filter((f) => f.group === "by" && initial[f.key] !== undefined).map((f) => (
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
        </fieldset>
      )}

      {kids.length > 0 && (
        <fieldset className="flex flex-col gap-3 rounded-2xl bg-white p-4">
          <legend className="float-left mb-1 text-xs font-extrabold tracking-wider text-ink/70 uppercase">Giờ ngủ (ngày “đạt” khi xong trước giờ này)</legend>
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
