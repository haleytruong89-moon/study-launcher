"use client";

import { useEffect, useRef, useState } from "react";
import type { TimetableVersion } from "@/lib/timetable/rules";
import { cleanSessions, conflicts, dayShort, extraBusy, MAX_SESSIONS, PLACE_LABEL, PLACES, schoolBusy, sessionsText, type ExtraClass, type Place } from "@/lib/schedule/rules";

type Row = { day: number; start: string; end: string };

/**
 * Add / edit one extra class (21/11/2026, design canvas screen 3). Clashes with school or another
 * extra class are shown while typing (warning only: the child checks the time and may still save).
 */
export function ExtraSheet({
  extra,
  current,
  extras,
  subjects,
  slots,
  color,
  onClose,
  onSaved,
}: {
  extra: ExtraClass | null;
  current: TimetableVersion | null;
  extras: ExtraClass[];
  subjects: string[];
  slots: { id: string; label: string }[];
  color: string;
  onClose: () => void;
  onSaved: (text: string) => Promise<void>;
}) {
  const [subject, setSubject] = useState(extra?.subject ?? "");
  const [rows, setRows] = useState<Row[]>(extra?.sessions.map((s) => ({ ...s })) ?? [{ day: 1, start: "", end: "" }]);
  const [place, setPlace] = useState<Place>(extra?.place ?? "home");
  const [bring, setBring] = useState(extra?.bring ?? "");
  const [note, setNote] = useState(extra?.note ?? "");
  const [slot, setSlot] = useState<string>(extra?.appSlotId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const busySpans = [...schoolBusy(current), ...extraBusy(extras, extra?.id)];
  /** Clash text for one row (null = fine, "" = not complete yet). */
  function rowNote(r: Row): { clash: boolean; text: string } | null {
    const one = cleanSessions([r]);
    if (typeof one === "string") return null;
    const c = conflicts(one, busySpans)[0];
    return c ? { clash: true, text: `Trùng giờ ${c.with.label.toLowerCase()} (${c.with.start}–${c.with.end}). Con kiểm lại giờ nhé.` } : { clash: false, text: "Không trùng giờ học ở trường." };
  }

  function setRow(i: number, patch: Partial<Row>) {
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setError(null);
  }

  async function save() {
    const sessions = cleanSessions(rows);
    if (!subject.trim()) return setError("Chọn hoặc gõ tên môn.");
    if (typeof sessions === "string") return setError(sessions);
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/schedule/extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: extra?.id, subject: subject.trim(), sessions, place, bring, note, appSlotId: slot || null }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; conflicts?: unknown[] };
      if (!r.ok) return setError(d.error ?? "Không lưu được.");
      const clash = (d.conflicts?.length ?? 0) > 0 ? " Có buổi trùng giờ, con kiểm lại nhé." : "";
      await onSaved(`Đã lưu học thêm ${subject.trim()}: ${sessionsText(sessions)}.${clash}`);
    } catch {
      setError("Mạng chập chờn, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Học thêm"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-[560px] flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold">{extra ? `Sửa học thêm ${extra.subject}` : "Thêm học thêm"}</h2>
          <button type="button" aria-label="Đóng" onClick={onClose} className="grid size-11 place-items-center rounded-xl border border-ink/15">
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Môn</span>
          <input
            ref={first}
            value={subject}
            maxLength={30}
            list="mon-hoc-them"
            onChange={(e) => setSubject(e.target.value)}
            className="min-h-11 rounded-xl border border-ink/20 px-3 text-base"
          />
          <datalist id="mon-hoc-them">
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Các buổi trong tuần</legend>
          {rows.map((r, i) => {
            const n = rowNote(r);
            const suffix = i === 0 ? "" : ` (buổi ${i + 1})`;
            return (
              <div
                key={i}
                className="flex flex-col gap-1.5 rounded-xl p-3"
                style={n?.clash ? { background: "#FFF4E8", border: "1.5px solid #D07A12" } : { background: "#F4F5F0", border: "1.5px solid transparent" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label={`Thứ${suffix}`} value={r.day} onChange={(e) => setRow(i, { day: Number(e.target.value) })} className="min-h-11 rounded-lg border border-ink/20 bg-white px-2 text-base">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {dayShort(d)}
                      </option>
                    ))}
                  </select>
                  <input aria-label={`Bắt đầu${suffix}`} value={r.start} placeholder="15:30" onChange={(e) => setRow(i, { start: e.target.value })} className="min-h-11 w-24 rounded-lg border border-ink/20 bg-white px-2 text-base tabular-nums" />
                  <span>–</span>
                  <input aria-label={`Kết thúc${suffix}`} value={r.end} placeholder="17:00" onChange={(e) => setRow(i, { end: e.target.value })} className="min-h-11 w-24 rounded-lg border border-ink/20 bg-white px-2 text-base tabular-nums" />
                  {rows.length > 1 && (
                    <button type="button" aria-label={`Bỏ buổi ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="ml-auto min-h-11 rounded-lg px-2 text-sm text-ink/60">
                      Bỏ buổi
                    </button>
                  )}
                </div>
                {n && <span className={`text-sm font-semibold ${n.clash ? "text-[#8A4A07]" : "text-accent"}`}>{n.text}</span>}
              </div>
            );
          })}
          {rows.length < MAX_SESSIONS && (
            <button type="button" onClick={() => setRows([...rows, { day: rows.at(-1)?.day ?? 1, start: "", end: "" }])} className="min-h-11 self-start rounded-xl px-2 font-semibold" style={{ color }}>
              + Thêm buổi
            </button>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Học ở đâu</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {PLACES.map((p) => (
              <label key={p} className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold" style={place === p ? { background: color, color: "#fff" } : { background: "#F4F5F0" }}>
                <input type="radio" name="noi-hoc" value={p} checked={place === p} onChange={() => setPlace(p)} className="sr-only" />
                {PLACE_LABEL[p]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Cần mang (hiện ở thẻ Ngày mai)</span>
          <input value={bring} maxLength={120} onChange={(e) => setBring(e.target.value)} placeholder="Vở học thêm, bài cô giao…" className="min-h-11 rounded-xl border border-ink/20 px-3 text-base" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Cô giao bài ở</span>
          <select value={slot} onChange={(e) => setSlot(e.target.value)} className="min-h-11 rounded-xl border border-ink/20 bg-white px-2 text-base">
            <option value="">Không</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink/60">Bài trên app này sẽ được nhắc làm trước buổi học.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Ghi chú</span>
          <input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="vd: học cùng chị, cô đến nhà" className="min-h-11 rounded-xl border border-ink/20 px-3 text-base" />
        </label>

        {error && (
          <p role="alert" className="text-sm font-semibold text-[#8A4A07]">
            {error}
          </p>
        )}
        <button type="button" disabled={busy} onClick={() => void save()} className="min-h-12 rounded-xl font-bold text-white disabled:opacity-50" style={{ background: color }}>
          Lưu học thêm
        </button>
        <p className="text-center text-xs text-ink/60">Học thêm chỉ hiện trong lịch. Không thành bài tập, không đổi giờ khóa máy.</p>
      </div>
    </div>
  );
}
