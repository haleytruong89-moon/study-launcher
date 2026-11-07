/**
 * The child's 5 tabs (R2, docs/MAN_CHINH_MOI.md §2.1). Plain data + helpers usable on the server
 * (the /today page reads ?tab=) and in the browser (app/child-nav.tsx).
 */
export type ChildTab = "hom-nay" | "hoc-tap" | "binh-yen" | "tuan" | "gop-y";
export type TodayTab = Exclude<ChildTab, "binh-yen">;

export const TAB_LABELS: Record<ChildTab, string> = {
  "hom-nay": "Hôm nay",
  "hoc-tap": "Góc học tập",
  "binh-yen": "Góc bình yên",
  tuan: "Tuần của con",
  "gop-y": "Góp ý",
};

export function tabHref(tab: ChildTab): string {
  if (tab === "binh-yen") return "/binh-yen";
  return tab === "hom-nay" ? "/today" : `/today?tab=${tab}`;
}

export function isChildTab(v: unknown): v is TodayTab {
  return v === "hom-nay" || v === "hoc-tap" || v === "tuan" || v === "gop-y";
}
