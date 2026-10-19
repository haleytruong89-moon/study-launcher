import type { TaskRow, Tone } from "@/lib/parent/overview";

export const TONE: Record<Tone, string> = {
  late: "bg-[#F7DCD6] text-[#8A2B1F]",
  todo: "bg-[#ECEDE7] text-[#3D423F]",
  run: "bg-[#DCE8F7] text-[#1F4778]",
  wait: "bg-[#FBE9D3] text-[#6B3A0A]",
  ok: "bg-[#DDEBE5] text-[#1E443A]",
  bad: "bg-[#F7DCD6] text-[#8A2B1F]",
};

export function Tag({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-bold whitespace-nowrap ${TONE[tone]}`}>{label}</span>;
}

/** A titled group of task rows ("Quá hạn", "Phải xong hôm nay", "Sắp tới"). */
export function TaskGroup({ title, rows, danger = false, more }: { title: string; rows: TaskRow[]; danger?: boolean; more?: React.ReactNode }) {
  if (rows.length === 0 && !more) return null;
  return (
    <div className="flex flex-col">
      <h3 className={`mt-3 mb-0.5 text-xs font-extrabold tracking-wider uppercase ${danger ? "text-[#8A2B1F]" : "text-ink/70"}`}>
        {title} ({rows.length})
      </h3>
      <ul>
        {rows.map((r) => (
          <li key={r.key} aria-label={r.title} className="flex min-h-11 items-center gap-2.5 border-t border-ink/10 py-2 first:border-t-0">
            <div className="flex min-w-0 grow flex-col">
              <span className="font-bold">{r.title}</span>
              {r.meta && <span className="text-[13px] text-ink/70">{r.meta}</span>}
            </div>
            <Tag {...r.tag} />
          </li>
        ))}
      </ul>
      {more}
    </div>
  );
}
