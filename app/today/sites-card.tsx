"use client";

import { useState } from "react";
import type { SiteGroup } from "@/lib/today/sites";

type Load = { state: "closed" } | { state: "loading" } | { state: "error" } | { state: "open"; groups: SiteGroup[] };

/**
 * "Trang con mở được lúc này" (16/11/2026): a folded card in Góc học tập. Opening it asks the
 * server once (GET /api/sites). Links open in a new tab. Read only: the child cannot change the
 * list, and the extension still decides what opens.
 */
export function SitesCard({ color }: { color: string }) {
  const [load, setLoad] = useState<Load>({ state: "closed" });

  async function open() {
    setLoad({ state: "loading" });
    try {
      const r = await fetch("/api/sites", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { groups: SiteGroup[] };
      setLoad({ state: "open", groups: d.groups });
    } catch {
      setLoad({ state: "error" });
    }
  }

  const expanded = load.state === "open";
  return (
    <section aria-label="Trang con mở được" className="flex flex-col gap-2.5 rounded-[20px] border border-ink/10 bg-white p-[18px]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => (expanded ? setLoad({ state: "closed" }) : void open())}
        className="flex min-h-11 items-center justify-between gap-2 text-left font-bold"
      >
        <span>
          <span aria-hidden>🌐 </span>Trang con mở được lúc này
        </span>
        <span aria-hidden style={{ color }}>
          {expanded ? "▴" : "›"}
        </span>
      </button>
      {load.state === "loading" && <p className="text-sm text-ink/70">Đang tải…</p>}
      {load.state === "error" && <p className="text-sm text-[#A3341F]">Chưa tải được danh sách. Thử lại sau ít phút.</p>}
      {load.state === "open" && (
        <>
          <p className="text-[13px] text-ink/70">Khi máy chỉ mở trang học, con vẫn vào được các trang này. Cần trang khác thì bấm “Xin mở” trên trang bị chặn.</p>
          {load.groups.length === 0 && <p className="text-sm text-ink/70">Bố mẹ chưa thêm trang nào.</p>}
          {load.groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-1">
              <h3 className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">{g.title}</h3>
              <ul className="flex flex-col">
                {g.links.map((l) => (
                  <li key={`${g.title}|${l.href}|${l.label}`} className="border-t border-ink/10 first:border-t-0">
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between gap-2 py-1.5">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{l.label}</span>
                        {l.sub && <span className="truncate text-[13px] text-ink/70">{l.sub}</span>}
                      </span>
                      <span aria-hidden style={{ color }}>
                        ↗
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
