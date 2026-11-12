"use client";

import Link from "next/link";
import type { DayState, TaskView } from "@/lib/dayState";
import type { Avatar } from "@/lib/avatar";
import type { AvatarPics } from "@/lib/avatarPics";
import { longDate } from "@/lib/today/view";
import { Character } from "../avatar-face";
import { SignOutButton } from "../sign-out-button";
import { TalkPanel } from "../binh-yen/talk-panel";
import { ProgressRing } from "./today-parts";
import { RunningChip } from "./running-chip";

/** The coloured header of the Today screen: greeting, progress ring, running chip, pills, steps. */
export function TodayHeader({
  child,
  color,
  icon,
  firstName,
  s,
  progress,
  running,
  nowMs,
  paused,
  pill,
  dayNote,
  steps,
  currentStep,
  onOpen,
  onIcon,
}: {
  child: { name: string; grade: number | null; look: Avatar | null; pics: AvatarPics };
  color: string;
  icon: string | null;
  firstName: string;
  s: DayState;
  progress: { done: number; total: number };
  running: TaskView[];
  nowMs: number;
  paused: boolean;
  pill: { label: string; open: boolean };
  dayNote: string | null;
  steps: { label: string; done: boolean }[];
  currentStep: number;
  onOpen: (item: TaskView) => void;
  onIcon: () => void;
}) {
  return (
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
            onClick={onIcon}
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-white/55 bg-white/15 text-2xl font-bold"
          >
            {icon ?? firstName[0]?.toUpperCase() ?? "?"}
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
        <RunningChip running={running} nowMs={nowMs} paused={paused} onOpen={onOpen} />
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
  );
}
