"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays } from "@/lib/time";
import { normTime, PE_KEY, subjectKey, versionOn, type Period, type Session, type TimetableData, type TimetableVersion } from "@/lib/timetable/rules";
import { dayShort, PLACE_LABEL, sessionsText, SUBJECT_COLORS, subjectRows, type ExtraClass, type SubjectPref, type SubjectRow } from "@/lib/schedule/rules";
import { ExtraSheet } from "./extra-sheet";

export interface ScheduleInitial {
  today: string;
  versions: TimetableVersion[];
  extras: ExtraClass[];
  prefs: SubjectPref[];
  slots: { id: string; label: string }[];
}

type Tab = "tkb" | "them" | "mon";
const TABS: { id: Tab; label: string }[] = [
  { id: "tkb", label: "Thời khóa biểu" },
  { id: "them", label: "Học thêm" },
  { id: "mon", label: "Môn học" },
];

const DEFAULT_TIMES: TimetableData["times"] = { am: { "1": "07:30-08:15", "2": "08:20-09:05", "3": "09:20-10:05", "4": "10:10-10:55", "5": "11:00-11:45" } };
const DAYS = [1, 2, 3, 4, 5, 6] as const;
const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const cellKey = (day: number, session: Session, n: number) => `${day}-${session}-${n}`;
const cellLabel = (day: number, session: Session, n: number, subject: string) => `${dayShort(day)} ${session === "pm" ? "chiều " : ""}tiết ${n}: ${subject || "trống"}`;

/** A pale fill + dark text from a subject colour (#RRGGBB), for the grid. */
function tint(hex: string): { background: string; color: string } {
  return { background: `${hex}22`, color: hex };
}

function copyData(v: TimetableData | null): TimetableData {
  if (!v) return { label: "", note: "", periods: [], times: structuredClone(DEFAULT_TIMES), uniform: {} };
  return { label: v.label, note: v.note, periods: v.periods.map((p) => ({ ...p })), times: structuredClone(v.times), uniform: { ...v.uniform } };
}

/**
 * The child's schedule (21/11/2026, design canvas screens 2–4): a weekly timetable grid, extra
 * classes with clash warnings, and the subject list. Saving goes to /api/schedule/*; the screen
 * shows what the server answers.
 */
export function ScheduleEditor({ name, color, initial }: { name: string; color: string; initial: ScheduleInitial }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("tkb");
  const current = versionOn(data.versions, data.today);
  const rows = useMemo(() => subjectRows(current, data.extras, data.prefs), [current, data.extras, data.prefs]);
  const colorOf = (subject: string) => rows.find((r) => r.key === subjectKey(subject))?.color ?? "#5E6662";

  async function reload() {
    const r = await fetch("/api/schedule", { cache: "no-store" });
    if (r.ok) setData((await r.json()) as ScheduleInitial);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/today" className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-ink/65 hover:bg-white">
            ‹ Góc học tập
          </Link>
          <h1 className="text-2xl font-bold">Lịch học của {name}</h1>
        </div>
        <div role="tablist" aria-label="Các phần lịch học" className="flex gap-1 rounded-xl bg-ink/[0.07] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-11 rounded-lg px-3.5 font-semibold ${tab === t.id ? "bg-white text-ink shadow-sm" : "text-ink/65"}`}
            >
              {t.label}
              {t.id === "them" && data.extras.length > 0 ? ` (${data.extras.length})` : ""}
            </button>
          ))}
        </div>
      </div>

      {tab === "tkb" && <TimetableTab key={current?.id ?? "none"} today={data.today} current={current} rows={rows} colorOf={colorOf} color={color} onSaved={reload} />}
      {tab === "them" && <ExtrasTab data={data} current={current} rows={rows} color={color} onSaved={reload} />}
      {tab === "mon" && <SubjectsTab rows={rows} color={color} onSaved={reload} />}
    </div>
  );
}

// --- Thời khóa biểu ----------------------------------------------------------

