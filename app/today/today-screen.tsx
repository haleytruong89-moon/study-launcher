"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TaskView } from "@/lib/dayState";
import { compressImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { TodayView } from "@/lib/today/service";
import { MAX_PROOFS, passOffered, runningItems, runningTimedTask } from "@/lib/today/rules";
import { childDayTypeNote } from "@/lib/admin/specialDay";
import { bannerFor, breakLine, dayProgress, daySteps, lockSoonMinutes, nextTask, statusPill } from "@/lib/today/view";
import { NextTask, type Act, type TaskCtx } from "./today-parts";
import { FocusView } from "./focus-view";
import { StartSheet } from "./start-sheet";
import { Breadcrumb, ChildNav } from "../child-nav";
import { tabLabel } from "@/lib/childTabs";
import type { Avatar } from "@/lib/avatar";
import type { AvatarPics } from "@/lib/avatarPics";
import { voiceFor } from "@/lib/binhYen/catalog";
import { PillarCards } from "./pillars";
import { FeelInvite, FeelWeek } from "./tabs";
import { StudyCorner, TutorCard } from "./study-corner";
import { WorldMini } from "./world";
import { ComicToday } from "./comic";
import { IconPicker, PlanNudge, Planner, WeeklyReviewCard } from "./today-extras";
import { ProofSheet } from "./proof-sheet";
import { nextFromPlan, plannable, planProgress } from "@/lib/today/week";
import { noStore, readFocusOpen, readPlanLater, subscribeStorage, writeFocusOpen } from "./today-storage";
import { useChildTabs, type Tab } from "./use-child-tabs";
import { useServerClock } from "./use-server-clock";
import { useWeekDays } from "./use-week-days";
import { useFastPoll, useTodaySync } from "./use-today-sync";
import { useLockSoonTitle } from "./use-lock-soon-title";
import { DayControls, StatusTop } from "./status-card";
import { TodayHeader } from "./today-header";
import { GopYTab, TuanTab } from "./tab-tuan";

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

export function TodayScreen({
  child,
  initial,
  initialTab,
  byEnabled,
  tutor = false,
}: {
  child: Child;
  initial: TodayView | null;
  initialTab: Tab;
  byEnabled: boolean;
  /** Gia sư AI Toán is reachable for this child (lib/tutor/entry.ts): the two doors in Góc học tập. */
  tutor?: boolean;
}) {
  const [view, setView] = useState<TodayView | null>(initial);
  // R2: the 5 tabs (use-child-tabs.ts).
  const { tab, tabRef, studyFocus, setStudyFocus, tabHistory, setTabHistory, loadWeekRef, selectTab } = useChildTabs(initialTab);
  const [error, setError] = useState<string | null>(initial ? null : "Chưa tải được việc hôm nay. Đang thử lại…");
  const [busy, setBusy] = useState<string | null>(null);
  // R7a: the focus screen opens ONLY when the child taps for it. The key of that task, from
  // this tab's sessionStorage after mount (a reload keeps it open), or what was just tapped.
  const storedFocus = useSyncExternalStore(noStore, readFocusOpen, () => null);
  // A tap remembers the run too, so a later run of the same task never opens by itself.
  const [focusChoice, setFocusChoice] = useState<{ key: string | null; runId: string | null } | null>(null);
  const focusKey = focusChoice ? focusChoice.key : storedFocus;
  // R7a: "Bắt đầu rồi ✓" card after a start (memory only: never again after a reload).
  const [started, setStarted] = useState<{ key: string; runId: string | null; opener: Element | null } | null>(null);
  // An's world key (for the focus background), from the world card's own fetch when it ran.
  const [worldKey, setWorldKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"plan" | "icon" | null>(null);
  // "Nộp ảnh bài" sheet: the homework key it is open for, and upload progress.
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  // "Để sau" on the plan nudge: remembered for today on this laptop only (a convenience).
  const storedLater = useSyncExternalStore(subscribeStorage, readPlanLater, () => null);
  const [laterNow, setPlanLater] = useState<string | null>(null);
  const planLater = laterNow ?? storedLater;
  // Server clock offset: countdowns use server time, never the laptop clock alone.
  const { offsetRef, nowMs, setNowMs, accept } = useServerClock(initial, setView);
  // The child's own week (feelings + 4 areas), fetched only where it is shown.
  const { week, loadWeek } = useWeekDays(tabRef, loadWeekRef);
  // /api/today: refresh, 30 s poll, 1-second tick (use-today-sync.ts).
  const refresh = useTodaySync({ view, accept, loadWeek, setError, offsetRef, setNowMs });

  /**
   * POSTs a child action; true when the server accepted it (the new view is shown). A start
   * shows the small "Bắt đầu rồi ✓" card (R7a), unless `sheet` is false.
   */
  async function act({ url, body, confirm }: Act, opts?: { sheet?: boolean }): Promise<boolean> {
    if (confirm && !window.confirm(confirm)) return false;
    const opener = document.activeElement;
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
      if (url === "/api/tasks/start" && opts?.sheet !== false) {
        const b = (body ?? {}) as { source?: string; id?: string };
        // R8a: "Làm thêm" on a done task shows the same card, for its extra run.
        const item = runningItems(data.state).find((i) => i.source === b.source && i.id === b.id);
        if (item) setStarted({ key: item.key, runId: item.runId, opener });
      }
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
    if (item.state === "todo" && !(await act({ url: "/api/tasks/start", body: { source: item.source, id: item.id } }, { sheet: false }))) return;
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

  // R7a: forget the open focus screen once its task stops running (finished, or a new day).
  useEffect(() => {
    if (!view || !storedFocus) return;
    const still = runningItems(view.state).some((i) => i.key === storedFocus);
    if (!still) writeFocusOpen(null);
  }, [view, storedFocus]);

  // Check often while something is in progress, so a photo sent from the phone or a parent's
  // confirmation shows here within seconds (the clock never keeps running after "done").
  const sheetOpen = !!proofKey && !!view?.state.part1.items.some((i) => i.key === proofKey && i.state === "running");
  const anyRunning = !!view && runningItems(view.state).length > 0;
  const fastMs = sheetOpen ? 4000 : anyRunning ? 10_000 : 0;
  useFastPoll(fastMs, refresh);

  // D2 A2: the tab title in the last 5 minutes of a break / free time (use-lock-soon-title.ts).
  const soonMinutes = view ? lockSoonMinutes(view.state, nowMs) : null;
  useLockSoonTitle(soonMinutes);

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
  // R8b: the break counts down in whole minutes (breakLine below), never in seconds.
  const countdownTo = s.status === "FREE" || s.status === "OPEN_OVERRIDE" ? s.openUntil : null;
  const brk = breakLine(s, nowMs);
  // R8a: a "Làm thêm" run is listed as a running task (chip, focus view, start card).
  const running = runningItems(s);
  // Shown only when the child asked for it, while that task runs, and not during the break.
  const focusItem = paused || !focusKey ? null : (running.find((i) => i.key === focusKey && (!focusChoice || i.runId === focusChoice.runId)) ?? null);
  const startedItem = started && !focusItem ? (running.find((i) => i.key === started.key && i.runId === started.runId) ?? null) : null;
  const openFocus = (item: TaskView | null | undefined) => {
    if (!item || item.state !== "running") return;
    setStarted(null);
    setFocusChoice({ key: item.key, runId: item.runId });
    writeFocusOpen(item.key);
  };
  const closeFocus = () => {
    setFocusChoice({ key: null, runId: null });
    writeFocusOpen(null);
  };
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
    onFocus: (item) => openFocus(item ?? next),
    reviewed: new Set(view.reviewed ?? []),
    asked: new Set(view.asked ?? []),
  };
  const firstName = child.name.trim().split(/\s+/).pop() ?? child.name;

  // Shared by Hôm nay and Góc học tập (R2): the status line and the break / free-time buttons.
  const statusTop = <StatusTop banner={banner} soonMinutes={soonMinutes} countdownTo={countdownTo} nowMs={nowMs} color={color} />;
  const controls = <DayControls s={s} brk={brk} breakMinutes={view.rules.breakMinutes} busy={busy} color={color} onAct={act} />;

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
      {/* Sibling keys must differ: the focus view, the start card and the photo sheet can be for
          the same task, and a shared key left the focus view behind when both closed at once. */}
      {focusItem && <FocusView key={`focus:${focusItem.key}`} item={focusItem} ctx={ctx} voice={voice} worldKey={worldKey} onClose={closeFocus} />}
      {startedItem && started && (
        <StartSheet key={`start:${startedItem.key}`} item={startedItem} color={color} opener={started.opener} onFocus={() => openFocus(startedItem)} onClose={() => setStarted(null)} />
      )}
      {proofOpen && proofItem && (
        <ProofSheet
          key={`proof:${proofItem.key}`}
          item={proofItem}
          color={color}
          max={Math.max(0, MAX_PROOFS - proofItem.proofCount)}
          sending={sending}
          error={error}
          onSend={(files) => proofAndFinish(proofItem, files)}
          asked={!!proofItem.runId && (view.asked ?? []).includes(proofItem.runId)}
          onAsk={() => act({ url: "/api/tasks/confirm-request", body: { runId: proofItem.runId } })}
          onClose={() => setProofKey(null)}
        />
      )}

      <TodayHeader
        child={child}
        color={color}
        icon={view.icon}
        firstName={firstName}
        s={s}
        progress={progress}
        running={running}
        nowMs={nowMs}
        paused={paused}
        pill={pill}
        dayNote={dayNote}
        steps={steps}
        currentStep={currentStep}
        onOpen={openFocus}
        onIcon={() => {
          setError(null);
          setDialog("icon");
        }}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-5">
        <Breadcrumb
          trail={tab === "hom-nay" ? [tabLabel("hom-nay")] : [tabLabel("hom-nay"), tabLabel(tab, voice)]}
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

            {hasWorld && <WorldMini key={`${s.part1.doneAt}|${s.part2.doneAt}|${s.free.startedAt}`} onOpen={() => selectTab("tuan")} onWorld={setWorldKey} />}
            {/* R5: Nguyên's comic page of today (the feeling frame only when Góc bình yên is on). */}
            {voice === "detective" && week && (
              <ComicToday
                key={s.localDate}
                week={week}
                s={s}
                look={child.look}
                pics={child.pics}
                freeMinutes={view.rules.freeMinutes}
                byEnabled={byEnabled && week.byEnabled}
                color={color}
                onOpen={() => selectTab("tuan")}
              />
            )}

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
              {/* R7a: renamed so it is not confused with the focus screen; same behaviour. */}
              <button
                type="button"
                onClick={() => setStudyFocus(!studyFocus)}
                className="btn shrink-0 border-[1.5px] text-sm"
                style={studyFocus ? { background: color, borderColor: color, color: "#fff" } : { background: "#fff", borderColor: color, color }}
              >
                {studyFocus ? "Hiện cả danh sách" : "Chỉ hiện bài này"}
              </button>
            </div>
            <section aria-label="Trạng thái hôm nay" aria-live="polite" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3">
              {statusTop}
              {controls}
            </section>
            {tutor && !studyFocus && <TutorCard color={color} />}
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
              tutor={tutor}
            />
          </>
        )}

        {tab === "tuan" && <TuanTab s={s} view={view} week={week} child={child} voice={voice} hasWorld={hasWorld} feelLook={feelLook} color={color} onWorld={setWorldKey} />}

        {tab === "gop-y" && <GopYTab color={color} />}
      </main>
      <ChildNav active={tab} byEnabled={byEnabled} color={color} voice={voice} onSelect={selectTab} />
    </div>
  );
}
