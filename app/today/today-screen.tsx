"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskView } from "@/lib/dayState";
import { compressImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { TodayView } from "@/lib/today/service";
import { passOffered, runningTimedTask } from "@/lib/today/rules";
import { bannerFor, clock, dayLabel, isOkResult, longDate, stepIndex, taskMeta, taskProgress, weekSummary } from "@/lib/today/view";
import { SignOutButton } from "../sign-out-button";

interface Child {
  id: string;
  familyId: string;
  name: string;
  grade: number | null;
  color: string | null;
}

const POLL_MS = 30_000;
const STEPS = [
  { label: "Bài tập", sub: "Bài trên lớp + bài bổ sung" },
  { label: "Nghỉ", sub: "Tùy chọn · mở mọi trang" },
  { label: "Kỹ năng", sub: "Hoạt động của ngày" },
  { label: "Giờ tự do", sub: "Mở mọi trang · hết giờ khóa lại" },
];

type Act = { url: string; body?: unknown; confirm?: string };

export function TodayScreen({ child, initial }: { child: Child; initial: TodayView | null }) {
  const [view, setView] = useState<TodayView | null>(initial);
  const [error, setError] = useState<string | null>(initial ? null : "Chưa tải được việc hôm nay. Đang thử lại…");
  const [busy, setBusy] = useState<string | null>(null);
  // Server clock offset: countdowns use server time, never the laptop clock alone.
  const router = useRouter();
  const offsetRef = useRef(0);
  const [nowMs, setNowMs] = useState(() => (initial ? new Date(initial.state.serverNow).getTime() : 0));
  useEffect(() => {
    if (initial) offsetRef.current = new Date(initial.state.serverNow).getTime() - Date.now();
  }, [initial]);

  const accept = useCallback((v: TodayView) => {
    offsetRef.current = new Date(v.state.serverNow).getTime() - Date.now();
    setView(v);
    setNowMs(Date.now() + offsetRef.current);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/today", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      accept((await res.json()) as TodayView);
      setError(null);
    } catch {
      setError("Mất kết nối với máy chủ. Đang thử lại…");
    }
  }, [accept, router]);

  // Poll every 30 s while visible, and right away when the tab comes back (DESIGN section 6).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  // 1-second tick for timers; re-read the server when a deadline passes.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now() + offsetRef.current;
      setNowMs(t);
      const s = view?.state;
      const deadlines = [s?.openUntil, s?.break.endsAt, s?.free.endsAt].filter((x): x is string => !!x).map((x) => new Date(x).getTime());
      if (deadlines.some((d) => d <= t && d > t - 1000)) void refresh();
    }, 1000);
    return () => window.clearInterval(id);
  }, [view, refresh]);

  async function act({ url, body, confirm }: Act) {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(url);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await res.json().catch(() => null)) as (TodayView & { error?: string }) | null;
      if (!res.ok || !data?.state) setError(data?.error ?? "Có lỗi, thử lại sau.");
      else accept(data);
    } catch {
      setError("Mất kết nối mạng, thử lại sau.");
    } finally {
      setBusy(null);
    }
  }

  /** Homework: photo of the finished work -> compress -> upload -> attach -> Xong. */
  async function proofAndFinish(item: TaskView, file: File) {
    if (!item.runId || !view) return;
    setBusy(`proof:${item.runId}`);
    setError(null);
    try {
      const blob = await compressImage(file);
      const path = `${child.familyId}/${child.id}/${view.state.localDate}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await createClient().storage.from("proofs").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);
      const res = await fetch("/api/tasks/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: item.runId, path }),
      });
      const data = (await res.json().catch(() => null)) as (TodayView & { error?: string }) | null;
      if (!res.ok || !data?.state) {
        setError(data?.error ?? "Không gửi được ảnh, thử lại.");
        return;
      }
      accept(data);
      setBusy(null);
      await act({ url: "/api/tasks/finish", body: { runId: item.runId } });
    } catch (e) {
      console.error("proof upload failed", e);
      setError("Không tải được ảnh lên. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(null);
    }
  }

  const color = child.color ?? "#2b5d4f";
  if (!view) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
        <h1 className="text-2xl font-bold">Chào {child.name}</h1>
        <p role="alert" className="text-ink/70">
          {error}
        </p>
        <button type="button" className="btn bg-accent text-white" onClick={() => void refresh()}>
          Thử lại
        </button>
      </main>
    );
  }

  const s = view.state;
  const banner = bannerFor(s, view.rules);
  const idx = stepIndex(s, nowMs);
  const homework = s.part1.items.filter((i) => i.source === "homework");
  const extras = s.part1.items.filter((i) => i.source === "template");
  const runningTimed = runningTimedTask(s);
  const countdownTo = s.status === "BREAK" ? s.break.endsAt : s.status === "FREE" || s.status === "OPEN_OVERRIDE" ? s.openUntil : null;
  const bannerClass =
    banner.tone === "open" ? "bg-[#FBE9D3] text-[#5E3108]" : banner.tone === "dark" ? "bg-ink text-white" : "bg-[#E3ECE7] text-[#1C3F35]";

  return (
    <div className="min-h-dvh">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4">
          <div className="flex grow items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: color }} aria-hidden>
              {child.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold">Chào {child.name}</h1>
              <span className="text-sm text-ink/70">
                {child.grade ? `Lớp ${child.grade} · ` : ""}
                {longDate(s.localDate)}
              </span>
            </div>
          </div>
          <span
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${s.open ? "bg-[#FBE9D3] text-[#7A400B]" : "bg-ink text-white"}`}
          >
            {s.open ? "Đang mở mọi trang" : "Đang khóa · chỉ mở trang học"}
          </span>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-white p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <nav aria-label="Tiến trình hôm nay">
          <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STEPS.map((st, i) => (
              <li key={st.label} aria-current={i === idx ? "step" : undefined} className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold"
                  style={
                    i < idx
                      ? { background: "#2b5d4f", borderColor: "#2b5d4f", color: "#fff" }
                      : i === idx
                        ? { background: "#1c1f1d", borderColor: "#1c1f1d", color: "#fff" }
                        : { background: "#fff", borderColor: "#b9beb6", color: "#545b56" }
                  }
                >
                  {i < idx ? "✓" : i + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className={`text-[15px] ${i === idx ? "font-extrabold" : "font-semibold text-ink/80"}`}>{st.label}</span>
                  <span className="text-xs text-ink/65">{st.sub}</span>
                </span>
              </li>
            ))}
          </ol>
        </nav>

        <section aria-live="polite" aria-label="Trạng thái hôm nay" className={`flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4 ${bannerClass}`}>
          <div className="flex min-w-0 grow basis-72 flex-col gap-0.5">
            <strong className="text-lg">{banner.title}</strong>
            <span className="text-sm">{banner.sub}</span>
          </div>
          {countdownTo && (
            <span className="text-3xl font-extrabold tabular-nums" aria-label="Thời gian còn lại">
              {clock(new Date(countdownTo).getTime() - nowMs)}
            </span>
          )}
          {s.break.state === "offer" && (
            <div className="flex flex-wrap gap-2">
              {view.rules.breakMinutes > 0 && (
                <button type="button" disabled={!!busy} onClick={() => void act({ url: "/api/day/break", body: { action: "start" } })} className="btn bg-white text-ink disabled:opacity-60">
                  Nghỉ {view.rules.breakMinutes} phút
                </button>
              )}
              <button type="button" disabled={!!busy} onClick={() => void act({ url: "/api/day/break", body: { action: "skip" } })} className="btn border border-white text-white disabled:opacity-60">
                Học tiếp luôn
              </button>
            </div>
          )}
          {s.break.state === "running" && (
            <button type="button" disabled={!!busy} onClick={() => void act({ url: "/api/day/break", body: { action: "end" } })} className="btn bg-[#7A400B] text-white disabled:opacity-60">
              Học tiếp
            </button>
          )}
        </section>

        <div className="flex flex-wrap items-start gap-5">
          <section aria-labelledby="p1h" className="flex min-w-0 grow basis-[560px] flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="p1h" className="text-xl font-extrabold">
                Phần 1 · Bài tập hôm nay
              </h2>
              <span className="text-sm font-semibold text-ink/70">
                {s.part1.done}/{s.part1.total} xong
              </span>
            </div>
            <p className="text-sm text-ink/70">
              Bấm <strong>Bắt đầu</strong> khi ngồi vào làm. Bài trên lớp: làm xong thì <strong>chụp ảnh bài đã làm</strong>. Bài bổ sung: nút{" "}
              <strong>Xong</strong> mở khi đủ thời gian tối thiểu.
            </p>

            <TaskGroup title="Bài trên lớp · ảnh bố mẹ gửi" empty="Hôm nay không có bài trên lớp.">
              {homework.map((item) => (
                <TaskRow key={item.key} item={item} nowMs={nowMs} busy={busy} photos={view.homeworkPhotos[item.id] ?? []} blockedBy={null} onAct={act} onProof={proofAndFinish} />
              ))}
            </TaskGroup>
            <TaskGroup title="Bài bổ sung · từ app môn học" empty="Hôm nay không có bài bổ sung.">
              {extras.map((item) => (
                <TaskRow key={item.key} item={item} nowMs={nowMs} busy={busy} photos={[]} blockedBy={runningTimed} onAct={act} onProof={proofAndFinish} />
              ))}
            </TaskGroup>
          </section>

          <div className="flex min-w-0 grow basis-[360px] flex-col gap-5">
            <section aria-labelledby="wkh" className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="wkh" className="text-lg font-extrabold">
                  7 ngày qua
                </h2>
                <span className="text-sm font-semibold text-ink/70">{weekSummary(s.week)}</span>
              </div>
              <ul className="grid grid-cols-7 gap-1.5">
                {s.week.map((d) => {
                  const ok = isOkResult(d.result);
                  const title = d.result === "pass" ? "Dùng thẻ miễn — tính là đạt" : d.result === "sick" ? "Ngày ốm — tính là đạt" : ok ? "Đạt" : d.result === "today" ? "Hôm nay" : "Chưa đạt";
                  return (
                    <li key={d.date} className="flex flex-col items-center gap-1" title={title}>
                      <span
                        aria-label={title}
                        className={`flex size-8 items-center justify-center rounded-full border-2 text-xs font-extrabold ${d.result === "pass" ? "border-dashed" : ""}`}
                        style={
                          d.result === "ok" || d.result === "sick"
                            ? { background: "#2b5d4f", borderColor: "#2b5d4f", color: "#fff" }
                            : d.result === "pass"
                              ? { borderColor: "#2b5d4f", color: "#2b5d4f" }
                              : d.result === "today"
                                ? { borderColor: "#1c1f1d" }
                                : { borderColor: "#c9cdc6" }
                        }
                      >
                        {d.result === "pass" ? "M" : d.result === "sick" ? "Ố" : ok ? "✓" : ""}
                      </span>
                      <span className={`text-xs ${d.result === "today" ? "font-extrabold" : ""}`}>{dayLabel(d.date, s.localDate)}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-col gap-2 border-t border-ink/10 pt-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-bold">{s.trust.mode === "trust" ? "Đang ở chế độ Tin tưởng" : "Tiến tới chế độ Tin tưởng"}</span>
                  {s.trust.mode === "lock" && (
                    <span className="text-sm font-bold text-accent">
                      {s.trust.weeksMet}/{s.trust.weeksNeeded} tuần
                    </span>
                  )}
                </div>
                {s.trust.mode === "lock" && (
                  <>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-ink/10"
                      role="progressbar"
                      aria-label="Số tuần đạt"
                      aria-valuemin={0}
                      aria-valuemax={s.trust.weeksNeeded}
                      aria-valuenow={s.trust.weeksMet}
                    >
                      <div className="h-2 bg-accent" style={{ width: `${Math.round((s.trust.weeksMet / Math.max(1, s.trust.weeksNeeded)) * 100)}%` }} />
                    </div>
                    <span className="text-sm text-ink/70">
                      Đủ {s.trust.weeksNeeded} tuần liên tiếp đạt ≥ {view.rules.trustUpPct}% → bố mẹ xem xét chuyển sang Tin tưởng: máy không chặn web nữa, chỉ nhắc việc.
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
                <div className="flex grow basis-40 flex-col">
                  <span className="font-bold">Thẻ miễn tuần này</span>
                  <span className="text-sm text-ink/70">
                    {s.passesLeft > 0 ? `Còn ${s.passesLeft} thẻ · dùng khi thật cần, hôm nay vẫn tính là ngày đạt` : "Đã dùng hết — tuần sau có thẻ mới"}
                  </span>
                </div>
                {passOffered(s) && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void act({ url: "/api/day/pass", confirm: "Dùng thẻ miễn hôm nay? Giờ tự do bắt đầu ngay, mỗi tuần chỉ có số thẻ giới hạn." })}
                    className="btn border border-accent bg-white text-accent disabled:opacity-60"
                  >
                    Dùng thẻ hôm nay
                  </button>
                )}
              </div>
            </section>

            <section aria-labelledby="p2h" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="p2h" className="text-xl font-extrabold">
                  Phần 2 · Kỹ năng hôm nay
                </h2>
                <span className="text-sm font-semibold text-ink/70">
                  {s.part2.done}/{s.part2.total} xong
                </span>
              </div>
              {s.part2.locked && (
                <p className="rounded-lg bg-[#EEF0EA] px-3 py-2.5 text-sm font-semibold text-ink/80">🔒 Mở sau khi xong Phần 1 (và giờ nghỉ)</p>
              )}
              {s.part2.items.length === 0 ? (
                <p className="text-sm text-ink/70">Hôm nay không có kỹ năng.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {s.part2.items.map((item) => (
                    <TaskRow key={item.key} item={item} nowMs={nowMs} busy={busy} photos={[]} locked={s.part2.locked} blockedBy={runningTimed} onAct={act} onProof={proofAndFinish} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function TaskGroup({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-xs font-bold tracking-wider text-ink/70 uppercase">{title}</h3>
      {children.length === 0 ? <p className="text-sm text-ink/60">{empty}</p> : <ul className="flex flex-col gap-2.5">{children}</ul>}
    </div>
  );
}

function TaskRow({
  item,
  nowMs,
  busy,
  photos,
  locked = false,
  blockedBy,
  onAct,
  onProof,
}: {
  item: TaskView;
  nowMs: number;
  busy: string | null;
  photos: string[];
  locked?: boolean;
  /** A timed task already running: other timed tasks wait (one at a time). */
  blockedBy: TaskView | null;
  onAct: (a: Act) => Promise<void>;
  onProof: (item: TaskView, file: File) => Promise<void>;
}) {
  const running = item.state === "running";
  const ready = running && !item.requiresProof && item.canFinishAt !== null && nowMs >= new Date(item.canFinishAt).getTime();
  const pct = taskProgress(item, nowMs);
  const name = item.title;
  const waiting = item.state === "todo" && blockedBy !== null && blockedBy.key !== item.key && item.source === "template" && item.minMinutes > 0;

  return (
    <li
      aria-label={name}
      className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${item.state === "done" ? "border-ink/10 bg-[#F3F8F5]" : running ? "border-accent bg-white" : "border-ink/10 bg-white"} ${locked && item.state === "todo" ? "opacity-60" : ""}`}
    >
      {item.source === "homework" && photos.length > 0 && (
        <a href={photos[0]} target="_blank" rel="noreferrer" className="shrink-0" aria-label={`Xem ${photos.length} ảnh bài ${item.title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          <img src={photos[0]} alt="" className="size-14 rounded-lg object-cover" />
        </a>
      )}
      <div className="flex min-w-0 grow basis-56 flex-col gap-1.5">
        <span className={`text-base font-bold ${item.state === "done" ? "text-ink/55 line-through" : ""}`}>
          {name}
          {item.placeholder && <span className="ml-2 rounded-full bg-[#ECEDE8] px-2 py-0.5 text-xs font-bold text-ink/70">Đang xây</span>}
        </span>
        {item.note && <span className="text-sm">{item.note}</span>}
        <span className="text-[13px] text-ink/70">{waiting ? `Làm xong “${blockedBy?.title}” rồi bắt đầu việc này` : taskMeta(item, nowMs)}</span>
        {running && !item.requiresProof && item.minMinutes > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-label="Thời gian đã học" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-1.5 bg-accent" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.deepLink && item.state !== "done" && (
          <a href={item.deepLink} target="_blank" rel="noreferrer" className="btn border border-accent text-accent">
            Mở app ↗
          </a>
        )}
        {item.state === "todo" && (
          <button
            type="button"
            disabled={!!busy || locked || waiting}
            onClick={() => void onAct({ url: "/api/tasks/start", body: { source: item.source, id: item.id } })}
            className="btn bg-accent text-white disabled:opacity-50"
          >
            Bắt đầu
          </button>
        )}
        {running && !item.requiresProof && (
          <button
            type="button"
            disabled={!ready || !!busy}
            onClick={() => void onAct({ url: "/api/tasks/finish", body: { runId: item.runId } })}
            className="btn bg-accent text-white disabled:bg-[#DDE0D8] disabled:text-[#6B726D]"
          >
            Xong
          </button>
        )}
        {running && item.requiresProof && (
          <label className={`btn cursor-pointer gap-2 bg-ink text-white ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy === `proof:${item.runId}` ? "Đang gửi ảnh…" : "Chụp ảnh bài đã làm"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onProof(item, f);
              }}
            />
          </label>
        )}
        {item.state === "done" && <span className="rounded-full bg-[#DCEAE4] px-3 py-2 text-[13px] font-bold text-[#1C3F35]">✓ Xong</span>}
      </div>
    </li>
  );
}
