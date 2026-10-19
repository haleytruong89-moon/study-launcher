"use client";

import { useRef, useState } from "react";
import { HomeworkForm } from "./homework-form";

interface Kid {
  id: string;
  name: string;
  color: string | null;
}

/** "+ Giao bài" floating button that opens the homework form as a sheet (UI review 19/10/2026). */
export function NewHomeworkSheet({ familyId, today, tomorrow, kids, defaultKidId }: { familyId: string; today: string; tomorrow: string; kids: Kid[]; defaultKidId?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  // A fresh form each time the sheet opens.
  const [round, setRound] = useState(0);

  return (
    <>
      {message && (
        <p role="status" className="rounded-xl border border-accent/40 bg-white p-3 text-sm font-semibold">
          {message}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setRound((r) => r + 1);
          dialog.current?.showModal();
        }}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 inline-flex min-h-14 items-center gap-2 rounded-full bg-accent px-6 font-extrabold text-white shadow-[0_6px_16px_rgba(28,31,29,.25)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Giao bài mới
      </button>
      <dialog
        ref={dialog}
        aria-label="Giao bài mới"
        className="mx-auto mt-auto mb-0 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-bg p-0 text-ink backdrop:bg-black/45"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="flex flex-col gap-4 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-ink/25" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold">Giao bài mới</h2>
            <button type="button" aria-label="Đóng" onClick={() => dialog.current?.close()} className="size-11 shrink-0 rounded-xl bg-ink/10 text-lg">
              ✕
            </button>
          </div>
          <HomeworkForm
            key={round}
            familyId={familyId}
            today={today}
            tomorrow={tomorrow}
            kids={kids}
            defaultKidId={defaultKidId}
            onCreated={(m) => {
              setMessage(m);
              dialog.current?.close();
            }}
          />
        </div>
      </dialog>
    </>
  );
}
