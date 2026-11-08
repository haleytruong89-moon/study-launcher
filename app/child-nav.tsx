"use client";

import Link from "next/link";
import type { Voice } from "@/lib/binhYen/catalog";
import { tabHref, tabLabel, type ChildTab } from "@/lib/childTabs";

/**
 * The child's 5 tabs (R2, docs/MAN_CHINH_MOI.md §2.1): a bar at the bottom on the phone, a
 * column on the left of a laptop. Hôm nay / Góc học tập / Tuần / Góp ý live in /today (one
 * screen, one state: switching does not reload); Góc bình yên is its own page (/binh-yen,
 * server-gated) and is hidden when the family has not turned it on.
 */
export { TAB_LABELS, isChildTab, tabHref, tabLabel, type ChildTab } from "@/lib/childTabs";

const ICONS: Record<ChildTab, string> = {
  "hom-nay": "☀️",
  "hoc-tap": "📚",
  "binh-yen": "🌿",
  tuan: "🗓️",
  "gop-y": "💡",
};

const TUAN_ICON: Record<Voice, string> = { scientist: "🌳", detective: "📕" };

export function ChildNav({
  active,
  byEnabled,
  color,
  world = false,
  voice,
  onSelect,
}: {
  /** null: a page that is not one of the tabs (e.g. /nhan-vat). */
  active: ChildTab | null;
  byEnabled: boolean;
  color: string;
  /** R4: An's 4th tab is "Thế giới" (her world of the month). Prefer `voice`. */
  world?: boolean;
  /** R5: the 4th tab by voice — scientist "Thế giới" 🌳, detective "Tập của tuần" 📕. */
  voice?: Voice;
  /** Inside /today: switch the tab without reloading (the link still works without script). */
  onSelect?: (tab: Exclude<ChildTab, "binh-yen">) => void;
}) {
  const fourth: Voice | null = voice ?? (world ? "scientist" : null);
  const tabs: ChildTab[] = byEnabled ? ["hom-nay", "hoc-tap", "binh-yen", "tuan", "gop-y"] : ["hom-nay", "hoc-tap", "tuan", "gop-y"];
  return (
    <nav
      aria-label="Các mục của con"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)] lg:inset-x-auto lg:top-0 lg:left-0 lg:w-52 lg:border-t-0 lg:border-r lg:pb-0"
    >
      <ul className="mx-auto flex max-w-md justify-between lg:mt-24 lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
        {tabs.map((t) => {
          const on = t === active;
          return (
            <li key={t} className="flex-1 lg:flex-none">
              <Link
                href={tabHref(t)}
                aria-current={on ? "page" : undefined}
                onClick={(e) => {
                  if (!onSelect || t === "binh-yen") return;
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  onSelect(t);
                }}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold no-underline lg:min-h-12 lg:flex-row lg:justify-start lg:gap-2.5 lg:rounded-xl lg:px-3 lg:text-sm"
                style={on ? { color, background: `${color}14` } : { color: "#4A4F4C" }}
              >
                <span aria-hidden className="text-xl leading-none lg:text-lg">
                  {t === "tuan" && fourth ? TUAN_ICON[fourth] : ICONS[t]}
                </span>
                <span className="text-center leading-tight">{tabLabel(t, fourth ?? false)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * "Con đang ở: Hôm nay › Góc học tập › Toán" (R2): where the child is, always the same place.
 * R6c (artifact, audit item L): with onBack, a "← Quay lại" button goes back one step.
 */
export function Breadcrumb({ trail, onBack }: { trail: string[]; onBack?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {onBack && (
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-[#D3D8D0] bg-white px-3.5 text-sm font-semibold">
          ← Quay lại
        </button>
      )}
      <nav aria-label="Con đang ở" className="text-[13px] text-ink/70">
        <span className="font-semibold">Con đang ở:</span> {trail.join(" › ")}
      </nav>
    </div>
  );
}
