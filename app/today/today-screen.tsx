"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TaskView } from "@/lib/dayState";
import { compressImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { TodayView } from "@/lib/today/service";
import { MAX_PROOFS, passOffered, runningTimedTask } from "@/lib/today/rules";
import { childDayTypeNote } from "@/lib/admin/specialDay";
import { bannerFor, clock, dayProgress, daySteps, longDate, nextTask, shade, statusPill } from "@/lib/today/view";
import { Character } from "../avatar-face";
import { SignOutButton } from "../sign-out-button";
import { TalkPanel } from "../binh-yen/talk-panel";
import { FeedbackForm } from "./feedback";
import { FocusView, NextTask, ProgressRing, type Act, type TaskCtx } from "./today-parts";
import { Breadcrumb, ChildNav } from "../child-nav";
import { isChildTab, tabHref, tabLabel, type ChildTab } from "@/lib/childTabs";
import type { Avatar } from "@/lib/avatar";
import type { AvatarPics } from "@/lib/avatarPics";
import { voiceFor } from "@/lib/binhYen/catalog";
import { PillarCards } from "./pillars";
import { FeelInvite, FeelWeek, WeekAreas, WeekProgress } from "./tabs";
import { StudyCorner } from "./study-corner";
import { WorldMini, WorldTab } from "./world";
import type { WeekDaysView } from "@/lib/today/weekDays";
import { IconPicker, PlanNudge, Planner, WeeklyReviewCard } from "./today-extras";
import { ProofSheet } from "./proof-sheet";
import { nextFromPlan, plannable, planProgress } from "@/lib/today/week";

interface Child {
  id: string;
  familyId: string;
  name: string;
  grade: number | null;
  color: string | null;
  /** R6a: the child's character (drawn feelings for Nguyên, header later). */
  look: Avatar | null;
  pics: AvatarPics;
}

const POLL_MS = 30_000;

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

type Tab = Exclude<ChildTab, "binh-yen">;

function tabFromUrl(): Tab {
  const t = new URLSearchParams(window.location.search).get("tab");
  return isChildTab(t) ? t : "hom-nay";
}

export function TodayScreen({ child, initial, initialTab, byEnabled }: { child: Child; initial: TodayView | null; initialTab: Tab; byEnabled: boolean }) {
  const [view, setView] = useState<TodayView | null>(initial);
  // R2: the 5 tabs. Hôm nay / Góc học tập / Tuần / Góp ý share this screen (and its state).
  const [tab, setTab] = useState<Tab>(initialTab);
  const tabRef = useRef<Tab>(initialTab);
  // R6c: "🎯 Chế độ tập trung" of Góc học tập (off again whenever the tab changes).
  const [studyFocus, setStudyFocus] = useState(false);
  // R6c "← Quay lại": the tabs the child came from (last 10), falling back to Hôm nay.
  const [tabHistory, setTabHistory] = useState<Tab[]>([]);
  const loadWeekRef = useRef<() => Promise<void>>(async () => {});
  const selectTab = useCallback((t: Tab, opts?: { back?: boolean }) => {
    if (t === tabRef.current) return;
    if (!opts?.back) {
      const from = tabRef.current;
      setTabHistory((h) => [...h, from].slice(-10));
    }
    tabRef.current = t;
    setTab(t);
    setStudyFocus(false);
    window.history.pushState(null, "", tabHref(t));
    window.scrollTo({ top: 0 });
    void loadWeekRef.current();
  }, []);
  useEffect(() => {
    const onPop = () => {
      tabRef.current = tabFromUrl();
      setTab(tabRef.current);
      setStudyFocus(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // The child's own week (feelings + 4 areas): a child-only route, never part of TodayView.
  const [week, setWeek] = useState<WeekDaysView | null>(null);
  const weekAt = useRef(0);
  // Fetched only where it is shown (Hôm nay, Tuần), at most once a minute unless forced.
  const loadWeek = useCallback(async (force = false) => {
    if (tabRef.current !== "hom-nay" && tabRef.current !== "tuan") return;
    if (!force && Date.now() - weekAt.current < 60_000) return;
    weekAt.current = Date.now();
    try {
      const res = await fetch("/api/week/days", { cache: "no-store" });
      if (res.ok) setWeek((await res.json()) as WeekDaysView);
    } catch {
      /* the chart just waits for the next try */
    }
  }, []);
  const [error, setError] = useState<string | null>(initial ? null : "Chưa tải được việc hôm nay. Đang thử lại…");
  const [busy, setBusy] = useState<string | null>(null);
  // Focus mode opens for a running task unless the child minimised THAT task.
  const [minimized, setMinimized] = useState<string | null>(null);
  // A running task the child asked to open (e.g. a skill while homework also runs).
  const [focusKey, setFocusKey] = useState<string | null>(null);
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
      void loadWeek();
    } catch {
      setError("Mất kết nối với máy chủ. Đang thử lại…");
    }
  }, [accept, router, loadWeek]);

  useEffect(() => {
    loadWeekRef.current = () => loadWeek();
  }, [loadWeek]);

  useEffect(() => {
    let alive = true;
    weekAt.current = Date.now();
    fetch("/api/week/days", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<WeekDaysView>) : null))
      .then((w) => {
        if (alive && w) setWeek(w);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);

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
      void loadWeek(true);
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
  // R4: An (scientist voice) has her world of the month in the 4th tab.
  const voice = voiceFor(child.grade);
  const hasWorld = voice === "scientist";
  const feelLook = { voice, look: child.look, pics: child.pics };
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
  const steps = daySteps(s);
  const currentStep = steps.findIndex((st) => !st.done);
  // R1 E8: during the 10' break the task buttons pause ("Học tiếp" resumes).
  const paused = s.break.state === "running";
  const pill = statusPill(s, nowMs);
  // Special day (S3d): the sick status pill already says "Ngày ốm" when the sick day decides the state.
  const dayNote = s.status === "OPEN_SICK" ? null : childDayTypeNote(s.dayType);
  const progress = dayProgress(s);
  const next = nextFromPlan(s, view.plan) ?? nextTask(s);
  const planItems = plannable(s).filter((i) => i.state !== "done");
  const showNudge = !view.plan && !s.part1.complete && planItems.length >= 2 && planLater !== s.localDate;
  const planDone = view.plan ? planProgress(s, view.plan) : null;
  const countdownTo = s.status === "BREAK" ? s.break.endsAt : s.status === "FREE" || s.status === "OPEN_OVERRIDE" ? s.openUntil : null;
  const asked = focusKey ? ([...s.part1.items, ...s.part2.items].find((i) => i.key === focusKey && i.state === "running") ?? null) : null;
  const focusItem = paused ? null : (asked ?? (next?.state === "running" && minimized !== next.key ? next : null));
  const proofItem = proofKey ? (s.part1.items.find((i) => i.key === proofKey) ?? null) : null;
  // Finished (e.g. from the phone) or gone: the sheet closes by itself.
  const proofOpen = proofItem !== null && proofItem.state === "running";
  const ctx: TaskCtx = {
    paused,
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
    onFocus: (item) => {
      setMinimized(null);
      setFocusKey(item && item.key !== next?.key ? item.key : null);
    },
    reviewed: new Set(view.reviewed ?? []),
    asked: new Set(view.asked ?? []),
  };
  const firstName = child.name.trim().split(/\s+/).pop() ?? child.name;

  // Shared by Hôm nay and Góc học tập (R2): the status line and the break / free-time buttons.
  const statusTop = (
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
  );
  const controls = (
    <>
      {(s.break.canStart || s.free.canStart) && (
        <div className="flex flex-wrap gap-2">
          {s.free.canStart && (
            <button type="button" disabled={!!busy} onClick={() => void act({ url: "/api/day/free" })} className="btn text-white disabled:opacity-60" style={{ background: color }}>
              Bắt đầu giờ tự do
            </button>
          )}
          {s.break.canStart && (
            <button type="button" disabled={!!busy} onClick={() => void act({ url: "/api/day/break", body: { action: "start" } })} className="btn border-[1.5px] bg-white disabled:opacity-60" style={{ borderColor: color, color }}>
              ☕ Nghỉ {view.rules.breakMinutes} phút (1 lần/ngày)
            </button>
          )}
        </div>
      )}
      {s.break.state === "running" && (
        <button type="button" disabled={!!busy} onClick={() => void act({ url: "/api/day/break", body: { action: "end" } })} className="btn self-start text-white disabled:opacity-60" style={{ background: color }}>
          Học tiếp
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-dvh pb-24 lg:pb-0 lg:pl-52">
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
      {focusItem && <FocusView item={focusItem} ctx={ctx} dark={shade(color)} onClose={() => {
            setFocusKey(null);
            setMinimized(focusItem.key);
          }} />}
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
            {child.look && (
              // R6b (artifact, item J): the child's own character greets them; a tap opens the creator.
              <Link href="/nhan-vat" aria-label="Nhân vật của con" className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
                <Character look={child.look} pics={child.pics} expr="smile" className="size-full" />
              </Link>
            )}
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
          <ol aria-label="Tiến trình hôm nay" className="grid grid-cols-3 gap-1.5">
            {steps.map((st, i) => (
              <li key={st.label} aria-current={i === currentStep ? "step" : undefined} className="flex flex-col gap-1.5">
                <span className="h-1.5 rounded-full" style={{ background: st.done ? "#FFFFFF" : "rgba(255,255,255,0.3)" }} />
                <span className={`text-xs ${st.done ? "font-bold" : "opacity-85"}`}>
                  {st.done ? "✓ " : ""}
                  {st.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-5">
        <Breadcrumb
          trail={tab === "hom-nay" ? [tabLabel("hom-nay")] : [tabLabel("hom-nay"), tabLabel(tab, hasWorld)]}
          onBack={
            tab === "hom-nay"
              ? undefined
              : () => {
                  // Skip entries equal to this tab (e.g. after the browser's own Back button).
                  let h = tabHistory;
                  while (h.length > 0 && h.at(-1) === tab) h = h.slice(0, -1);
                  setTabHistory(h.slice(0, -1));
                  selectTab(h.at(-1) ?? "hom-nay", { back: true });
                }
          }
        />
        {error && !dialog && !proofOpen && (
          <p role="alert" className="rounded-xl border border-red-200 bg-white p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {tab === "hom-nay" && (
          <>
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

            {hasWorld && <WorldMini key={`${s.part1.doneAt}|${s.part2.doneAt}|${s.free.startedAt}`} onOpen={() => selectTab("tuan")} />}

            {byEnabled && (
              <section aria-labelledby="by-invite" className="flex flex-col gap-3 rounded-[20px] bg-white p-4" style={{ boxShadow: "0 6px 18px rgba(28,31,29,0.08)" }}>
                <FeelInvite voice={voice} feelLook={feelLook} today={week?.days.find((d) => d.date === s.localDate)?.feel ?? null} />
                {week && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-ink/70">Cảm xúc tuần này của con</span>
                    <FeelWeek week={week} color={color} feelLook={feelLook} />
                  </div>
                )}
              </section>
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

            <PillarCards
              s={s}
              view={view}
              today={week?.days.find((d) => d.date === s.localDate) ?? null}
              byEnabled={byEnabled}
              color={color}
              nowMs={nowMs}
              freeMinutes={view.rules.freeMinutes}
              voice={voice}
              ctx={ctx}
              onStudy={() => selectTab("hoc-tap")}
            />

            <section
              aria-live="polite"
              aria-label="Trạng thái hôm nay"
              className="flex flex-col gap-4 rounded-[20px] border-2 bg-white px-4 py-4"
              style={{ borderColor: color, boxShadow: "0 6px 18px rgba(28,31,29,0.08)" }}
            >
              {statusTop}
              {controls}
              {next && !paused && (
                <div className="border-t border-ink/10 pt-4">
                  <NextTask item={next} ctx={ctx} />
                </div>
              )}
              {planDone && (
                <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3 text-sm">
                  <span className="font-semibold">
                    Theo thứ tự của con · {planDone.done}/{planDone.total} xong
                  </span>
                  <button type="button" onClick={() => selectTab("hoc-tap")} className="ml-auto min-h-11 px-2 font-semibold underline" style={{ color }}>
                    Xếp lại ở Góc học tập
                  </button>
                </div>
              )}
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
          </>
        )}

        {tab === "hoc-tap" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[22px] font-bold">📚 Góc học tập</h2>
              <button
                type="button"
                aria-pressed={studyFocus}
                onClick={() => setStudyFocus(!studyFocus)}
                className="btn shrink-0 border-[1.5px] text-sm"
                style={studyFocus ? { background: color, borderColor: color, color: "#fff" } : { background: "#fff", borderColor: color, color }}
              >
                {studyFocus ? "Thoát tập trung" : "🎯 Chế độ tập trung"}
              </button>
            </div>
            <section aria-label="Trạng thái hôm nay" aria-live="polite" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3">
              {statusTop}
              {controls}
            </section>
            <StudyCorner
              s={s}
              view={view}
              ctx={ctx}
              color={color}
              busy={!!busy}
              paused={paused}
              onSavePlan={(keys) => act({ url: "/api/day/plan", body: { keys } })}
              suggested={next}
              focus={studyFocus}
            />
          </>
        )}

        {tab === "tuan" && (
          <>
            {hasWorld && <WorldTab color={color} />}
            <section aria-labelledby="wk-own" className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-4">
              <h2 id="wk-own" className="text-lg font-bold">
                Tuần này của con
              </h2>
              {week ? (
                <>
                  {week.byEnabled && <FeelWeek week={week} color={color} big feelLook={feelLook} />}
                  <WeekAreas week={week} color={color} feelLook={feelLook} />
                </>
              ) : (
                <p className="text-sm text-ink/70">Đang tải…</p>
              )}
              {!hasWorld && <p className="text-[13px] text-ink/70">Sắp có: Tập truyện của tuần — mỗi ngày một trang.</p>}
            </section>
            <WeekProgress s={s} view={view} color={color} />
          </>
        )}

        {tab === "gop-y" && (
          <section aria-labelledby="gy" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
            <h2 id="gy" className="text-lg font-bold">
              Góp ý cho app
            </h2>
            <p className="text-sm text-ink/75">Con thích gì, chưa thích gì, hay có ý tưởng gì cho app? Bố mẹ đọc hết.</p>
            <FeedbackForm color={color} />
          </section>
        )}
      </main>
      <ChildNav active={tab} byEnabled={byEnabled} color={color} world={hasWorld} onSelect={selectTab} />
    </div>
  );
}
