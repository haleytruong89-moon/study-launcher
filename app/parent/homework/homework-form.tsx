"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sendJson } from "@/lib/api-client";
import { MAX_HOMEWORK_PHOTOS } from "@/lib/admin/schemas";
import { compressImage } from "@/lib/images";
import { SUBJECTS, shortDate } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/client";

interface Kid {
  id: string;
  name: string;
  color: string | null;
}

interface Photo {
  key: string;
  file: File;
  preview: string;
}

type Due = "today" | "tomorrow" | "pick";
const OTHER = "Khác";

function chipClass(on: boolean) {
  return on ? "border-ink bg-ink text-white" : "border-ink/30 bg-white text-ink";
}

/**
 * Mockup "Giao bài tập": child -> subject -> due date -> photos -> note -> one button.
 * Photos are compressed in the browser (<= 1600 px, JPEG 0.8), uploaded to the private
 * `homework` bucket with the parent's own session, then the item is created on the server.
 */
export function HomeworkForm({ familyId, today, tomorrow, kids }: { familyId: string; today: string; tomorrow: string; kids: Kid[] }) {
  const router = useRouter();
  const [kidId, setKidId] = useState(kids[0]?.id ?? "");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [otherSubject, setOtherSubject] = useState("");
  const [due, setDue] = useState<Due>("tomorrow");
  const [pickedDate, setPickedDate] = useState(tomorrow);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const photosRef = useRef<Photo[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // Release preview URLs when the form unmounts.
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const kid = kids.find((k) => k.id === kidId);
  const subjectName = subject === OTHER ? otherSubject.trim() : subject;
  const dueDate = due === "today" ? today : due === "tomorrow" ? tomorrow : pickedDate;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_HOMEWORK_PHOTOS - photos.length;
    const added = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(0, room))
      .map((file) => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
    setPhotos((p) => [...p, ...added]);
    if (list.length > room) setError(`Tối đa ${MAX_HOMEWORK_PHOTOS} ảnh mỗi bài.`);
  }

  function removePhoto(key: string) {
    setPhotos((list) => {
      const p = list.find((x) => x.key === key);
      if (p) URL.revokeObjectURL(p.preview);
      return list.filter((x) => x.key !== key);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(null);
    if (!kid) return setError("Chọn con trước.");
    if (!subjectName) return setError("Nhập tên môn.");
    if (dueDate < today) return setError("Ngày phải nộp phải từ hôm nay trở đi.");
    if (photos.length === 0 && !note.trim()) return setError("Cần ít nhất 1 ảnh hoặc ghi chú.");

    const supabase = createClient();
    const paths: string[] = [];
    try {
      for (const [n, p] of photos.entries()) {
        setBusy(`Đang nén và tải ảnh ${n + 1}/${photos.length}…`);
        const blob = await compressImage(p.file);
        const path = `${familyId}/${kid.id}/${dueDate}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from("homework").upload(path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });
        if (upErr) throw new Error(upErr.message);
        paths.push(path);
      }
    } catch (e) {
      console.error("homework upload failed", e);
      setBusy(null);
      return setError("Không tải được ảnh lên. Kiểm tra mạng rồi thử lại.");
    }

    setBusy("Đang giao bài…");
    const err = await sendJson("POST", "/api/admin/homework", {
      childId: kid.id,
      subject: subjectName,
      dueDate,
      note: note.trim() || null,
      photoPaths: paths,
    });
    setBusy(null);
    if (err) return setError(err);

    setDone(`Đã giao ${subjectName} cho ${kid.name} · nộp ${dueDate === today ? "hôm nay" : shortDate(dueDate)}${paths.length ? ` (${paths.length} ảnh)` : ""}`);
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-label="Giao bài tập">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">Cho con nào</legend>
        <div className="grid grid-cols-2 gap-2">
          {kids.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={k.id === kidId}
              onClick={() => setKidId(k.id)}
              className="min-h-12 rounded-xl border-2 font-bold"
              style={
                k.id === kidId
                  ? { background: k.color ?? "#1c1f1d", borderColor: k.color ?? "#1c1f1d", color: "#fff" }
                  : { background: "#fff", borderColor: "#b9beb6" }
              }
            >
              {k.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">Môn</legend>
        <div className="flex flex-wrap gap-2">
          {[...SUBJECTS, OTHER].map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === subject}
              onClick={() => setSubject(s)}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${chipClass(s === subject)}`}
            >
              {s}
            </button>
          ))}
        </div>
        {subject === OTHER && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tên môn
            <input
              value={otherSubject}
              onChange={(e) => setOtherSubject(e.target.value)}
              maxLength={40}
              className="min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base"
            />
          </label>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">Ngày phải nộp</legend>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["today", "Hôm nay", shortDate(today)],
              ["tomorrow", "Ngày mai", shortDate(tomorrow)],
              ["pick", "Chọn ngày", due === "pick" ? shortDate(pickedDate) : "…"],
            ] as const
          ).map(([value, name, date]) => (
            <button
              key={value}
              type="button"
              aria-pressed={due === value}
              onClick={() => setDue(value)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-xl border text-sm leading-tight font-semibold ${chipClass(due === value)}`}
            >
              <span>{name}</span>
              <span className="text-xs font-medium">{date}</span>
            </button>
          ))}
        </div>
        {due === "pick" && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Ngày
            <input
              type="date"
              min={today}
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              className="min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base"
            />
          </label>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold">Ảnh bài tập</span>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, n) => (
            <div key={p.key} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-ink/10">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview blob */}
              <img src={p.preview} alt={`Ảnh ${n + 1}`} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(p.key)}
                aria-label={`Bỏ ảnh ${n + 1}`}
                className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full bg-white/90 text-lg font-bold"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_HOMEWORK_PHOTOS && (
            <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink/50 bg-white p-2 text-center text-sm font-bold text-accent">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              Chụp / chọn ảnh
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm font-bold">
        Ghi chú (tùy chọn)
        <textarea
          rows={2}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: làm vào vở bài tập"
          className="resize-none rounded-xl border border-ink/30 bg-white p-3 text-base font-normal"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-xl border border-accent/40 bg-white p-3 text-sm font-semibold">
          {done}
        </p>
      )}

      <button type="submit" disabled={busy !== null || !kid} className="btn min-h-13 bg-accent text-base text-white disabled:opacity-60">
        {busy ?? `Giao ${subjectName || "bài"} cho ${kid?.name ?? "con"}`}
      </button>
    </form>
  );
}
