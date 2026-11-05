import Link from "next/link";
import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { loadChildrenToday, type ChildToday } from "@/lib/parent/load";
import { DAY_TYPE_INFO, specialDayWindow, type TemplateForDay } from "@/lib/admin/specialDay";
import { suggestionText, TRUST_DISMISSED, TRUST_SET, trustSuggestion, weekStartIso, type TrustDecisionRow } from "@/lib/admin/trust";
import { localDate } from "@/lib/time";
import { dayMonth, longDate, vnTime } from "@/lib/today/view";
import { OverrideSheet } from "./override-sheet";
import { ParentHeader } from "./parent-header";
import { RefreshEvery } from "./refresh-every";
import { SpecialDaySheet, type SpecialDayRow } from "./special-day-sheet";
import { TaskGroup } from "./task-rows";
import { TrustCard } from "./trust-card";

export const dynamic = "force-dynamic";

/** Parent home "Hôm nay" (UI review 19/10/2026): what needs me, then each child's day. */
export default async function ParentHome() {
  const { me, db } = await requireParentPage();
  const children = await loadChildren(db);
  const now = new Date();
  const today = localDate(now);

  if (children.length === 0) {
    return (
      <>
        <ParentHeader title={`Xin chào ${me.profile.display_name}`} current="/parent" />
        <main className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-6">
          <p className="text-sm text-ink/75">Bắt đầu bằng việc tạo tài khoản cho con.</p>
          {/* The form lives on its own page: the credentials it shows once must survive the refresh. */}
          <Link href="/parent/children" className="btn bg-accent text-white">
            Tạo tài khoản cho con
          </Link>
        </main>
      </>
    );
  }

  const range = specialDayWindow(now);
  const [kids, { count: pending }, templateRes, specialRes, rulesRes, decisionsRes] = await Promise.all([
    loadChildrenToday(db, me.profile.family_id, children, today, now),
    db.from("unlock_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("task_templates").select("id, child_id, part, title, weekdays, sort, active").eq("active", true),
    db
      .from("day_sessions")
      .select("child_id, local_date, day_type, disabled_template_ids")
      .gte("local_date", range.from)
      .lte("local_date", range.to)
      .neq("day_type", "normal")
      .order("local_date"),
    db.from("family_settings").select("trust_up_pct, trust_down_pct").maybeSingle(),
    // Trust decisions already made this week (switch or "Để sau") hide the suggestion until Monday.
    db.from("audit_log").select("action, payload, created_at").in("action", [TRUST_SET, TRUST_DISMISSED]).gte("created_at", weekStartIso(today)),
  ]);
  const trustRules = {
    trustUpPct: (rulesRes.data?.trust_up_pct as number | undefined) ?? 90,
    trustDownPct: (rulesRes.data?.trust_down_pct as number | undefined) ?? 70,
  };
  const decisions = (decisionsRes.data ?? []) as TrustDecisionRow[];
  type TemplateRow = TemplateForDay & { child_id: string };
  type SpecialRow = { child_id: string; local_date: string; day_type: SpecialDayRow["dayType"]; disabled_template_ids: string[] | null };
  const templateRows = (templateRes.data ?? []) as TemplateRow[];
  const specialRows = (specialRes.data ?? []) as SpecialRow[];
  const special = { today, maxDate: range.to, templateRows, specialRows, trustRules, decisions };
  const awaiting = kids.reduce((n, k) => n + (k.overview?.awaiting ?? 0), 0);
  const overdue = kids.reduce((n, k) => n + (k.overview?.overdue.length ?? 0), 0);
  const firstAwaiting = kids.find((k) => (k.overview?.awaiting ?? 0) > 0)?.child.id;
  const askers = kids.filter((k) => (k.overview?.asked ?? 0) > 0);
  const todo = [
    askers.length
      ? {
          href: "/parent/requests#nho-xem",
          text: `${askers.map((k) => k.child.display_name).join(", ")} nhờ bố mẹ xem bài trực tiếp`,
          badge: `${askers.reduce((n, k) => n + (k.overview?.asked ?? 0), 0)} bài`,
        }
      : null,
    pending ? { href: "/parent/requests", text: `Con xin mở ${pending} trang`, badge: `${pending} mới` } : null,
    awaiting ? { href: `/parent/review?con=${firstAwaiting}`, text: `${awaiting} bài có ảnh chờ xem`, badge: null } : null,
    overdue ? { href: "/parent/homework", text: `${overdue} bài quá hạn chưa làm`, badge: null } : null,
  ].filter((t) => t !== null);

  return (
    <>
      <ParentHeader title="Hôm nay của các con" current="/parent" />
      <RefreshEvery seconds={60} />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-4">
        <p className="text-sm font-semibold text-ink/70">
          {longDate(today)} · cập nhật {vnTime(now.toISOString())}
        </p>

        <section aria-labelledby="todo-h" className={`flex flex-col rounded-2xl px-4 py-3 ${todo.length ? "bg-ink text-white" : "bg-white"}`}>
          <h2 id="todo-h" className={`text-xs font-extrabold tracking-wider uppercase ${todo.length ? "text-white/75" : "text-ink/70"}`}>
            Cần bố mẹ làm
          </h2>
          {todo.length === 0 ? (
            <p className="py-2 text-sm">Không có gì cần làm ngay.</p>
          ) : (
            <ul>
              {todo.map((t) => (
                <li key={t.href} className="border-t border-white/15 first:border-t-0">
                  <Link href={t.href} className="flex min-h-12 items-center justify-between gap-2 font-bold">
                    <span>{t.text}</span>
                    <span className="flex items-center gap-2">
                      {t.badge && <span className="rounded-full bg-[#C2412D] px-2 py-0.5 text-xs">{t.badge}</span>}
                      <span aria-hidden>›</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {kids.map((k) => (
          <ChildCard key={k.child.id} kid={k} special={special} />
        ))}
      </main>
    </>
  );
}

interface SpecialData {
  today: string;
  maxDate: string;
  templateRows: (TemplateForDay & { child_id: string })[];
  specialRows: { child_id: string; local_date: string; day_type: SpecialDayRow["dayType"]; disabled_template_ids: string[] | null }[];
  trustRules: { trustUpPct: number; trustDownPct: number };
  decisions: TrustDecisionRow[];
}

function ChildCard({ kid, special }: { kid: ChildToday; special: SpecialData }) {
  const { child, state, overview: o } = kid;
  const templates: TemplateForDay[] = special.templateRows.filter((t) => t.child_id === child.id);
  const days: SpecialDayRow[] = special.specialRows
    .filter((d) => d.child_id === child.id)
    .map((d) => ({ date: d.local_date, dayType: d.day_type, disabledTemplateIds: d.disabled_template_ids ?? [] }));
  const todayType = state?.dayType ?? "normal";
  const todayLabel = todayType === "normal" ? null : DAY_TYPE_INFO[todayType].label;
  const nextSpecial = days.find((d) => d.date > special.today);
  const color = child.color ?? "#2B5D4F";
  const suggestion = state ? trustSuggestion(child.id, state.trust, special.decisions) : null;
  const suggestionCopy = suggestion && state ? suggestionText(suggestion, child.display_name, state.trust, special.trustRules) : null;
  const override =
    state?.status === "OPEN_OVERRIDE" ? `đang mở${state.openUntil ? ` đến ${vnTime(state.openUntil)}` : ""}` : state?.status === "LOCK_OVERRIDE" ? "đang khóa" : null;
  return (
    <section aria-label={child.display_name} className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_0_rgba(28,31,29,.06)]">
      <div className="flex flex-col gap-2.5 px-4 py-3.5 text-white" style={{ background: color }}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">{child.display_name}</h2>
          <span className="flex flex-wrap justify-end gap-1.5">
            {todayLabel && todayLabel !== o?.pill && <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-extrabold" style={{ color }}>{todayLabel}</span>}
            {o && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{o.pill}</span>}
          </span>
        </div>
        {o && state ? (
          <>
            <div className="flex flex-wrap justify-between gap-x-3 text-sm font-semibold" aria-label={`Trạng thái của ${child.display_name}`}>
              <span>
                {o.done}/{o.total} việc xong · {o.minutes} phút
              </span>
              <span>{o.machine}</span>
            </div>
            <div aria-hidden className="h-2 rounded-full bg-white/25">
              <div className="h-2 rounded-full bg-white" style={{ width: `${o.pct}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <OverrideSheet
                childId={child.id}
                name={child.display_name}
                open={state.open}
                override={override}
                now={`${o.pill.toLowerCase()} · ${o.machine.replace("Máy: ", "máy ")}`}
                triggerClass="min-h-11 rounded-xl bg-white font-extrabold"
                triggerStyle={{ color }}
              />
              <Link href={`/parent/review?con=${child.id}`} className="flex min-h-11 items-center justify-center rounded-xl border-[1.5px] border-white/70 font-extrabold">
                {o.awaiting > 0 ? `Xem ảnh · duyệt (${o.awaiting})` : "Xem chi tiết"}
              </Link>
              <SpecialDaySheet
                childId={child.id}
                name={child.display_name}
                today={special.today}
                maxDate={special.maxDate}
                templates={templates}
                days={days}
                triggerClass="col-span-2 min-h-11 rounded-xl border-[1.5px] border-white/70 px-2 text-sm font-bold"
                triggerLabel={
                  todayLabel
                    ? `Ngày đặc biệt · hôm nay: ${todayLabel}`
                    : nextSpecial
                      ? `Ngày đặc biệt · ${DAY_TYPE_INFO[nextSpecial.dayType].label} ${dayMonth(nextSpecial.date)}`
                      : "Ngày đặc biệt (ốm · thi · lễ)"
                }
              />
            </div>
          </>
        ) : (
          <p role="alert" className="text-sm font-semibold">
            Không đọc được trạng thái — thử tải lại trang.
          </p>
        )}
      </div>
      {suggestion && suggestionCopy && <TrustCard childId={child.id} suggestion={suggestion} {...suggestionCopy} />}
      {o && (
        <div className="px-4 pb-3">
          <TaskGroup title="Quá hạn" rows={o.overdue} danger />
          <TaskGroup title="Phải xong hôm nay" rows={o.today} />
          <TaskGroup
            title="Sắp tới"
            rows={o.upcoming}
            more={
              o.upcomingMore > 0 ? (
                <Link href={`/parent/review?con=${child.id}`} className="inline-flex min-h-11 items-center text-sm font-bold text-accent">
                  Xem thêm {o.upcomingMore} bài ›
                </Link>
              ) : undefined
            }
          />
          {o.overdue.length + o.today.length + o.upcoming.length === 0 && <p className="pt-3 text-sm text-ink/70">Hôm nay chưa có việc nào.</p>}
        </div>
      )}
    </section>
  );
}
