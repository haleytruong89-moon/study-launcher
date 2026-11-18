"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DAY_NAMES, parseQuick, toQuick, versionOn, type TimetableData, type TimetableVersion } from "@/lib/timetable/rules";

const BLANK = `LỚP:
GHI CHÚ:
#   giờ          | T2 | T3 | T4 | T5 | T6 | T7
S1 07:30-08:15 |  |  |  |  |  |
S2 08:20-09:05 |  |  |  |  |  |
S3 09:20-10:05 |  |  |  |  |  |
S4 10:10-10:55 |  |  |  |  |  |
S5 11:00-11:45 |  |  |  |  |  |
`;

const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** One child's timetable: versions, a preview grid, and the quick-text editor (parents only). */
export function TimetableEditor({ child, versions, today }: { child: { id: string; name: string; color: string }; versions: TimetableVersion[]; today: string }) {
  const router = useRouter();
  const current = versionOn(versions, today);
  const [open, setOpen] = useState(versions.length === 0);
  const [validFrom, setValidFrom] = useState(today);
  const [text, setText] = useState(current ? toQuick(current) : BLANK);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const parsed = parseQuick(text);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/timetables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: child.id, validFrom, text }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return setMsg(d.error ?? "Không lưu được.");
      setMsg(`Đã lưu, áp dụng từ ${dmy(validFrom)}.`);
      setOpen(false);
      router.refresh();
    } catch {
      setMsg("Mất kết nối, thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (armed !== id) return setArmed(id);
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/timetables?id=${id}`, { method: "DELETE" });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      setMsg(r.ok ? "Đã xóa bản đó." : (d.error ?? "Không xóa được."));
      setArmed(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={`Thời khóa biểu của ${child.name}`} className="overflow-hidden rounded-2xl bg-white">
      <h2 className="px-4 py-3 text-lg font-extrabold text-white" style={{ background: child.color }}>
        {child.name}
        {current?.label ? ` · ${current.label}` : ""}
      </h2>
      <div className="flex flex-col gap-4 p-4">
        {versions.length > 0 && (
          <ul aria-label="Các bản thời khóa biểu" className="flex flex-col gap-1 text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex min-h-11 items-center justify-between gap-2 border-t border-ink/10 first:border-t-0">
                <span>
                  Từ <b>{dmy(v.validFrom)}</b>
                  {v.label ? ` · ${v.label}` : ""} · {v.periods.length} tiết
                  {v.id === current?.id ? <span className="ml-1 rounded-full bg-[#E6F3EC] px-2 py-0.5 text-xs font-bold text-[#1F6B45]">đang áp dụng</span> : null}
                  {v.validFrom > today ? <span className="ml-1 rounded-full bg-[#FFF4E5] px-2 py-0.5 text-xs font-bold">sắp áp dụng</span> : null}
                </span>
                <button type="button" disabled={busy} onClick={() => void remove(v.id)} className="min-h-11 px-2 text-sm font-semibold text-[#A3341F] underline">
                  {armed === v.id ? "Bấm lần nữa để xóa" : "Xóa"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {current && !open && <Grid data={current} />}
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="btn self-start border-2 border-ink bg-white font-semibold">
            {versions.length > 0 ? "Sửa / thêm bản mới" : "Nhập thời khóa biểu"}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Áp dụng từ ngày
              <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="min-h-11 rounded-xl border border-ink/30 px-3 text-base" />
              <span className="text-xs font-normal text-ink/65">Cùng ngày với một bản đã có thì bản đó được thay. Ngày khác thì thêm bản mới.</span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Thời khóa biểu (dán nhanh)
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                spellCheck={false}
                className="rounded-xl border border-ink/30 p-3 font-mono text-[13px] leading-relaxed"
              />
              <span className="text-xs font-normal text-ink/65">
                Mỗi dòng một tiết: <code>S1</code>…<code>S5</code> buổi sáng, <code>C1</code>…<code>C5</code> buổi chiều, có thể kèm giờ, rồi 6 ô Thứ 2 … Thứ 7 cách nhau bằng dấu |. Thêm
                dòng <code>ĐỒNG PHỤC T2: …</code> nếu muốn.
              </span>
            </label>
            {parsed.ok ? (
              <Grid data={parsed.data} />
            ) : (
              <ul aria-label="Lỗi" className="flex flex-col gap-0.5 text-sm text-[#A3341F]">
                {parsed.errors.slice(0, 5).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || !parsed.ok} onClick={() => void save()} className="btn bg-ink font-semibold text-white disabled:opacity-50">
                {busy ? "Đang lưu…" : "Lưu thời khóa biểu"}
              </button>
              {versions.length > 0 && (
                <button type="button" onClick={() => setOpen(false)} className="btn font-semibold underline">
                  Thôi
                </button>
              )}
            </div>
          </div>
        )}
        {msg && (
          <p role="status" className="text-sm font-semibold">
            {msg}
          </p>
        )}
      </div>
    </section>
  );
}

/** A preview of the week: rows = periods, columns = Thứ 2 … Thứ 7; uniform under it. */
function Grid({ data }: { data: TimetableData }) {
  const rows = (["am", "pm"] as const).flatMap((session) =>
    [...new Set(data.periods.filter((p) => p.session === session).map((p) => p.n))].sort((a, b) => a - b).map((n) => ({ session, n })),
  );
  const days = [1, 2, 3, 4, 5, 6].filter((d) => d < 6 || data.periods.some((p) => p.day === 6));
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left">Tiết</th>
              {days.map((d) => (
                <th key={d} className="p-1 text-left">
                  {DAY_NAMES[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ session, n }) => (
              <tr key={`${session}${n}`} className="border-t border-ink/10">
                <th scope="row" className="p-1 text-left font-semibold whitespace-nowrap">
                  {session === "am" ? "Sáng" : "Chiều"} {n}
                  {data.times[session]?.[String(n)] ? <span className="block font-normal text-ink/60">{data.times[session]?.[String(n)]}</span> : null}
                </th>
                {days.map((d) => (
                  <td key={d} className="p-1">
                    {data.periods.find((p) => p.session === session && p.n === n && p.day === d)?.subject ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {Object.keys(data.uniform).length > 0 && (
        <ul aria-label="Đồng phục" className="flex flex-col gap-0.5 text-xs text-ink/80">
          {Object.entries(data.uniform).map(([d, u]) => (
            <li key={d}>
              <b>{DAY_NAMES[Number(d)]}:</b> {u}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
