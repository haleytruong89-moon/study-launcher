"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NETWORK_ERROR, sendJson } from "@/lib/api-client";
import { HOMEWORK_ACCEPT, KIND_LABEL, MAX_FILE_BYTES, MAX_HOMEWORK_FILES, fileKind, homeworkFileUrl, mimeOf, storedExt, type FileKind } from "@/lib/files";
import { compressImage } from "@/lib/images";
import { SUBJECTS, shortDate } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/client";

interface Kid {
  id: string;
  name: string;
  color: string | null;
}

/** An attachment in the form: either already stored (`path`) or picked now (`file`). */
interface Attach {
  key: string;
  kind: FileKind;
  path?: string;
  file?: File;
  /** Object URL of a newly picked image. */
  preview?: string;
}

/** The item being edited (edit mode). */
export interface EditItem {
  id: string;
  childId: string;
  subject: string;
  dueDate: string;
  note: string | null;
  paths: string[];
}

type Due = "today" | "tomorrow" | "pick";
const OTHER = "Khác";

/** Best effort: the parent's storage policy allows deleting files in the family folder. */
async function removeUploaded(supabase: ReturnType<typeof createClient>, paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from("homework").remove(paths);
  if (error) console.error("homework cleanup failed", error.message);
}

function chipClass(on: boolean) {
  return on ? "border-ink bg-ink text-white" : "border-ink/30 bg-white text-ink";
}

function initialAttachments(paths: string[]): Attach[] {
  return paths.flatMap((path) => {
    const kind = fileKind(path);
    return kind ? [{ key: path, kind, path }] : [];
  });
}

/**
 * Mockup "Giao bài tập": child -> subject -> due date -> files -> note -> one button.
 * Photos are compressed in the browser (<= 1600 px, JPEG 0.8); PDF / Word / Excel are
 * uploaded as they are (<= 5 MB each, at most 6 files). Files go to the private `homework`
 * bucket with the parent's own session, then the item is created (or edited) on the server.
 * With `edit`, the same form edits an existing item (S2c): the child cannot be changed.
 */
