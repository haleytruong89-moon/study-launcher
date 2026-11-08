"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimalView, MonthView, ThingView, WorldChoice, WorldResponse } from "@/lib/world/rules";
import { PILLARS, type Pillar } from "@/lib/world/types";
import { WorldIcon } from "../world-icon";
import { LivingScene, type Picked } from "./world-scene";

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

type Card = { kind: "thing"; v: ThingView; area: string } | { kind: "animal"; v: AnimalView };

/** The picked thing or visitor of the month view (null once it is not there, e.g. another month). */
function cardOf(view: MonthView, p: Picked | null): Card | null {
  if (!p) return null;
  if (p.kind === "thing") {
    const v = view.things.find((t) => t.key === p.key);
    return v ? { kind: "thing", v, area: view.world.pillarNames[v.pillar] } : null;
  }
  const v = view.animals.find((a) => a.key === p.key);
  return v ? { kind: "animal", v } : null;
}

// "Con đã làm" and "Tối nay dạy cả nhà" are remembered on this device only (parent 08/11:
// nothing stored on the server). Storage may be missing or full: then it is just not remembered.
function readSet(name: string): Set<string> {
  try {
    const v = JSON.parse(window.localStorage.getItem(name) ?? "[]") as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function writeSet(name: string, set: Set<string>) {
  try {
    window.localStorage.setItem(name, JSON.stringify([...set].slice(-200)));
  } catch {
    /* not remembered: fine */
  }
}
const vnToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

/** The card of what An tapped, right under the scene (artifact: no pop-up). */
function Detail({ card, month, onClose }: { card: Card; month: string; onClose: () => void }) {
  // Opening a card moves focus to its name (keyboard and screen readers land on it).
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus(), []);
  const v = card.v;
  const questKey = `${month}:${v.key}`;
  const [done, setDone] = useState(() => readSet("world-quests").has(questKey));
  const teachKey = `${vnToday()}:${v.key}`;
  const [teach, setTeach] = useState(() => readSet("world-teach").has(teachKey));
  const toggle = (name: string, key: string, on: boolean, set: (b: boolean) => void) => {
    const all = readSet(name);
    if (on) all.add(key);
    else all.delete(key);
    writeSet(name, all);
    set(on);
  };
  return (
    <section aria-label={v.name} className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white">
          <WorldIcon icon={v.icon} size={52} />
        </div>
        <div className="flex min-w-0 grow flex-col">
          <span className="text-xs font-semibold tracking-wide text-ink/65 uppercase">
            {card.kind === "thing" ? card.area : `Đến vì ${card.v.because}`}
            {v.today ? " · mới hôm nay" : ""}
          </span>
          <h3 ref={title} tabIndex={-1} className="text-lg font-bold outline-none">
            {v.name}
          </h3>
          <span className="text-sm text-ink/70">
            {card.kind === "thing" ? (
              <>
                Mọc khi con xong mảng <b>{PILLAR_AREA[card.v.pillar]}</b> · lần đầu {card.v.firstDate} · đã mọc {card.v.count} lần
              </>
            ) : (
              <>Đến ngày {card.v.arrived}</>
            )}
          </span>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 shrink-0 px-2 text-sm font-semibold underline">
          Đóng
        </button>
      </div>
      <section aria-label="Điều thú vị" className="flex flex-col gap-2">
        <h4 className="font-bold">Điều thú vị</h4>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {v.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ol>
        {card.kind === "thing" && card.v.closed > 0 && (
          <p className="rounded-xl bg-white p-3 text-sm text-ink/75">
            Còn {card.v.closed} điều nữa: {card.v.name.toLowerCase()} mọc thêm lần nữa thì mở.
          </p>
        )}
      </section>
      <section aria-label="Nhiệm vụ ngoài đời" className="flex flex-col items-start gap-2 rounded-xl border-[1.5px] border-dashed border-[#B85A1C] bg-white p-3">
        <h4 className="text-sm font-bold">🔎 Nhiệm vụ ngoài đời (nếu con muốn)</h4>
        <p className="text-sm">{v.mission}</p>
        <button
          type="button"
          aria-pressed={done}
          onClick={() => toggle("world-quests", questKey, !done, setDone)}
          className="btn border-[1.5px] text-sm"
          style={done ? { background: "#E3F0E7", borderColor: "#2F6E45", color: "#2F6E45" } : { background: "#fff", borderColor: "rgb(28 31 29 / 0.25)" }}
        >
          {done ? "Đã làm ✓" : "Con đã làm"}
        </button>
      </section>
      <section aria-label="Tối nay dạy cả nhà" className="flex flex-col items-start gap-2 rounded-xl bg-[#FAEEDA] p-3">
        <h4 className="text-sm font-bold">🍽️ Tối nay dạy cả nhà</h4>
        <p className="text-sm">{v.teach}</p>
        <button
          type="button"
          aria-pressed={teach}
          onClick={() => toggle("world-teach", teachKey, !teach, setTeach)}
          className="btn border-[1.5px] border-[#8A5A12] bg-white text-sm text-[#5E3D00]"
        >
          {teach ? "Tối nay con sẽ kể ✓" : "Tối nay dạy cả nhà điều này"}
        </button>
      </section>
    </section>
  );
}

/** What grew today, one chip per area (empty ones stay calm: no "missed"). */
function TodayChips({ view }: { view: MonthView }) {
  return (
    <ul aria-label="Hôm nay" className="flex flex-wrap gap-1.5">
      {PILLARS.map((p) => {
        const t = view.things.find((x) => x.pillar === p && x.today);
        return (
          <li
            key={p}
            className={`flex min-h-8 items-center gap-1 rounded-full px-3 text-[13px] ${t ? "bg-[#E3F0E7] font-bold text-[#2F6E45]" : "bg-bg text-ink/65"}`}
            aria-label={t ? `${PILLAR_AREA[p]}: ${t.name} mọc hôm nay` : `${PILLAR_AREA[p]}: chưa`}
          >
            {t ? <WorldIcon icon={t.icon} size={18} /> : <span aria-hidden>○</span>}
            {PILLAR_AREA[p]}
          </li>
        );
      })}
    </ul>
  );
}

/** Visitors that could come next, and what the world still needs for them. */
function Coming({ view }: { view: MonthView }) {
  if (view.coming.length === 0) return null;
  return (
    <section aria-label="Đang chờ dọn đến" className="flex flex-col gap-1.5">
      <h3 className="text-sm font-bold">Đang chờ dọn đến</h3>
      <ul className="flex flex-col gap-1">
        {view.coming.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-sm text-ink/80">
            <span className="opacity-60">
              <WorldIcon icon={c.icon} size={24} />
            </span>
            <span>
              <b>{c.name}</b> sẽ đến khi {c.because}
              {c.missing > 0 ? ` (còn thiếu ${c.missing} thứ)` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
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
export function WorldTab({ color, onWorld }: { color: string; onWorld?: (key: string | null) => void }) {
  const [month, setMonth] = useState<string | null>(null);
  const [fetched, refetch] = useWorld(month);
  // After a pick the route answers with the new world: show it without another round trip
  // (until the next fetch: another month, "Thử lại", a 409).
  const [picked, setPicked] = useState<WorldResponse | null>(null);
  const load: Load = picked && month === null ? { state: "ok", data: picked } : fetched;
  // R7a: the focus screen draws this month's world (only the current month, no extra request).
  const currentKey = month === null && load.state === "ok" ? (load.data.view?.world.key ?? null) : undefined;
  useEffect(() => {
    if (currentKey !== undefined) onWorld?.(currentKey);
  }, [currentKey, onWorld]);
  const retry = () => {
    setPicked(null);
    refetch();
  };
  const openMonth = (m: string | null) => {
    setPicked(null);
    setPicked2(null);
    setMonth(m);
  };
  const [picked2, setPicked2] = useState<Picked | null>(null);

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
  const card = view ? cardOf(view, picked2) : null;
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
          <h2 id="world-h" className="flex items-center gap-2 text-lg font-bold">
            <span>
              <span aria-hidden>{view.world.emoji} </span>
              {view.world.name} · {monthLabel(view.month)}
            </span>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#F4C430] text-base font-extrabold text-[#5A3E24]" role="img" aria-label={`${view.things.length} thứ đã mọc`}>
              {view.things.length}
            </span>
          </h2>
          {!current && (
            <button type="button" onClick={() => openMonth(null)} className="min-h-11 text-sm font-semibold underline" style={{ color }}>
              ← Về tháng này
            </button>
          )}
        </div>
        {current && <p className="text-sm text-ink/75">{view.world.intro}</p>}
        {current && <TodayChips view={view} />}
        <LivingScene view={view} picked={picked2} onPick={(p) => setPicked2(p)} />
        <div>
          {card ? (
            <Detail
              key={`${view.month}:${card.v.key}`}
              card={card}
              month={view.month}
              onClose={() => {
                // Back to the thing in the scene (the card leaves the page).
                const spot = picked2 ? `${picked2.kind}:${picked2.key}` : null;
                setPicked2(null);
                if (spot) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-spot="${spot}"]`)?.focus());
              }}
            />
          ) : (
            <p className="text-sm text-ink/70">Chạm vào một thứ hoặc một {view.world.visitorWord} trong cảnh để xem thẻ.</p>
          )}
        </div>
        {current && <Coming view={view} />}
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
    </>
  );
}

/** Hôm nay (An): the world in one line + what grew today; opens the Thế giới tab. */
export function WorldMini({ onOpen, onWorld }: { onOpen: () => void; onWorld?: (key: string | null) => void }) {
  const [load] = useWorld(null);
  // R7a: the focus screen draws this world behind the timer (no extra request).
  const worldKey = load.state === "ok" ? (load.data.view?.world.key ?? null) : undefined;
  useEffect(() => {
    if (worldKey !== undefined) onWorld?.(worldKey);
  }, [worldKey, onWorld]);
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
      {/* A picture only (the button below is the way in for keyboards and screen readers). */}
      <div aria-hidden onClick={onOpen} className="cursor-pointer">
        <LivingScene view={v} compact />
      </div>
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
