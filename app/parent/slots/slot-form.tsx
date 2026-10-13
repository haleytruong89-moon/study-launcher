"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { sendJson } from "@/lib/api-client";

export interface SlotValues {
  id?: string;
  childId: string | null;
  subject: string;
  kind: "internal" | "external" | "placeholder";
  label: string;
  url: string;
  allowDomains: string[];
  active: boolean;
}

const KINDS: { value: SlotValues["kind"]; label: string; hint: string }[] = [
  { value: "internal", label: "App nhà mình", hint: "Vd App Toán" },
  { value: "external", label: "App bên ngoài", hint: "Trang học của bên khác" },
  { value: "placeholder", label: "Đang xây", hint: "Hiện cho con biết, không tính vào việc" },
];

export const EMPTY_SLOT: SlotValues = { childId: null, subject: "", kind: "external", label: "", url: "", allowDomains: [], active: true };

export function SlotForm({ initial, kids, submitLabel }: { initial: SlotValues; kids: { id: string; name: string }[]; submitLabel: string }) {
  const router = useRouter();
  const uid = useId();
  const [v, setV] = useState(initial);
  const [domains, setDomains] = useState(initial.allowDomains.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    const body = {
      childId: v.childId,
      subject: v.subject,
      kind: v.kind,
      label: v.label,
      url: v.url.trim() || null,
      allowDomains: domains
        .split(/[\s,]+/)
        .map((d) => d.trim())
        .filter(Boolean),
      active: v.active,
    };
    const err = initial.id
      ? await sendJson("PATCH", `/api/admin/slots/${initial.id}`, body)
      : await sendJson("POST", "/api/admin/slots", body);
    setBusy(false);
    if (err) return setError(err);
    setSaved(true);
    if (!initial.id) {
      setV(EMPTY_SLOT);
      setDomains("");
    }
    router.refresh();
  }

  const input = "min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base font-normal";
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Dành cho
        <select value={v.childId ?? ""} onChange={(e) => setV({ ...v, childId: e.target.value || null })} className={input}>
          <option value="">Cả nhà</option>
          {kids.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Môn
        <input required maxLength={40} value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} className={input} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Loại</legend>
        {KINDS.map((k) => (
          <label key={k.value} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="radio"
              name={`${uid}-kind`}
              value={k.value}
              checked={v.kind === k.value}
              onChange={() => setV({ ...v, kind: k.value })}
              className="size-5"
            />
            <span>
              <span className="font-semibold">{k.label}</span> <span className="text-ink/60">· {k.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Tên hiển thị
        <input required maxLength={80} value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Địa chỉ app
        <input
          type="url"
          inputMode="url"
          placeholder="https://"
          required={v.kind !== "placeholder"}
          value={v.url}
          onChange={(e) => setV({ ...v, url: e.target.value })}
          className={input}
        />
        <span className="text-xs font-normal text-ink/60">Tên miền của địa chỉ này tự được mở khi máy đang khóa.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Tên miền khác cần mở (mỗi dòng 1 tên, tùy chọn)
        <textarea rows={2} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="vd: cdn.example.com" className={`${input} py-2`} />
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