export function HomeworkForm({
  familyId,
  today,
  tomorrow,
  kids,
  edit,
  onDone,
}: {
  familyId: string;
  today: string;
  tomorrow: string;
  kids: Kid[];
  edit?: EditItem;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [kidId, setKidId] = useState(edit?.childId ?? kids[0]?.id ?? "");
  const known = edit ? (SUBJECTS as readonly string[]).includes(edit.subject) : true;
  const [subject, setSubject] = useState<string>(edit ? (known ? edit.subject : OTHER) : SUBJECTS[0]);
  const [otherSubject, setOtherSubject] = useState(edit && !known ? edit.subject : "");
  const [due, setDue] = useState<Due>(edit ? (edit.dueDate === today ? "today" : edit.dueDate === tomorrow ? "tomorrow" : "pick") : "tomorrow");
  const [pickedDate, setPickedDate] = useState(edit?.dueDate ?? tomorrow);
  const [files, setFiles] = useState<Attach[]>(() => initialAttachments(edit?.paths ?? []));
  const [note, setNote] = useState(edit?.note ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const filesRef = useRef<Attach[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Release preview URLs when the form unmounts.
  useEffect(() => () => filesRef.current.forEach((f) => f.preview && URL.revokeObjectURL(f.preview)), []);

  const kid = kids.find((k) => k.id === kidId);
  const subjectName = subject === OTHER ? otherSubject.trim() : subject;
  const dueDate = due === "today" ? today : due === "tomorrow" ? tomorrow : pickedDate;
  // An edit may keep an already-past due date; a new date must be today or later.
  const minDate = edit && edit.dueDate < today ? edit.dueDate : today;
  const formId = edit ? `hw-edit-${edit.id}` : "hw-new";

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const problems: string[] = [];
    const added: Attach[] = [];
    let room = MAX_HOMEWORK_FILES - files.length;
    for (const file of Array.from(list)) {
      const isImage = file.type.startsWith("image/");
      const ext = isImage ? "jpg" : storedExt(file);
      const kind = isImage ? "image" : ext ? fileKind(`x.${ext}`) : null;
      if (!kind) {
        problems.push(`“${file.name}” không phải ảnh, PDF, Word hay Excel.`);
        continue;
      }
      if (!isImage && file.size > MAX_FILE_BYTES) {
        problems.push(`“${file.name}” lớn hơn 5 MB.`);
        continue;
      }
      if (room <= 0) {
        problems.push(`Tối đa ${MAX_HOMEWORK_FILES} tệp mỗi bài.`);
        break;
      }
      room--;
      added.push({ key: crypto.randomUUID(), kind, file, preview: isImage ? URL.createObjectURL(file) : undefined });
    }
    setFiles((f) => [...f, ...added]);
    if (problems.length > 0) setError(problems.join(" "));
  }

  function removeFile(key: string) {
    setFiles((list) => {
      const f = list.find((x) => x.key === key);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return list.filter((x) => x.key !== key);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(null);
    if (!kid) return setError("Chọn con trước.");
    if (!subjectName) return setError("Nhập tên môn.");
    if (dueDate < minDate) return setError("Ngày phải nộp phải từ hôm nay trở đi.");
    if (files.length === 0 && !note.trim()) return setError("Cần ít nhất 1 tệp hoặc ghi chú.");

    const supabase = createClient();
    const uploaded: string[] = [];
    const pathOf = new Map<string, string>();
    const fresh = files.filter((f) => f.file);
    try {
      for (const [n, f] of fresh.entries()) {
        const file = f.file as File;
        setBusy(`Đang tải tệp ${n + 1}/${fresh.length}…`);
        let body: Blob = file;
        let ext = storedExt(file) ?? "bin";
        if (f.kind === "image") {
          body = await compressImage(file);
          ext = "jpg";
        }
        if (body.size > MAX_FILE_BYTES) throw new Error("too-big");
        const path = `${familyId}/${kid.id}/${dueDate}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("homework").upload(path, body, {
          contentType: mimeOf(path) ?? "application/octet-stream",
          upsert: false,
        });
        if (upErr) throw new Error(upErr.message);
        uploaded.push(path);
        pathOf.set(f.key, path);
      }
    } catch (e) {
      console.error("homework upload failed", e);
      await removeUploaded(supabase, uploaded);
      setBusy(null);
      return setError(
        e instanceof Error && e.message === "too-big" ? "Có tệp lớn hơn 5 MB." : "Không tải được tệp lên. Kiểm tra mạng rồi thử lại.",
      );
    }

    const photoPaths = files.map((f) => f.path ?? pathOf.get(f.key)).filter((p): p is string => !!p);
    setBusy(edit ? "Đang lưu…" : "Đang giao bài…");
    const err = edit
      ? await sendJson("PATCH", `/api/admin/homework/${edit.id}`, { subject: subjectName, dueDate, note: note.trim() || null, photoPaths })
      : await sendJson("POST", "/api/admin/homework", { childId: kid.id, subject: subjectName, dueDate, note: note.trim() || null, photoPaths });
    if (err) {
      // Refused by the server: do not leave orphan files (a retry uploads them again). On a
      // lost connection the server may have saved the item, so its files are kept.
      if (err !== NETWORK_ERROR) await removeUploaded(supabase, uploaded);
      setBusy(null);
      return setError(err);
    }
    setBusy(null);

    if (edit) {
      router.refresh();
      onDone?.();
      return;
    }
    setDone(`Đã giao ${subjectName} cho ${kid.name} · nộp ${dueDate === today ? "hôm nay" : shortDate(dueDate)}${photoPaths.length ? ` (${photoPaths.length} tệp)` : ""}`);
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setFiles([]);
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-label={edit ? `Sửa bài ${edit.subject}` : "Giao bài tập"}>
      {!edit && (
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
      )}

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
        <legend className="mb-2 text-sm font-bold">Ngày phải nộp (hạn chót)</legend>
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
              min={minDate}
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              className="min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base"
            />
          </label>
        )}
        <span className="text-xs text-ink/65">Con thấy mọi bài chưa xong; bài có hạn hôm nay/ngày mai là “Phải xong hôm nay”.</span>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold">Ảnh / tệp bài tập</span>
        <div className="grid grid-cols-3 gap-2">
          {files.map((f, n) => {
            const src = f.preview ?? (f.kind === "image" && f.path ? homeworkFileUrl(f.path) : null);
            return (
              <div key={f.key} className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-ink/10">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview blob or private file route
                  <img src={src} alt={`Tệp ${n + 1}`} className="size-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 px-2 text-center">
                    <span className="rounded-lg bg-white px-2 py-1 text-sm font-extrabold text-accent">{KIND_LABEL[f.kind]}</span>
                    <span className="line-clamp-2 text-xs break-all text-ink/70">{f.file?.name ?? `Tệp ${n + 1}`}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(f.key)}
                  aria-label={`Bỏ tệp ${n + 1}`}
                  className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full bg-white/90 text-lg font-bold"
                >
                  ×
                </button>
              </div>
            );
          })}
          {files.length < MAX_HOMEWORK_FILES && (
            <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink/50 bg-white p-2 text-center text-sm font-bold text-accent">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              Chụp ảnh / chọn tệp
              <input
                type="file"
                accept={HOMEWORK_ACCEPT}
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
        <span className="text-xs text-ink/65">Ảnh, PDF, Word, Excel · tối đa {MAX_HOMEWORK_FILES} tệp, mỗi tệp ≤ 5 MB.</span>
      </div>

      <label className="flex flex-col gap-1 text-sm font-bold" htmlFor={`${formId}-note`}>
        Ghi chú (tùy chọn)
        <textarea
          id={`${formId}-note`}
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

      <div className="flex gap-2">
        <button type="submit" disabled={busy !== null || !kid} className="btn min-h-13 grow bg-accent text-base text-white disabled:opacity-60">
          {busy ?? (edit ? "Lưu thay đổi" : `Giao ${subjectName || "bài"} cho ${kid?.name ?? "con"}`)}
        </button>
        {edit && onDone && (
          <button type="button" disabled={busy !== null} onClick={onDone} className="btn min-h-13 border border-ink/30 bg-white">
            Hủy
          </button>
        )}
      </div>
    </form>
  );
}
