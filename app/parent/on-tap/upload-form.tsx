"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { NETWORK_ERROR } from "@/lib/api-client";
import { STUDY_APP_MAX_BYTES, isValidStudyAppSlug, slugifyStudyApp } from "@/lib/studyApps";

type Existing = { slug: string; title: string; childId: string | null };

/** Upload a new review app, or a new file for an app with the same address (slug). */
export function StudyAppUpload({ kids, existing }: { kids: { id: string; name: string }[]; existing: Existing[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [childId, setChildId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugifyStudyApp(title);
  const replacing = existing.find((e) => e.slug === effectiveSlug);

  function pickExisting(s: string) {
    const e = existing.find((x) => x.slug === s);
    if (!e) return;
    setTitle(e.title);
    setSlug(e.slug);
    setSlugTouched(true);
    setChildId(e.childId ?? "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(null);
    const file = fileRef.current?.files?.[0];
    if (!title.trim()) return setError("Đặt tên cho app.");
    if (!isValidStudyAppSlug(effectiveSlug)) return setError("Địa chỉ app chỉ gồm chữ thường không dấu, số và dấu gạch (2–48 ký tự).");
    if (!file) return setError("Chọn tệp .html của app.");
    if (file.size > STUDY_APP_MAX_BYTES) return setError("Tệp lớn quá (tối đa 4 MB).");

    const body = new FormData();
    body.set("title", title.trim());
    body.set("slug", effectiveSlug);
    body.set("childId", childId);
    body.set("file", file);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/study-apps", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { error?: string; replaced?: boolean } | null;
      if (!res.ok) return setError(data?.error ?? "Có lỗi, thử lại sau.");
      setDone(data?.replaced ? "Đã thay tệp, link giữ nguyên." : "Đã thêm app.");
      setTitle("");
      setSlug("");
      setSlugTouched(false);
      setChildId("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const input = "min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base font-normal";
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl bg-white p-4">
      {existing.length > 0 && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Thay tệp cho app có sẵn (không bắt buộc)
          <select value={replacing ? effectiveSlug : ""} onChange={(e) => pickExisting(e.target.value)} className={input}>
            <option value="">— App mới —</option>
            {existing.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Tên app (con thấy)
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Lập phương trình Toán 9" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Địa chỉ
        <span className="flex items-center gap-1 font-normal">
          <span className="text-ink/60">/on-tap/</span>
          <input
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            maxLength={48}
            className={`${input} grow`}
          />
        </span>
        {replacing && <span className="font-normal text-amber-800">Địa chỉ này đã có: tải lên sẽ thay tệp của “{replacing.title}”.</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Dành cho
        <select value={childId} onChange={(e) => setChildId(e.target.value)} className={input}>
          <option value="">Cả nhà</option>
          {kids.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Tệp .html
        <input ref={fileRef} type="file" accept=".html,.htm,text/html" className="min-h-11 text-base font-normal" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm text-green-800">
          {done}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn bg-accent text-white">
        {busy ? "Đang tải lên…" : replacing ? "Thay tệp" : "Thêm app"}
      </button>
    </form>
  );
}
