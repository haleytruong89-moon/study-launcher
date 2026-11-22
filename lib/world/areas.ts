import type { DayState, TaskView } from "@/lib/dayState/types";

export interface AreaCount {
  done: number;
  total: number;
}

/**
 * Parent decision 22/11/2026: in An's world, the Học tập plant grows from SCHOOL HOMEWORK only
 * (due homework, or the "làm trước" quota on a day with none); BÀI BỔ SUNG counts with Kỹ năng
 * ("skill improve"), together with the skills of the day. Display only: what is done, locked or
 * open, the break and free time keep the Phần 1 / Phần 2 rules (DESIGN §5). Pure.
 */
export function worldProgress(s: DayState): { study: AreaCount; skill: AreaCount } {
  const counted = (items: TaskView[]) => items.filter((i) => !i.placeholder && i.group !== "upcoming");
  const homework = s.part1.items.filter((i) => i.source === "homework");
  const due = counted(homework);
  const pick = s.part1.pick;
  const study = {
    total: due.length + pick.needed,
    done: due.filter((i) => i.doneAt !== null).length + Math.min(pick.done, pick.needed),
  };
  const practice = counted([...s.part1.items.filter((i) => i.source !== "homework"), ...s.part2.items]);
  const skill = { total: practice.length, done: practice.filter((i) => i.doneAt !== null).length };
  return { study, skill };
}

/** The areas finished today under the rule above (an area with no task grows nothing). */
export function worldAreasDone(s: DayState): ("study" | "skill")[] {
  const p = worldProgress(s);
  return (["study", "skill"] as const).filter((k) => p[k].total > 0 && p[k].done === p[k].total);
}
