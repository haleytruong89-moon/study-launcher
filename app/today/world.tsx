"use client";

import { useEffect, useState } from "react";
import type { AnimalView, MonthView, ThingView, WorldResponse } from "@/lib/world/rules";
import type { Pillar } from "@/lib/world/types";
import { WorldIcon } from "../world-icon";
import { Modal } from "./today-extras";

/**
 * R4: An's world of the month (docs/MAN_CHINH_MOI.md §4). Shows what grew — never what was
 * missed: no wilting, no streak, no score. The server decides what grows; this only shows it.
 */

const PILLAR_AREA: Record<Pillar, string> = { feel: "Cảm xúc", study: "Học tập", skill: "Kỹ năng", play: "Vui chơi" };
const MONTHS = ["", "tháng 1", "tháng 2", "tháng 3", "tháng 4", "tháng 5", "tháng 6", "tháng 7", "tháng 8", "tháng 9", "tháng 10", "tháng 11", "tháng 12"];
export const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7))] ?? ""}/${m.slice(0, 4)}`;

type Load = { state: "loading" } | { state: "error"; text: string } | { state: "ok"; data: WorldResponse };

function useWorld(month: string | null): [Load, () => void] {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fetch(month ? `/api/world?month=${month}` : "/api/world", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as (WorldResponse & { error?: string }) | null;
        if (!live) return;
        if (res.ok && data && "album" in data) setLoad({ state: "ok", data });
        else setLoad({ state: "error", text: data?.error ?? "Chưa tải được, thử lại sau." });
      })
      .catch(() => live && setLoad({ state: "error", text: "Mất kết nối mạng, thử lại sau." }));
    return () => {
      live = false;
    };
  }, [month, tick]);
  return [load, () => setTick((t) => t + 1)];
}

/** Size grows with how many times it grew (1 → 3+), never shrinks. */
const sizeOf = (count: number) => 34 + Math.min(count - 1, 3) * 8;

type Card = { kind: "thing"; v: ThingView; area: string } | { kind: "animal"; v: AnimalView };

function Scene({ view, onOpen }: { view: MonthView; onOpen: (c: Card) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl" style={{ background: view.world.land }}>
      <div className="flex min-h-14 flex-wrap items-center gap-2 px-3 py-2" style={{ background: view.world.sky }}>
        {view.animals.length === 0 ? (
          <span className="text-sm text-ink/70">Chưa có con vật nào ghé. Chúng sẽ tự đến khi rừng có thứ chúng cần.</span>
        ) : (
          view.animals.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => onOpen({ kind: "animal", v: a })}
              aria-label={`${a.name}, đến ngày ${a.arrived}${a.today ? ", mới đến hôm nay" : ""}`}
              className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-white/50"
            >
              <WorldIcon icon={a.icon} size={36} />
              {a.today && <span aria-hidden className="absolute -top-1 -right-1 rounded-full bg-white px-1 text-[10px] font-bold text-ink">mới</span>}
            </button>
          ))
        )}
      </div>
      <ul aria-label="Những thứ đã mọc" className="flex min-h-28 flex-wrap items-end gap-1 px-3 pt-4 pb-3">
        {view.things.length === 0 && <li className="text-sm text-ink/75">Khu đất còn trống. Xong mảng đầu tiên hôm nay là có thứ mọc lên!</li>}
        {view.things.map((t) => (
          <li key={t.key}>
            <button
              type="button"
              onClick={() => onOpen({ kind: "thing", v: t, area: view.world.pillarNames[t.pillar] })}
              aria-label={`${t.name}, đã mọc ${t.count} lần${t.today ? ", có mọc hôm nay" : ""}`}
              className="relative flex min-h-11 min-w-11 flex-col items-center justify-end rounded-xl px-1 hover:bg-white/40"
            >
              <WorldIcon icon={t.icon} size={sizeOf(t.count)} />
              {t.count > 1 && <span className="text-[11px] font-bold text-ink/80">×{t.count}</span>}
              {t.today && <span aria-hidden className="absolute -top-1 -right-1 rounded-full bg-white px-1 text-[10px] font-bold text-ink">mới</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CardView({ card, onClose }: { card: Card; onClose: () => void }) {
  const v = card.v;
  return (
    <Modal title={v.name} onClose={onClose}>
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-bg">
          <WorldIcon icon={v.icon} size={60} />
        </div>
        <p className="text-sm text-ink/75">
          {card.kind === "thing" ? (
            <>
              {card.area} · mọc khi con xong mảng <b>{PILLAR_AREA[card.v.pillar]}</b>
              <br />
              Mọc lần đầu {card.v.firstDate} · đã mọc {card.v.count} lần
            </>
          ) : (
            <>
              Đến vì {card.v.because} · ngày {card.v.arrived}
            </>
          )}
        </p>
      </div>
      <section aria-label="Điều thú vị" className="flex flex-col gap-2">
        <h3 className="font-bold">Điều thú vị</h3>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {v.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ol>
        {card.kind === "thing" && card.v.closed > 0 && (
          <p className="rounded-xl bg-bg p-3 text-sm text-ink/75">
            Còn {card.v.closed} điều nữa: {card.v.name.toLowerCase()} mọc thêm lần nữa thì mở.
          </p>
        )}
      </section>
      <section aria-label="Nhiệm vụ ngoài đời" className="rounded-xl bg-[#EAF3DE] p-3">
        <h3 className="text-sm font-bold">🔎 Nhiệm vụ ngoài đời (nếu con muốn)</h3>
        <p className="text-sm">{v.mission}</p>
      </section>
      <section aria-label="Tối nay dạy cả nhà" className="rounded-xl bg-[#FAEEDA] p-3">
        <h3 className="text-sm font-bold">🍽️ Tối nay dạy cả nhà</h3>
        <p className="text-sm">{v.teach}</p>
      </section>
    </Modal>
  );
}

/** Tab "Thế giới" (An): this month's world, the album of past months. */
export function WorldTab({ color }: { color: string }) {
  const [month, setMonth] = useState<string | null>(null);
  const [load, retry] = useWorld(month);
  const [card, setCard] = useState<Card | null>(null);

  if (load.state === "loading") return <p className="rounded-2xl bg-white p-4 text-sm text-ink/70">Đang mở thế giới của con…</p>;
  if (load.state === "error")
    return (
      <section className="flex flex-col gap-2 rounded-2xl bg-white p-4">
        <p role="alert" className="text-sm">
          {load.text}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={retry} className="btn border border-ink/20 bg-white text-sm">
            Thử lại
          </button>
          {month && (
            <button type="button" onClick={() => setMonth(null)} className="btn border border-ink/20 bg-white text-sm">
              ← Về tháng này
            </button>
          )}
        </div>
      </section>
    );
  const { view, current, album } = load.data;
  if (!view)
    return (
      <p className="rounded-2xl bg-white p-4 text-sm">
        🌍 Thế giới của tháng này sắp mở. Những mảng con làm xong từ đầu tháng vẫn được tính, không mất gì.
      </p>
    );

  return (
    <>
      <section aria-labelledby="world-h" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="world-h" className="text-lg font-bold">
            <span aria-hidden>{view.world.emoji} </span>
            {view.world.name} · {monthLabel(view.month)}
          </h2>
          {!current && (
            <button type="button" onClick={() => setMonth(null)} className="min-h-11 text-sm font-semibold underline" style={{ color }}>
              ← Về tháng này
            </button>
          )}
        </div>
        {current && <p className="text-sm text-ink/75">{view.world.intro}</p>}
        <Scene view={view} onOpen={setCard} />
        <p className="text-sm text-ink/75">
          {view.things.length} thứ đã mọc · {view.animals.length} con vật ghé thăm
          {current && view.waiting > 0 ? ` · còn ${view.waiting} thứ đang chờ trong ${view.world.name.toLowerCase()}` : ""}
        </p>
        <details className="rounded-xl bg-bg p-3 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-bold">Cái gì mọc khi nào?</summary>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            {(["feel", "study", "skill", "play"] as const).map((p) => (
              <li key={p}>
                Xong mảng <b>{PILLAR_AREA[p]}</b> → {view.world.pillarNames[p].toLowerCase()}
              </li>
            ))}
            <li>Mỗi mảng một lần mỗi ngày. Mọc lại thì lớn thêm và mở điều thú vị mới.</li>
            <li>Ngày nghỉ không mất gì cả — chỉ là không có thứ mới.</li>
          </ul>
        </details>
      </section>
      {album.length > 0 && (
        <section aria-labelledby="album-h" className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
          <h2 id="album-h" className="text-lg font-bold">
            Album các tháng
          </h2>
          <div className="flex flex-wrap gap-2">
            {album.map((a) => (
              <button
                key={a.month}
                type="button"
                aria-pressed={month === a.month}
                onClick={() => setMonth(a.month)}
                className="min-h-11 rounded-full border-[1.5px] bg-white px-4 text-sm font-medium"
                style={month === a.month ? { borderColor: color, background: `${color}14` } : { borderColor: "rgb(28 31 29 / 0.15)" }}
              >
                <span aria-hidden>{a.emoji} </span>
                {a.name} · {monthLabel(a.month)}
              </button>
            ))}
          </div>
        </section>
      )}
      {card && <CardView card={card} onClose={() => setCard(null)} />}
    </>
  );
}

/** Hôm nay (An): the world in one line + what grew today; opens the Thế giới tab. */
export function WorldMini({ onOpen }: { onOpen: () => void }) {
  const [load] = useWorld(null);
  if (load.state !== "ok" || !load.data.view) return null;
  const v = load.data.view;
  const today = [...v.things.filter((t) => t.today), ...v.animals.filter((a) => a.today)];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-16 w-full items-center gap-3 rounded-[20px] bg-white p-4 text-left"
      style={{ boxShadow: "0 6px 18px rgba(28,31,29,0.08)" }}
    >
      <span aria-hidden className="text-3xl">
        {v.world.emoji}
      </span>
      <span className="flex grow flex-col">
        <strong className="text-base">
          {v.world.name} của con · {v.things.length} thứ đã mọc
        </strong>
        <span className="flex items-center gap-1 text-sm text-ink/75">
          {today.length > 0 ? (
            <>
              Hôm nay: {today.map((t) => <WorldIcon key={t.key} icon={t.icon} size={22} />)}
              <span className="sr-only">{today.map((t) => t.name).join(", ")}</span>
            </>
          ) : (
            "Xong một mảng hôm nay là có thứ mới mọc."
          )}
        </span>
      </span>
      <span aria-hidden className="text-xl text-ink/50">
        ›
      </span>
    </button>
  );
}
