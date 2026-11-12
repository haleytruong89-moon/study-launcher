"use client";

import type { DayState } from "@/lib/dayState";
import type { Avatar } from "@/lib/avatar";
import type { AvatarPics } from "@/lib/avatarPics";
import type { Voice } from "@/lib/binhYen/catalog";
import type { TodayView } from "@/lib/today/service";
import type { WeekDaysView } from "@/lib/today/weekDays";
import { FeedbackForm } from "./feedback";
import { FeelWeek, WeekAreas, WeekProgress, type FeelLook } from "./tabs";
import { WorldTab } from "./world";
import { ComicVolume } from "./comic";

/** Tab "Tuần": An's world, Nguyên's comic volume, the child's own week and the week progress. */
export function TuanTab({
  s,
  view,
  week,
  child,
  voice,
  hasWorld,
  feelLook,
  color,
  onWorld,
}: {
  s: DayState;
  view: TodayView;
  week: WeekDaysView | null;
  child: { name: string; look: Avatar | null; pics: AvatarPics };
  voice: Voice;
  hasWorld: boolean;
  feelLook: FeelLook;
  color: string;
  onWorld: (key: string | null) => void;
}) {
  return (
    <>
      {hasWorld && <WorldTab color={color} onWorld={onWorld} />}
      {voice === "detective" && (
        <section aria-labelledby="comic-volume" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
          {week ? (
            <ComicVolume key={week.weekStart} week={week} s={s} look={child.look} pics={child.pics} name={child.name} icon={view.icon} freeMinutes={view.rules.freeMinutes} color={color} />
          ) : (
            <p id="comic-volume" className="text-sm text-ink/70">
              Đang tải tập truyện…
            </p>
          )}
        </section>
      )}
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
      </section>
      <WeekProgress s={s} view={view} color={color} />
    </>
  );
}

/** Tab "Góp ý". */
export function GopYTab({ color }: { color: string }) {
  return (
    <section aria-labelledby="gy" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
      <h2 id="gy" className="text-lg font-bold">
        Góp ý cho app
      </h2>
      <p className="text-sm text-ink/75">Con thích gì, chưa thích gì, hay có ý tưởng gì cho app? Bố mẹ đọc hết.</p>
      <FeedbackForm color={color} />
    </section>
  );
}