function TimetableTab({
  today,
  current,
  rows,
  colorOf,
  color,
  onSaved,
}: {
  today: string;
  current: TimetableVersion | null;
  rows: SubjectRow[];
  colorOf: (s: string) => string;
  color: string;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<TimetableData>(() => copyData(current));
  const [validFrom, setValidFrom] = useState(current?.validFrom ?? today);
  const [sel, setSel] = useState<{ day: number; session: Session; n: number } | null>(null);
  const [other, setOther] = useState("");
  const [showPm, setShowPm] = useState(() => !!current && (current.periods.some((p) => p.session === "pm") || Object.keys(current.times.pm ?? {}).length > 0));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const original = useMemo(() => new Map((current?.periods ?? []).map((p) => [cellKey(p.day, p.session, p.n), p.subject])), [current]);
  const subjectAt = (day: number, session: Session, n: number) => draft.periods.find((p) => p.day === day && p.session === session && p.n === n)?.subject ?? "";
  const maxN = (session: Session) => Math.max(5, ...draft.periods.filter((p) => p.session === session).map((p) => p.n));
  const sessions: Session[] = showPm ? ["am", "pm"] : ["am"];
  const changed = (day: number, session: Session, n: number) => (original.get(cellKey(day, session, n)) ?? "") !== subjectAt(day, session, n);
  const changeCount = useMemo(() => {
    const keys = new Set([...original.keys(), ...draft.periods.map((p) => cellKey(p.day, p.session, p.n))]);
    return [...keys].filter((k) => {
      const [d, s, n] = k.split("-");
      return (original.get(k) ?? "") !== (draft.periods.find((p) => p.day === Number(d) && p.session === s && p.n === Number(n))?.subject ?? "");
    }).length;
  }, [original, draft.periods]);
  const badTimes = (["am", "pm"] as const).flatMap((s) => Object.entries(draft.times[s] ?? {}).filter(([, v]) => v.trim() !== "" && !normTime(v)));
  const minFrom = current?.validFrom ?? today;
  const maxFrom = addDays(today, 60);
  const picks = [...new Set([...rows.map((r) => r.label), ...draft.periods.map((p) => p.subject)])];

  function setSubject(subject: string) {
    if (!sel) return;
    const rest = draft.periods.filter((p) => !(p.day === sel.day && p.session === sel.session && p.n === sel.n));
    const next: Period[] = subject.trim() ? [...rest, { ...sel, subject: subject.trim().slice(0, 30) }] : rest;
    setDraft({ ...draft, periods: next });
    setMsg(null);
  }

  function setTime(session: Session, n: number, value: string) {
    const times = { ...draft.times, [session]: { ...(draft.times[session] ?? {}), [String(n)]: value } };
    if (!value.trim()) delete times[session]![String(n)];
    setDraft({ ...draft, times });
  }

  function setUniform(key: string, value: string) {
    const uniform = { ...draft.uniform, [key]: value };
    if (!value) delete uniform[key];
    setDraft({ ...draft, uniform });
  }

  async function save() {
    if (badTimes.length > 0) return setMsg({ ok: false, text: "Giờ tiết chưa đúng (vd 07:30-08:15)." });
    setBusy(true);
    setMsg(null);
    try {
      const times: TimetableData["times"] = {};
      for (const s of ["am", "pm"] as const) {
        const m = Object.fromEntries(Object.entries(draft.times[s] ?? {}).flatMap(([k, v]) => (v.trim() ? [[k, normTime(v) ?? v]] : [])));
        if (Object.keys(m).length > 0) times[s] = m;
      }
      const r = await fetch("/api/schedule/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validFrom, data: { ...draft, times } }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; changes?: string[] };
      if (!r.ok) return setMsg({ ok: false, text: d.error ?? "Không lưu được." });
      const first = d.changes?.[0];
      setMsg({ ok: true, text: `Đã lưu, áp dụng từ ${dmy(validFrom)}.${first ? ` ${first}${(d.changes?.length ?? 0) > 1 ? "…" : ""}.` : ""} Bố mẹ sẽ thấy trong Nhật ký.` });
      await onSaved();
    } catch {
      setMsg({ ok: false, text: "Mạng chập chờn, thử lại nhé." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-ink/10 bg-white px-4 py-3">
        <span className="text-sm">
          <b>Bản đang dùng:</b> {current ? `${current.label || "thời khóa biểu"} · áp dụng từ ${dmy(current.validFrom)}` : "chưa có — con nhập bản đầu tiên"}
        </span>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span>Áp dụng từ ngày</span>
          <input
            type="date"
            value={validFrom}
            min={minFrom}
            max={maxFrom}
            onChange={(e) => setValidFrom(e.target.value || minFrom)}
            className="min-h-11 rounded-lg border border-ink/20 px-2 text-base"
          />
        </label>
        <span className="text-xs text-ink/60">Trường đổi thời khóa biểu? Chọn ngày mới rồi lưu: bản cũ vẫn được giữ.</span>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <section aria-label="Thời khóa biểu tuần" className="min-w-0 flex-[999_1_620px] rounded-[20px] border border-ink/10 bg-white p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-1.5 text-sm">
              <thead>
                <tr>
                  <th className="w-24 text-left text-xs font-semibold text-ink/60">Tiết · giờ</th>
                  {DAYS.map((d) => (
                    <th key={d} scope="col" className="font-bold">
                      {dayShort(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.flatMap((session) =>
                  Array.from({ length: maxN(session) }, (_, i) => i + 1).map((n) => (
                    <tr key={`${session}${n}`}>
                      <th scope="row" className="text-left align-middle font-normal">
                        <span className="block text-xs font-bold">{`${session === "pm" ? "Chiều" : "Sáng"} ${n}`}</span>
                        <input
                          aria-label={`Giờ ${session === "pm" ? "chiều " : ""}tiết ${n}`}
                          value={draft.times[session]?.[String(n)] ?? ""}
                          placeholder="07:30-08:15"
                          onChange={(e) => setTime(session, n, e.target.value)}
                          className={`mt-0.5 w-24 rounded-md border px-1 py-0.5 text-xs tabular-nums ${(draft.times[session]?.[String(n)] ?? "").trim() && !normTime(draft.times[session]?.[String(n)] ?? "") ? "border-[#D07A12] bg-[#FFF4E8]" : "border-ink/15"}`}
                        />
                      </th>
                      {DAYS.map((day) => {
                        const subject = subjectAt(day, session, n);
                        const isSel = sel?.day === day && sel.session === session && sel.n === n;
                        const c = subject ? tint(colorOf(subject)) : null;
                        return (
                          <td key={day}>
                            <button
                              type="button"
                              aria-label={cellLabel(day, session, n, subject)}
                              aria-pressed={isSel}
                              onClick={() => setSel({ day, session, n })}
                              className={`flex min-h-12 w-full items-center justify-center rounded-xl px-1 text-center text-[13.5px] font-semibold ${subject ? "" : "border-[1.5px] border-dashed border-ink/15 text-ink/40"}`}
                              style={{
                                ...(c ?? {}),
                                outline: isSel ? `3px solid ${color}` : undefined,
                                outlineOffset: isSel ? 1 : undefined,
                                boxShadow: changed(day, session, n) ? "inset 0 0 0 2px #D07A12" : undefined,
                              }}
                            >
                              {subject || "—"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3 text-sm text-ink/65">
            <span>Bấm một tiết để đổi môn. Tiết đã sửa có viền cam.</span>
            {!showPm && (
              <button type="button" onClick={() => setShowPm(true)} className="min-h-11 rounded-xl border border-ink/20 px-3 font-semibold text-ink">
                + Buổi chiều
              </button>
            )}
          </div>
        </section>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <div role="group" aria-label="Chọn môn" className="flex flex-col gap-2.5 rounded-[20px] border-2 bg-white p-4" style={{ borderColor: color }}>
            <span className="text-xs font-bold" style={{ color }}>
              ĐANG SỬA
            </span>
            <h2 className="text-lg font-bold">{sel ? cellLabel(sel.day, sel.session, sel.n, subjectAt(sel.day, sel.session, sel.n)) : "Chọn một tiết trong bảng"}</h2>
            {sel && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {picks.map((s) => {
                    const on = s === subjectAt(sel.day, sel.session, sel.n);
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSubject(s)}
                        className="min-h-11 rounded-xl px-3 text-sm font-semibold"
                        style={on ? { background: color, color: "#fff" } : tint(colorOf(s))}
                      >
                        {s}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => setSubject("")} className="min-h-11 rounded-xl border border-dashed border-ink/30 px-3 text-sm font-semibold text-ink/65">
                    Ô trống
                  </button>
                </div>
                <div className="flex gap-2">
                  <label className="sr-only" htmlFor="mon-khac">
                    Môn khác
                  </label>
                  <input
                    id="mon-khac"
                    value={other}
                    maxLength={30}
                    placeholder="Môn khác…"
                    onChange={(e) => setOther(e.target.value)}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-ink/20 px-3 text-base"
                  />
                  <button
                    type="button"
                    disabled={!other.trim()}
                    onClick={() => {
                      setSubject(other);
                      setOther("");
                    }}
                    className="min-h-11 rounded-xl border border-ink/25 px-3 font-semibold disabled:opacity-40"
                  >
                    Thêm
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-[20px] border border-ink/10 bg-white p-4">
            <h2 className="font-bold">Đồng phục theo thứ</h2>
            {DAYS.map((d) => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <span className="w-9 shrink-0 font-bold">{dayShort(d)}</span>
                <input
                  aria-label={`Đồng phục ${dayShort(d)}`}
                  value={draft.uniform[String(d)] ?? ""}
                  maxLength={160}
                  onChange={(e) => setUniform(String(d), e.target.value)}
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-ink/15 px-2 text-base"
                />
              </label>
            ))}
            <label className="mt-1 flex flex-col gap-1 text-sm">
              <span className="font-bold">Ngày có Thể dục mặc</span>
              <input
                aria-label="Ngày có Thể dục mặc"
                value={draft.uniform[PE_KEY] ?? ""}
                maxLength={160}
                onChange={(e) => setUniform(PE_KEY, e.target.value)}
                className="min-h-10 rounded-lg border border-ink/15 px-2 text-base"
              />
              <span className="text-xs text-ink/60">Để trống nếu đồng phục không đổi theo môn Thể dục.</span>
            </label>
          </div>

          <div className="flex flex-col gap-2 rounded-[20px] border border-[#EED9B4] bg-[#FFF8EC] p-4">
            <span className="font-bold">Lưu là dùng ngay</span>
            <span className="text-sm text-ink/75">Bố mẹ thấy mỗi lần sửa trong Nhật ký và khôi phục được bản trước.</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="mt-1 min-h-12 rounded-xl bg-accent font-bold text-white disabled:opacity-50"
            >
              Lưu thời khóa biểu{changeCount > 0 ? ` (${changeCount} tiết đổi)` : ""}
            </button>
            {msg && (
              <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-accent" : "text-[#8A4A07]"}`}>
                {msg.text}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// --- Học thêm ------------------------------------------------------------------

function ExtrasTab({
  data,
  current,
  rows,
  color,
  onSaved,
}: {
  data: ScheduleInitial;
  current: TimetableVersion | null;
  rows: SubjectRow[];
  color: string;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<ExtraClass | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const slotLabel = (id: string | null) => data.slots.find((s) => s.id === id)?.label ?? null;

  async function off(e: ExtraClass) {
    if (!window.confirm(`Bỏ học thêm ${e.subject} (${sessionsText(e.sessions)})? Bố mẹ vẫn khôi phục được.`)) return;
    setMsg(null);
    const r = await fetch(`/api/schedule/extra?id=${e.id}`, { method: "DELETE" });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return setMsg({ ok: false, text: d.error ?? "Không bỏ được." });
    setMsg({ ok: true, text: `Đã bỏ học thêm ${e.subject}.` });
    await onSaved();
  }

  return (
    <section aria-label="Học thêm" className="flex flex-col gap-3 rounded-[20px] border border-ink/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Học thêm và gia sư</h2>
          <p className="text-sm text-ink/65">Hiện trong Lịch của con và thẻ Ngày mai. Không thành bài tập, không đổi giờ khóa máy.</p>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="min-h-11 rounded-xl px-4 font-bold text-white" style={{ background: color }}>
          + Học thêm
        </button>
      </div>
      {data.extras.length === 0 ? (
        <p className="rounded-xl bg-bg p-3 text-sm text-ink/70">Chưa có buổi học thêm nào. Bấm “+ Học thêm” để nhập.</p>
      ) : (
        <ul aria-label="Học thêm của con" className="flex flex-col">
          {data.extras.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 py-3 first:border-t-0">
              <div className="flex min-w-0 flex-col">
                <span className="font-bold">{e.subject}</span>
                <span className="text-sm text-ink/75">
                  {sessionsText(e.sessions)} · {PLACE_LABEL[e.place]}
                </span>
                {(e.bring || slotLabel(e.appSlotId)) && (
                  <span className="text-xs text-ink/60">{[e.bring && `Mang: ${e.bring}`, slotLabel(e.appSlotId) && `Cô giao bài ở: ${slotLabel(e.appSlotId)}`].filter(Boolean).join(" · ")}</span>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" aria-label={`Sửa học thêm ${e.subject}`} onClick={() => setEditing(e)} className="min-h-11 rounded-xl border border-ink/20 px-3 font-semibold">
                  Sửa
                </button>
                <button type="button" aria-label={`Bỏ học thêm ${e.subject}`} onClick={() => void off(e)} className="min-h-11 rounded-xl border border-ink/20 px-3 font-semibold text-[#8E2F1D]">
                  Bỏ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-accent" : "text-[#8A4A07]"}`}>
          {msg.text}
        </p>
      )}
      {editing && (
        <ExtraSheet
          extra={editing === "new" ? null : editing}
          current={current}
          extras={data.extras}
          subjects={rows.map((r) => r.label)}
          slots={data.slots}
          color={color}
          onClose={() => setEditing(null)}
          onSaved={async (text) => {
            setEditing(null);
            setMsg({ ok: true, text });
            await onSaved();
          }}
        />
      )}
    </section>
  );
}

// --- Môn học --------------------------------------------------------------------

function SubjectsTab({ rows, color, onSaved }: { rows: SubjectRow[]; color: string; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState<Record<string, { color: string; bring: string }>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const val = (r: SubjectRow) => draft[r.key] ?? { color: r.color, bring: r.bring };

  async function save(r: SubjectRow) {
    setMsg(null);
    const v = val(r);
    const res = await fetch("/api/schedule/subject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: r.key, label: r.label, color: v.color, bring: v.bring }),
    });
    if (!res.ok) return setMsg({ ok: false, text: "Không lưu được môn này." });
    setMsg({ ok: true, text: `Đã lưu môn ${r.label}.` });
    await onSaved();
  }

  return (
    <section aria-label="Môn học" className="flex flex-col gap-3 rounded-[20px] border border-ink/10 bg-white p-4">
      <div>
        <h2 className="text-lg font-bold">Môn học của con · {rows.length} môn</h2>
        <p className="text-sm text-ink/65">Lấy từ thời khóa biểu và học thêm. Mặc định mọi môn: sách + vở. Ghi thêm đồ riêng (vd Thể dục: giày thể thao).</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-bg p-3 text-sm text-ink/70">Nhập thời khóa biểu trước, danh sách môn sẽ tự có.</p>
      ) : (
        <ul aria-label="Môn học của con" className="flex flex-col">
          {rows.map((r) => {
            const v = val(r);
            return (
              <li key={r.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/10 py-3 first:border-t-0">
                <span className="flex min-w-40 items-center gap-2 font-bold">
                  <span aria-hidden className="size-3.5 shrink-0 rounded" style={{ background: v.color }} />
                  {r.label}
                </span>
                <span className="w-24 text-sm text-ink/65 tabular-nums">
                  {r.perWeek} tiết/tuần
                  {r.extraDays.length > 0 && (
                    <span className="block font-semibold" style={{ color }}>
                      Học thêm: {r.extraDays.map(dayShort).join(", ")}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap gap-1">
                  {SUBJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Màu ${c} cho ${r.label}`}
                      aria-pressed={v.color === c}
                      onClick={() => setDraft({ ...draft, [r.key]: { ...v, color: c } })}
                      className="size-7 rounded-md"
                      style={{ background: c, outline: v.color === c ? "2px solid #1C1F1D" : undefined, outlineOffset: 2 }}
                    />
                  ))}
                </span>
                <input
                  aria-label={`Cần mang: ${r.label}`}
                  value={v.bring}
                  maxLength={120}
                  placeholder="Cần mang thêm…"
                  onChange={(e) => setDraft({ ...draft, [r.key]: { ...v, bring: e.target.value } })}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-ink/20 px-3 text-base"
                />
                <button type="button" aria-label={`Lưu môn ${r.label}`} onClick={() => void save(r)} className="min-h-11 rounded-xl border border-ink/25 px-3 font-semibold">
                  Lưu
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {msg && (
        <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-accent" : "text-[#8A4A07]"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
