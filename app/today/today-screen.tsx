"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TaskView } from "@/lib/dayState";
import { compressImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { TodayView } from "@/lib/today/service";
import { MAX_PROOFS, passOffered, runningTimedTask } from "@/lib/today/rules";
import { childDayTypeNote } from "@/lib/admin/specialDay";
import { bannerFor, clock, dayProgress, longDate, nextTask, shade, statusPill, stepIndex, upcomingHint, weekSummary } from "@/lib/today/view";
import { SignOutButton } from "../sign-out-button";
import { TalkPanel } from "../binh-yen/talk-panel";
import { FocusView, NextTask, ProgressRing, TaskRow, WeekStrip, type Act, type TaskCtx } from "./today-parts";
import { IconPicker, PlanNudge, Planner, WeeklyReviewCard } from "./today-extras";
import { ProofSheet } from "./proof-sheet";
import { nextFromPlan, plannable, planProgress } from "@/lib/today/week";

interface Child {
  id: string;
  familyId: string;
  name: string;
  grade: number | null;
  color: string | null;
}

const POLL_MS = 30_000;
const STEPS = ["Phần 1", "Nghỉ", "Phần 2", "Giờ tự do"];

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readPlanLater(): string | null {
  try {
    return window.localStorage.getItem("plan-later");
  } catch {
    return null; // storage blocked: the nudge just shows again
  }
}

export function TodayScreen({ child, initial }: { child: Child; initial: TodayView | null }) {
  const [view, setView] = useState<TodayView | null>(initial);
  const [error, setError] = useState<string | null>(initial ? null : "Chưa tải được việc hôm nay. Đang thử lại…");
  const [busy, setBusy] = useState<string | null>(null);
  // Focus mode opens for a running task unless the child minimised THAT task.
  const [minimized, setMinimized] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"plan" | "icon" | null>(null);
  // "Nộp ảnh bài" sheet: the homework key it is open for, and upload progress.
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  // "Để sau" on the plan nudge: remembered for today on this laptop only (a convenience).
  const storedLater = useSyncExternalStore(subscribeStorage, readPlanLater, () => null);
  const [laterNow, setPlanLater] = useState<string | null>(null);
  const planLater = laterNow ?? storedLater;
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

  // Remember this browser for the PIN sign-in (once per page load; best effort).
  useEffect(() => {
    void fetch("/api/pin/remember", { method: "POST" }).catch(() => null);
  }, []);

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

  /** POSTs a child action; true when the server accepted it (the new view is shown). */
  async function act({ url, body, confirm }: Act): Promise<boolean> {
    if (confirm && !window.confirm(confirm)) return false;
    setBusy(url);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await res.json().catch(() => null)) as (TodayView & { error?: string }) | null;
      if (!res.ok || !data?.state) {
        setError(data?.error ?? "Có lỗi, thử lại sau.");
        return false;
      }
      accept(data);
      return true;
    } catch {
      setError("Mất kết nối mạng, thử lại sau.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  /** Homework: photos of the finished work -> compress -> upload -> attach each -> Xong. */
  async function proofAndFinish(item: TaskView, files: File[]): Promise<boolean> {
    if (!item.runId || !view) return false;
    setBusy(`proof:${item.runId}`);
    setError(null);
    try {
      for (const [n, file] of files.entries()) {
        const last = n === files.length - 1;
        setSending(last ? `Đang gửi ảnh ${n + 1}/${files.length} và đánh dấu xong…` : `Đang gửi ảnh ${n + 1}/${files.length}…`);
        const blob = await compressImage(file);
        const path = `${child.familyId}/${child.id}/${view.state.localDate}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await createClient().storage.from("proofs").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw new Error(upErr.message);
        const res = await fetch("/api/tasks/proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // The last photo also finishes the homework in the same request (no "photos sent but
          // the clock still running" when the connection drops in between).
          body: JSON.stringify({ runId: item.runId, path, finish: last }),
        });
        const data = (await res.json().catch(() => null)) as (TodayView & { error?: string }) | null;
        if (!res.ok || !data?.state) {
          setError(data?.error ?? "Không gửi được ảnh, thử lại.");
          void refresh(); // show what did arrive (e.g. "Xong · đã gửi 1 ảnh")
          return false;
        }
        accept(data);
      }
      return true;
    } catch (e) {
      console.error("proof upload failed", e);
      setError("Không tải được ảnh lên. Kiểm tra mạng rồi thử lại.");
      return false;
    } finally {
      setBusy(null);
      setSending(null);
    }
  }

  /** "Xong rồi · nộp ảnh": homework done in the notebook, start it quietly and open the sheet. */
  async function doneNow(item: TaskView) {
    setError(null);
    setMinimized(item.key);
    if (item.state === "todo" && !(await act({ url: "/api/tasks/start", body: { source: item.source, id: item.id } }))) return;
    setProofKey(item.key);
  }

  // The QR code on the laptop opens /today?nop=<homework id> on the phone: open that sheet.
  const nopHandled = useRef(false);
  useEffect(() => {
    if (nopHandled.current || !view) return;
    nopHandled.current = true;
    const id = new URLSearchParams(window.location.search).get("nop");
    if (!id) return;
    window.history.replaceState(null, "", "/today");
    const item = view.state.part1.items.find((i) => i.source === "homework" && i.id === id);
    if (item && item.state !== "done") window.setTimeout(() => void doneNow(item), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the first view
  }, [view]);

  // Check often while something is in progress, so a photo sent from the phone or a parent's
  // confirmation shows here within seconds (the clock never keeps running after "done").
  const sheetOpen = !!proofKey && !!view?.state.part1.items.some((i) => i.key === proofKey && i.state === "running");
  const anyRunning = !!view && [...view.state.part1.items, ...view.state.part2.items].some((i) => i.state === "running");
  const fastMs = sheetOpen ? 4000 : anyRunning ? 10_000 : 0;
  useEffect(() => {
    if (!fastMs) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, fastMs);
    return () => window.clearInterval(id);
  }, [fastMs, refresh]);

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
  const pill = statusPill(s, nowMs);
  // Special day (S3d): the sick status pill already says "Ngày ốm" when the sick day decides the state.
  const dayNote = s.status === "OPEN_SICK" ? null : childDayTypeNote(s.dayType);
  const progress = dayProgress(s);
  const next = nextFromPlan(s, view.plan) ?? nextTask(s);
  const planItems = plannable(s).filter((i) => i.state !== "done");
  const showNudge = !view.plan && !s.part1.complete && planItems.length >= 2 && planLater !== s.localDate;
  const planDone = view.plan ? planProgress(s, view.plan) : null;
  const mustToday = s.part1.items.filter((i) => i.group !== "upcoming");
  const upcoming = s.part1.items.filter((i) => i.group === "upcoming");
  const countdownTo = s.status === "BREAK" ? s.break.endsAt : s.status === "FREE" || s.status === "OPEN_OVERRIDE" ? s.openUntil : null;
  const focusItem = next?.state === "running" && minimized !== next.key ? next : null;
  const proofItem = proofKey ? (s.part1.items.find((i) => i.key === proofKey) ?? null) : null;
  // Finished (e.g. from the phone) or gone: the sheet closes by itself.
  const proofOpen = proofItem !== null && proofItem.state === "running";
  const ctx: TaskCtx = {
    today: s.localDate,
    nowMs,
    busy,
    color,
    files: (item) => (item.source === "homework" ? (view.homeworkFiles[item.id] ?? []) : []),
    runningTimed: runningTimedTask(s),
    onAct: act,
    onProofOpen: (item) => {
      setError(null);
      setProofKey(item.key);
    },
    onDoneNow: (item) => void doneNow(item),
    onFocus: () => setMinimized(null),
    reviewed: new Set(view.reviewed ?? []),
    asked: new Set(view.asked ?? []),
  };
  const firstName = child.name.trim().split(/\s+/).pop() ?? child.name;

  return (
    <div className="min-h-dvh">
      {dialog === "plan" && (
        <Planner
          items={planItems}
          plan={view.plan}
          color={color}
          busy={!!busy}
          error={error}
          onSave={(keys) => act({ url: "/api/day/plan", body: { keys } })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "icon" && (
        <IconPicker current={view.icon} color={color} busy={!!busy} error={error} onPick={(icon) => act({ url: "/api/profile/icon", body: { icon } })} onClose={() => setDialog(null)} />
      )}
      {focusItem && <FocusView item={focusItem} ctx={ctx} dark={shade(color)} onClose={() => setMinimized(focusItem.key)} />}
      {proofOpen && proofItem && (
        <ProofSheet
          key={proofItem.key}
          item={proofItem}
          color={color}
          max={Math.max(0, MAX_PROOFS - proofItem.proofCount)}
          sending={sending}
          error={error}
          onSend={(files) => proofAndFinish(proofItem, files)}
          asked={!!proofItem.runId && (view.asked ?? []).includes(proofItem.runId)}
          onAsk={async () => {
            const ok = await act({ url: "/api/tasks/confirm-request", body: { runId: proofItem.runId } });
            if (ok) setMinimized(proofItem.key);
            return ok;
          }}
          onClose={() => setProofKey(null)}
        />
      )}

      <header className="text-white" style={{ background: color }}>
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Đổi biểu tượng"
              onClick={() => {
                setError(null);
                setDialog("icon");
              }}
              className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-white/55 bg-white/15 text-2xl font-bold"
            >
              {view.icon ?? firstName[0]?.toUpperCase() ?? "?"}
            </button>
            <div className="flex min-w-0 grow flex-col">
              <h1 className="text-[21px] font-bold">Chào {child.name}</h1>
              <span className="text-sm opacity-90">
                {child.grade ? `Lớp ${child.grade} · ` : ""}
                {longDate(s.localDate)}
              </span>
            </div>
            <ProgressRing done={progress.done} total={progress.total} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/20 px-3 text-[13px] font-semibold">
              <span aria-hidden className={`size-2 rounded-full ${pill.open ? "bg-[#FBD38D]" : "bg-white"}`} />
              {pill.label}
            </span>
            {dayNote && (
              <span className="inline-flex min-h-9 items-center rounded-full bg-white px-3 text-[13px] font-bold" style={{ color }}>
                {dayNote}
              </span>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {/* Góc bình yên (S-BY0): hidden unless a parent phone can receive it. */}
              <TalkPanel variant="header" color={color} />
              <SignOutButton onDark />
            </span>
          </div>
          <ol aria-label="Tiến trình hôm nay" className="grid grid-cols-4 gap-1.5">
            {STEPS.map((label, i) => (
              <li key={label} aria-current={i === idx ? "step" : undefined} className="flex flex-col gap-1.5">
                <span className="h-1.5 rounded-full" style={{ background: i <= idx ? "#FFFFFF" : "rgba(255,255,255,0.3)" }} />
                <span className={`text-xs ${i === idx ? "font-bold" : "opacity-85"}`}>
                  {i < idx ? "✓ " : ""}
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {error && !dialog && !proofOpen && (
            <p role="alert" className="rounded-xl border border-red-200 bg-white p-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          {view.weekly && (
            <WeeklyReviewCard
              key={view.weekly.stats.weekStart}
              stats={view.weekly.stats}
              review={view.weekly.review}
              color={color}
              busy={!!busy}
              onSave={(answers) => act({ url: "/api/week/review", body: answers })}
            />
          )}

          {showNudge && (
            <PlanNudge
              color={color}
              onPlan={() => {
                setError(null);
                setDialog("plan");
              }}
              onLater={() => {
                setPlanLater(s.localDate);
                try {
                  window.localStorage.setItem("plan-later", s.localDate);
                } catch {
                  /* not remembered: fine */
                }
              }}
            />
          )}

          <section
            aria-live="polite"
            aria-label="Trạng thái hôm nay"
            className="flex flex-col gap-4 rounded-[20px] border-2 bg-white px-4 py-4"
            style={{ borderColor: color, boxShadow: "0 6px 18px rgba(28,31,29,0.08)" }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 grow basis-60 flex-col gap-0.5">
                <strong className="text-lg">{banner.title}</strong>
                <span className="text-sm text-ink/75">{banner.sub}</span>
              </div>
              {countdownTo && (
                <span className="text-3xl font-bold tabular-nums" style={{ color }} aria-label="Thời gian còn lại">
                  {clock(new Date(countdownTo).getTime() - nowMs)}
                </span>
              )}
            </div>
            {s.break.state === "offer" && (
              <div className="flex flex-wrap gap-2">
                {view.rules.breakMinutes > 0 && (
                  <button type="button" disabled={!!busy} onClick={() => void act({ url: "/api/day/break", body: { action: "start" } })} className="btn text-white disabled:opacity-60" style={{ background: color }}>
                    Nghỉ {view.rules.breakMinutes} phút
                  </button>
                )}
                <button type="button" disabled={!!busy} onClick={() => void act({ url: "/api/day/break", body: { action: "skip" } })} className="btn border-[1.5px] bg-white disabled:opacity-60" style={{ borderColor: color, color }}>
                  Học tiếp luôn
                </button>
              </div>
            )}
            {s.break.state === "running" && (
              <button type="button" disabled={!!busy} onClick={() => void act({ url: "/api/day/break", body: { action: "end" } })} className="btn self-start text-white disabled:opacity-60" style={{ background: color }}>
                Học tiếp
              </button>
            )}
            {next && s.break.state !== "offer" && s.break.state !== "running" && (
              <div className="border-t border-ink/10 pt-4">
                <NextTask item={next} ctx={ctx} />
              </div>
            )}
            {planDone && (
              <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3 text-sm">
                <span className="font-semibold">
                  Theo kế hoạch của con · {planDone.done}/{planDone.total} xong
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setDialog("plan");
                  }}
                  className="ml-auto min-h-11 px-2 font-semibold underline"
                  style={{ color }}
                >
                  Sửa kế hoạch
                </button>
              </div>
            )}
          </section>

          <section aria-labelledby="p1h" className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="p1h" className="text-lg font-bold">
                Phải xong hôm nay
              </h2>
              <span className="text-[13px] font-semibold text-ink/70">
                Phần 1 · {s.part1.done}/{s.part1.total} xong
              </span>
            </div>
            {mustToday.length === 0 ? (
              <p className="text-sm text-ink/70">Không có bài đến hạn hôm nay.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {mustToday.map((item) => (
                  <TaskRow key={item.key} item={item} ctx={ctx} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="uph" className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <h2 id="uph" className="text-lg font-bold">
                Sắp tới — làm trước được
              </h2>
              {upcoming.length > 0 && <span className="text-[13px] font-semibold" style={{ color: s.part1.pick.done < s.part1.pick.needed ? color : "#4A4F4C" }}>{upcomingHint(s)}</span>}
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-ink/70">Chưa có bài nào sắp tới.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {upcoming.map((item) => (
                  <TaskRow key={item.key} item={item} ctx={ctx} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="p2h" className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 id="p2h" className="text-lg font-bold">
                Phần 2 · Kỹ năng
              </h2>
              <span className="ml-auto text-[13px] font-semibold text-ink/70">
                {s.part2.locked ? "🔒 mở khi xong Phần 1 (và giờ nghỉ)" : `${s.part2.done}/${s.part2.total} xong`}
              </span>
            </div>
            {s.part2.items.length === 0 ? (
              <p className="text-sm text-ink/70">Hôm nay không có kỹ năng.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {s.part2.items.map((item) => (
                  <TaskRow key={item.key} item={item} ctx={ctx} locked={s.part2.locked} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="wkh" className="flex flex-col gap-3.5 rounded-2xl border border-ink/10 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="wkh" className="text-lg font-bold">
                Tuần này
              </h2>
              <span className="text-[13px] font-semibold text-ink/70">{weekSummary(s.week)}</span>
            </div>
            <WeekStrip week={s.week} today={s.localDate} firstDay={view.firstDay} color={color} />
            {s.earlyThisWeek > 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-[#FBF0D6] px-3 py-2.5 text-sm font-semibold text-[#5E3D00]">
                <span aria-hidden>★</span> Tuần này làm sớm {s.earlyThisWeek} bài
              </p>
            ) : (
              <p className="text-sm text-ink/70">Làm xong bài trước hạn ít nhất 2 ngày để được ★ sớm.</p>
            )}
            <div className="flex flex-col gap-2 border-t border-ink/10 pt-3.5">
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
                    className="h-2.5 overflow-hidden rounded-full bg-[#E3E6E0]"
                    role="progressbar"
                    aria-label="Số tuần đạt"
                    aria-valuemin={0}
                    aria-valuemax={s.trust.weeksNeeded}
                    aria-valuenow={s.trust.weeksMet}
                  >
                    <div className="h-2.5 rounded-full bg-accent" style={{ width: `${Math.round((s.trust.weeksMet / Math.max(1, s.trust.weeksNeeded)) * 100)}%` }} />
                  </div>
                  <span className="text-[13px] text-ink/70">
                    Đủ {s.trust.weeksNeeded} tuần liên tiếp đạt ≥ {view.rules.trustUpPct}% ngày → bố mẹ cùng con xem chuyển sang Tin tưởng: máy không chặn web, con tự quản giờ học.
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-col items-start gap-1 border-t border-ink/10 pt-3">
              <span className="text-[13px] text-ink/70">
                {s.passesLeft > 0 ? `Thẻ miễn: còn ${s.passesLeft} thẻ tuần này · dùng khi thật cần, ngày vẫn tính là đạt` : "Thẻ miễn: đã dùng hết — tuần sau có thẻ mới"}
              </span>
              {passOffered(s) && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void act({ url: "/api/day/pass", confirm: "Dùng thẻ miễn hôm nay? Giờ tự do bắt đầu ngay, mỗi tuần chỉ có số thẻ giới hạn." })}
                  className="min-h-11 text-sm font-semibold text-ink/75 underline disabled:opacity-60"
                >
                  Dùng thẻ hôm nay
                </button>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
