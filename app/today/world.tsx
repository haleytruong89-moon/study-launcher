"use client";

import { useEffect, useState } from "react";
import type { AnimalView, MonthView, ThingView, WorldChoice, WorldResponse } from "@/lib/world/rules";
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
  // Vũ trụ has a night sky: light text and labels there.
  const dark = view.world.dark;
  const tag = dark ? "bg-white/90" : "bg-white";
  return (
    <div className="overflow-hidden rounded-2xl" style={{ background: view.world.land }}>
      <div className="flex min-h-14 flex-wrap items-center gap-2 px-3 py-2" style={{ background: view.world.sky }}>
        {view.animals.length === 0 ? (
          <span className={`text-sm ${dark ? "text-white/85" : "text-ink/70"}`}>
            Chưa có {view.world.visitorWord} nào ghé. Sẽ có {view.world.visitorWord} tự đến khi {view.world.name.toLowerCase()} có thứ cần.
          </span>
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
        {view.things.length === 0 && (
          <li className={`text-sm ${dark ? "text-white/85" : "text-ink/75"}`}>Còn trống. Xong mảng đầu tiên hôm nay là có thứ mới!</li>
        )}
        {view.things.map((t) => (
          <li key={t.key}>
            <button
              type="button"
              onClick={() => onOpen({ kind: "thing", v: t, area: view.world.pillarNames[t.pillar] })}
              aria-label={`${t.name}, đã mọc ${t.count} lần${t.today ? ", có mọc hôm nay" : ""}`}
              className="relative flex min-h-11 min-w-11 flex-col items-center justify-end rounded-xl px-1 hover:bg-white/40"
            >
              <WorldIcon icon={t.icon} size={sizeOf(t.count)} />
              {t.count > 1 && <span className={`text-[11px] font-bold ${dark ? "text-white" : "text-ink/80"}`}>×{t.count}</span>}
              {t.today && <span aria-hidden className={`absolute -top-1 -right-1 rounded-full ${tag} px-1 text-[10px] font-bold text-ink`}>mới</span>}
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

/** R4b: the first day(s) of a month — An picks the world (stays the whole month). */
function Chooser({ month, options, color, onChosen, onStale }: { month: string; options: WorldChoice[]; color: string; onChosen: (d: WorldResponse) => void; onStale: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = options.find((o) => o.key === picked) ?? null;

  async function confirm() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/world/choose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ world: chosen.key, month }), cache: "no-store" });
      const data = (await res.json().catch(() => null)) as (WorldResponse & { error?: string }) | null;
      if (res.ok && data && "album" in data) onChosen(data);
      // Picked elsewhere, or a new month began while the page was open: show what is true now.
      else if (res.status === 409) onStale();
      else setError(data?.error ?? "Chưa chọn được, thử lại sau.");
    } catch {
      setError("Mất kết nối mạng, thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="choose-h" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
      <h2 id="choose-h" className="text-lg font-bold">
        🌍 Tháng mới! Con chọn thế giới cho tháng này
      </h2>
      <p className="text-sm text-ink/75">Chọn rồi thì cả tháng ở đó. Những mảng con đã xong từ đầu tháng sẽ mọc ngay khi chọn, không mất gì.</p>
      <ul aria-label="Các thế giới" className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <li key={o.key}>
            <button
              type="button"
              aria-pressed={picked === o.key}
              aria-describedby={`world-intro-${o.key}`}
              onClick={() => setPicked(o.key)}
              className="flex min-h-11 w-full flex-col gap-2 rounded-2xl border-2 bg-white p-3 text-left"
              style={{ borderColor: picked === o.key ? color : "rgb(28 31 29 / 0.12)", background: picked === o.key ? `${color}10` : undefined }}
            >
              <strong className="text-base">
                <span aria-hidden>{o.emoji} </span>
                {o.name}
              </strong>
              <span className="flex items-center gap-1">
                {o.peek.map((p) => (
                  <WorldIcon key={p.name} icon={p.icon} size={28} />
                ))}
                <span className="sr-only">Ví dụ: {o.peek.map((p) => p.name).join(", ")}</span>
              </span>
              <span id={`world-intro-${o.key}`} className="text-sm text-ink/75">
                {o.intro}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="button" disabled={!chosen || busy} onClick={() => void confirm()} className="btn self-start text-white disabled:opacity-50" style={{ background: color }}>
        {chosen ? `Vào ${chosen.name}` : "Chọn một thế giới"}
      </button>
    </section>
  );
}

/** Tab "Thế giới" (An): this month's world, the album of past months. */
export function WorldTab({ color }: { color: string }) {
  const [month, setMonth] = useState<string | null>(null);
  const [fetched, refetch] = useWorld(month);
  // After a pick the route answers with the new world: show it without another round trip
  // (until the next fetch: another month, "Thử lại", a 409).
  const [picked, setPicked] = useState<WorldResponse | null>(null);
  const load: Load = picked && month === null ? { state: "ok", data: picked } : fetched;
  const retry = () => {
    setPicked(null);
    refetch();
  };
  const openMonth = (m: string | null) => {
    setPicked(null);
    setMonth(m);
  };
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
            <button type="button" onClick={() => openMonth(null)} className="btn border border-ink/20 bg-white text-sm">
              ← Về tháng này
            </button>
          )}
        </div>
      </section>
    );
  const { view, current, album, choose } = load.data;
  if (current && choose.length > 0) return <Chooser month={load.data.month} options={choose} color={color} onChosen={setPicked} onStale={retry} />;
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
            <button type="button" onClick={() => openMonth(null)} className="min-h-11 text-sm font-semibold underline" style={{ color }}>
              ← Về tháng này
            </button>
          )}
        </div>
        {current && <p className="text-sm text-ink/75">{view.world.intro}</p>}
        <Scene view={view} onOpen={setCard} />
        <p className="text-sm text-ink/75">
          {view.things.length} thứ đã mọc · {view.animals.length} {view.world.visitorWord} ghé thăm
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
                onClick={() => openMonth(a.month)}
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
  if (load.state === "ok" && load.data.choose.length > 0)
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-16 w-full items-center gap-3 rounded-[20px] bg-white p-4 text-left"
        style={{ boxShadow: "0 6px 18px rgba(28,31,29,0.08)" }}
      >
        <span aria-hidden className="text-3xl">
          🌍
        </span>
        <span className="flex grow flex-col">
          <strong className="text-base">Tháng mới! Chọn thế giới của con</strong>
          <span className="text-sm text-ink/75">{load.data.choose.map((c) => c.name).join(" · ")}</span>
        </span>
        <span aria-hidden className="text-xl text-ink/50">
          ›
        </span>
      </button>
    );
  if (load.state !== "ok" || !load.data.view) return null;
  const v = load.data.view;
  const today = [...v.things.filter((t) => t.today), ...v.animals.filter((a) => a.today)];
  // R6a (artifact, item F): a small picture of the world, what grew today, and the way in.
  const shown = [...v.things, ...v.animals].slice(-12);
  const light = v.world.dark;
  return (
    <section aria-labelledby="world-mini" className="flex flex-col gap-3 rounded-[20px] bg-white p-4" style={{ boxShadow: "0 6px 18px rgba(28,31,29,0.08)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="world-mini" className="text-base font-bold">
          {v.world.emoji} {v.world.name} của con
        </h2>
        <span className="text-sm font-semibold text-ink/70">
          {v.things.length} thứ đã mọc{v.animals.length > 0 ? ` · ${v.animals.length} ${v.world.visitorWord}` : ""}
        </span>
      </div>
      <button type="button" onClick={onOpen} aria-label={`Mở ${v.world.name} của con`} className="block overflow-hidden rounded-2xl text-left" style={{ background: `linear-gradient(${v.world.sky} 55%, ${v.world.land} 55%)` }}>
        <span className="flex min-h-24 flex-wrap items-end gap-1.5 px-3 pt-6 pb-3" aria-hidden>
          {shown.length > 0 ? (
            shown.map((t) => (
              <span key={t.key} className={t.today ? "pop rounded-full ring-2 ring-white" : undefined}>
                <WorldIcon icon={t.icon} size={30} />
              </span>
            ))
          ) : (
            <span className={`text-sm font-semibold ${light ? "text-white" : "text-ink/80"}`}>Còn trống — đang chờ thứ đầu tiên mọc</span>
          )}
        </span>
      </button>
      {today.length > 0 ? (
        <ul aria-label="Hôm nay đã mọc" className="flex flex-wrap gap-1.5">
          {today.map((t) => (
            <li key={t.key} className="flex items-center gap-1 rounded-full bg-bg py-1 pr-3 pl-1 text-sm font-semibold">
              <WorldIcon icon={t.icon} size={22} />
              {t.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/75">Xong một mảng hôm nay (cảm xúc, học tập, kỹ năng, vui chơi) là có thứ mới mọc.</p>
      )}
      <button type="button" onClick={onOpen} className="btn self-start border-[1.5px] border-[#2B5D4F] bg-white text-sm text-[#2B5D4F]">
        Xem cả {v.world.name.toLowerCase()} →
      </button>
    </section>
  );
}
