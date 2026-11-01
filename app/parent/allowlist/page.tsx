import { GROUP_LABEL } from "@/lib/admin/allowlist";
import { loadChildren, requireParentPage } from "@/lib/admin/page";
import { hostnameOf } from "@/lib/admin/schemas";
import { vnTime } from "@/lib/today/view";
import { ParentHeader } from "../parent-header";
import { PRESETS } from "@/lib/admin/presets";
import { AllowAddForm, AllowRemoveButton } from "./allow-forms";
import { PresetButtons } from "./preset-buttons";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  child_id: string | null;
  domain: string;
  grp: string;
  expires_at: string | null;
}

/** "Trang học" (S3d): sites the children may open while the laptop is in study time. */
export default async function AllowlistPage() {
  const { db } = await requireParentPage();
  const children = await loadChildren(db);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();
  const [{ data }, { data: slots }] = await Promise.all([
    db.from("allowlist_entries").select("id, child_id, domain, grp, expires_at").order("domain"),
    db.from("app_slots").select("label, url, allow_domains, active, kind, child_id"),
  ]);
  const rows = ((data ?? []) as Row[]).filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now);
  const who = (id: string | null) => (id === null ? "Cả 2 con" : (children.find((c) => c.id === id)?.display_name ?? "Con"));
  const slotDomains = (slots ?? [])
    .filter((s) => s.active && s.kind !== "placeholder")
    .flatMap((s) => [s.url ? hostnameOf(s.url) : null, ...((s.allow_domains as string[] | null) ?? [])].filter((d): d is string => !!d).map((d) => ({ d, label: s.label as string })));

  return (
    <>
      <ParentHeader title="Trang học được mở" current="/parent/allowlist" />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
        <p className="text-sm text-ink/70">
          Khi máy đang giờ học, con chỉ mở được các trang dưới đây (và các app ở “App môn học”). Google Search và YouTube không thêm vĩnh viễn được — chỉ mở 15 phút hoặc đến hết hôm nay.
        </p>
        <PresetButtons presets={PRESETS} have={rows.filter((r) => r.child_id === null && r.expires_at === null).map((r) => r.domain)} />
        <AllowAddForm kids={children.map((c) => ({ id: c.id, name: c.display_name, color: c.color }))} />

        <section aria-labelledby="al-list" className="flex flex-col gap-2">
          <h2 id="al-list" className="text-base font-bold">
            Danh sách ({rows.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2" aria-label={r.domain}>
                <div className="flex min-w-0 grow flex-col">
                  <span className="font-semibold break-all">{r.domain}</span>
                  <span className="text-xs text-ink/70">
                    {who(r.child_id)} · {GROUP_LABEL[r.grp] ?? r.grp}
                    {r.expires_at ? ` · đến ${vnTime(r.expires_at)}` : " · luôn luôn"}
                  </span>
                </div>
                {r.grp !== "system" && <AllowRemoveButton id={r.id} domain={r.domain} />}
              </li>
            ))}
          </ul>
        </section>

        {slotDomains.length > 0 && (
          <section aria-labelledby="al-slots" className="flex flex-col gap-2">
            <h2 id="al-slots" className="text-base font-bold">
              Từ “App môn học”
            </h2>
            <p className="text-xs text-ink/65">Sửa ở trang App môn học.</p>
            <ul className="flex flex-wrap gap-2">
              {slotDomains.map((s) => (
                <li key={`${s.label}-${s.d}`} className="rounded-full bg-white px-3 py-1.5 text-sm" title={s.label}>
                  {s.d}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
