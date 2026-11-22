"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QUICK_EXTRAS_HEADER, parseQuickExtras, type SlotChoice } from "@/lib/schedule/quickExtras";
import { PLACE_LABEL, sessionsText, type ExtraClass } from "@/lib/schedule/rules";
import { fold } from "@/lib/timetable/rules";

/**
 * "Học thêm của …" on the parent's Thời khóa biểu page (22/11/2026): the list, plus "Dán học thêm"
 * — the parent pastes the whole list (one line per subject) instead of the child typing each class.
 * The box starts with the current list, so editing a line and saving updates it; a subject left out
 * is turned off. The child still edits in Sửa lịch học.
 */
export function ExtraPaste({ child, extras, slots, initialText }: { child: { id: string; name: string }; extras: ExtraClass[]; slots: SlotChoice[]; initialText: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);
  const parsed = parseQuickExtras(text, slots);
  const slotName = (id: string | null) => (id ? (slots.find((s) => s.id === id)?.label ?? null) : null);

  async function pasteFromClipboard() {
    setPasteMsg(null);
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) return setPasteMsg("Bộ nhớ tạm đang trống: hãy sao chép danh sách học thêm trước.");
      setText(t.trim());
    } catch {
      setPasteMsg("Máy không cho dán tự động: chạm giữ trong ô, chọn “Chọn tất cả” rồi “Dán”.");
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/schedule/extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: child.id, text }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; added?: number; updated?: number; off?: number };
      if (!r.ok) return setMsg(d.error ?? "Không lưu được.");
      const parts = [d.added ? `thêm ${d.added}` : "", d.updated ? `cập nhật ${d.updated}` : "", d.off ? `bỏ ${d.off}` : ""].filter(Boolean);
      setMsg(`Đã lưu học thêm của ${child.name}${parts.length ? `: ${parts.join(", ")} môn` : ""}.`);
      setOpen(false);
      router.refresh();
    } catch {
      setMsg("Mất kết nối, thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const willOff = parsed.ok ? extras.filter((x) => !parsed.classes.some((c) => fold(c.subject) === fold(x.subject))).map((x) => x.subject) : [];

  return (
    <section aria-label={`Học thêm của ${child.name}`} className="flex flex-col gap-2 rounded-2xl bg-white p-4">
      <h3 className="font-bold">Học thêm của {child.name}</h3>
      {extras.length === 0 ? (
        <p className="text-sm text-ink/70">Chưa có. Bố mẹ dán danh sách bên dưới, hoặc con tự nhập ở Sửa lịch học.</p>
      ) : (
        <ul className="flex flex-col text-sm">
          {extras.map((x) => (
            <li key={x.id} className="border-t border-ink/10 py-1.5 first:border-t-0">
              <b>{x.subject}</b> · {sessionsText(x.sessions)} · {PLACE_LABEL[x.place]}
              {slotName(x.appSlotId) && <span className="block text-xs text-ink/65">Cô giao bài ở: {slotName(x.appSlotId)}</span>}
              {x.bring && <span className="block text-xs text-ink/65">Mang: {x.bring}</span>}
            </li>
          ))}
        </ul>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => {
            // Start from the list as it is now (after a save the page has reloaded it).
            setText(initialText);
            setMsg(null);
            setOpen(true);
          }}
          className="btn self-start border-2 border-ink bg-white font-semibold"
        >
          {extras.length > 0 ? "Sửa bằng cách dán" : "Dán học thêm"}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void pasteFromClipboard()} className="btn bg-ink font-semibold text-white">
              📋 Dán học thêm đã sao chép
            </button>
            <button type="button" onClick={() => setText(QUICK_EXTRAS_HEADER)} className="btn border-2 border-ink bg-white font-semibold">
              Xóa ô
            </button>
          </div>
          {pasteMsg && <p className="text-sm text-[#A3341F]">{pasteMsg}</p>}
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Học thêm (dán nhanh)
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              spellCheck={false}
              className="rounded-xl border border-ink/30 p-3 font-mono text-[13px] leading-relaxed"
            />
            <span className="text-xs font-normal text-ink/65">
              Mỗi dòng một môn: <code>Môn | Buổi | Ở đâu | Cô giao bài ở | Cần mang</code>. Buổi ghi thứ rồi giờ, vd <code>T3 13:30-15:30; T5 14:30-16:30</code>. Ở đâu: Ở nhà,
              Trung tâm hoặc Online (bỏ trống = Trung tâm). Cô giao bài ở: tên app của con
              {slots.length > 0 ? ` (${slots.map((s) => s.label).join(", ")})` : ""}, bỏ trống nếu không có.
            </span>
          </label>
          {parsed.ok ? (
            <ul aria-label="Xem trước" className="flex flex-col rounded-xl bg-[#F4F5F0] p-3 text-sm">
              {parsed.classes.length === 0 && <li className="text-ink/70">Chưa có môn nào.</li>}
              {parsed.classes.map((c) => (
                <li key={c.subject}>
                  <b>{c.subject}</b> · {sessionsText(c.sessions)} · {PLACE_LABEL[c.place]}
                  {slotName(c.appSlotId) ? ` · giao bài ở ${slotName(c.appSlotId)}` : ""}
                  {c.bring ? ` · mang ${c.bring}` : ""}
                </li>
              ))}
              {willOff.length > 0 && <li className="mt-1 font-semibold text-[#A3341F]">Sẽ bỏ: {willOff.join(", ")} (không có trong danh sách).</li>}
            </ul>
          ) : (
            <ul aria-label="Lỗi" className="flex flex-col gap-0.5 text-sm text-[#A3341F]">
              {parsed.errors.slice(0, 5).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !parsed.ok} onClick={() => void save()} className="btn bg-ink font-semibold text-white disabled:opacity-50">
              {busy ? "Đang lưu…" : "Lưu học thêm"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn font-semibold underline">
              Thôi
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p role="status" className="text-sm font-semibold">
          {msg}
        </p>
      )}
    </section>
  );
}
