"use client";

import Link from "next/link";
import { useState } from "react";
import { ACCESSORIES, AVATAR_NAME_MAX, EYE_COLORS, HAIR_COLORS, HAIR_STYLES, OUTFIT_COLORS, SKINS, defaultAvatar, type Avatar, type Expression } from "@/lib/avatar";
import type { Voice } from "@/lib/binhYen/catalog";
import { tabHref } from "@/lib/childTabs";
import { AvatarFace } from "../avatar-face";
import { Breadcrumb, ChildNav } from "../child-nav";

const FACES: { expr: Expression; label: string }[] = [
  { expr: "angry", label: "Khi bực" },
  { expr: "smile", label: "Khi vui" },
  { expr: "sad", label: "Khi buồn" },
  { expr: "calm", label: "Khi bình yên" },
];

type ColorMap = Readonly<Record<string, readonly [string, string]>>;

function Pills<K extends string>({ label, map, value, onPick, color }: { label: string; map: Readonly<Record<K, string>>; value: K; onPick: (k: K) => void; color: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(map) as K[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onPick(k)}
            className="min-h-11 rounded-full border-[1.5px] bg-white px-4 text-sm font-medium"
            style={value === k ? { borderColor: color, background: `${color}14` } : { borderColor: "rgb(28 31 29 / 0.15)" }}
          >
            {map[k]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Dots<K extends string>({ label, map, value, onPick }: { label: string; map: ColorMap & Readonly<Record<K, readonly [string, string]>>; value: K; onPick: (k: K) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-bold">
        {label}: <span className="font-normal text-ink/75">{map[value][0]}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(map) as K[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            aria-label={map[k][0]}
            title={map[k][0]}
            onClick={() => onPick(k)}
            className="size-11 rounded-full border-2"
            style={{ background: map[k][1], borderColor: value === k ? "#1C1F1D" : "rgb(28 31 29 / 0.15)", boxShadow: value === k ? "0 0 0 2px #fff inset" : undefined }}
          />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The character creator (R3a): parts and colours from the prototype both children approved.
 * Saved as codes only. The 4 faces are not picked: each quadrant of Góc bình yên shows its own.
 */
export function Creator({
  voice,
  color,
  icon,
  initial,
  mine,
  back,
  byEnabled,
}: {
  voice: Voice;
  color: string;
  icon: string | null;
  initial: Avatar;
  mine: boolean;
  back: "hom-nay" | "binh-yen";
  byEnabled: boolean;
}) {
  const [look, setLook] = useState<Avatar>(initial);
  const [saved, setSaved] = useState<Avatar | null>(mine ? initial : null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof Avatar>(k: K, v: Avatar[K]) => {
    setMsg(null);
    setLook((l) => ({ ...l, [k]: v }));
  };
  const changed = JSON.stringify(look) !== JSON.stringify(saved);
  const backLabel = back === "binh-yen" ? "Góc bình yên" : "Hôm nay";

  async function send(avatar: Avatar | null) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile/avatar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ avatar }), cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { error?: string; avatar?: Avatar | null } | null;
      if (!res.ok) {
        setMsg({ ok: false, text: data?.error ?? "Chưa lưu được, thử lại sau." });
        return;
      }
      if (avatar) {
        // What the server stored (the name tidied), so "Lưu" greys out on exactly that.
        const stored = data?.avatar ?? avatar;
        setLook(stored);
        setSaved(stored);
        setMsg({ ok: true, text: "Đã lưu nhân vật của con." });
      } else {
        const d = defaultAvatar(voice);
        setLook(d);
        setSaved(null);
        setMsg({ ok: true, text: "Đã về hình tạm." });
      }
    } catch {
      setMsg({ ok: false, text: "Chưa lưu được, thử lại sau." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg pb-24 lg:pb-0 lg:pl-52">
      <header className="text-white" style={{ background: color }}>
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 pt-5 pb-4">
          <Link href={tabHref(back)} className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm font-bold">
            ‹ {backLabel}
          </Link>
          <h1 className="ml-auto text-xl font-bold">
            {icon ? <span aria-hidden>{icon} </span> : null}Nhân vật của con
          </h1>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-5">
        <Breadcrumb trail={[backLabel, "Nhân vật của con"]} />
        <section aria-label="Xem trước" className="flex flex-col gap-3 rounded-2xl bg-white p-5">
          <div className="grid grid-cols-4 gap-2">
            {FACES.map((f) => (
              <figure key={f.expr} className="flex flex-col items-center gap-1">
                <AvatarFace look={look} expr={f.expr} className="w-full max-w-24" />
                <figcaption className="text-center text-xs text-ink/70">{f.label}</figcaption>
              </figure>
            ))}
          </div>
          {look.name && <p className="text-center font-bold">{look.name}</p>}
          <p className="text-sm text-ink/70">{saved ? "Đây là nhân vật con đã lưu. Đổi gì cũng được, lúc nào cũng được." : "Đang là hình tạm. Con chọn tóc, mắt, áo… rồi bấm Lưu."}</p>
        </section>

        <section aria-label="Chọn phần" className="flex flex-col gap-5 rounded-2xl bg-white p-5">
          <Pills label="Kiểu tóc" map={HAIR_STYLES} value={look.style} onPick={(k) => set("style", k)} color={color} />
          <Dots label="Màu tóc" map={HAIR_COLORS} value={look.hair} onPick={(k) => set("hair", k)} />
          <Dots label="Màu mắt" map={EYE_COLORS} value={look.eye} onPick={(k) => set("eye", k)} />
          <Dots label="Màu da" map={SKINS} value={look.skin} onPick={(k) => set("skin", k)} />
          <Dots label="Màu áo" map={OUTFIT_COLORS} value={look.outfit} onPick={(k) => set("outfit", k)} />
          <Pills label="Phụ kiện" map={ACCESSORIES} value={look.acc} onPick={(k) => set("acc", k)} color={color} />
          <label className="flex flex-col gap-1 font-bold">
            Tên nhân vật (không bắt buộc)
            <input
              type="text"
              autoComplete="off"
              // The server counts letters (an emoji is 1); the browser counts code units, so allow 2 per letter here.
              maxLength={AVATAR_NAME_MAX * 2}
              aria-describedby="avatar-name-hint"
              value={look.name}
              onChange={(e) => set("name", e.target.value)}
              className="min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base font-normal"
            />
          </label>
          <p id="avatar-name-hint" className="-mt-4 text-xs text-ink/65">
            Tối đa {AVATAR_NAME_MAX} chữ. Cả nhà đều thấy tên này. Đừng ghi tên thật hay địa chỉ.
          </p>
        </section>

        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm font-semibold text-[#2B5D4F]" : "text-sm text-red-700"}>
            {msg.text}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy || !changed} onClick={() => void send(look)} className="btn text-white disabled:opacity-50" style={{ background: color }}>
            Lưu nhân vật
          </button>
          {saved && (
            <button type="button" disabled={busy} onClick={() => void send(null)} className="btn border border-ink/20 bg-white disabled:opacity-50">
              Về hình tạm
            </button>
          )}
        </div>
        <p className="text-xs text-ink/65">Chỉ lưu các lựa chọn (kiểu tóc, màu…), không có ảnh nào của con. Cả nhà thấy nhân vật này.</p>
      </main>
      <ChildNav active={null} byEnabled={byEnabled} color={color} />
    </div>
  );
}
