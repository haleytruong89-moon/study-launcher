"use client";

import { useState } from "react";
import { ACCESSORIES, EYE_COLORS, HAIR_COLORS, OUTFIT_COLORS, SKINS, type Avatar, type Expression } from "@/lib/avatar";
import { picFor, picUrl, type AvatarPics } from "@/lib/avatarPics";

/**
 * The child's character with one of its 4 faces (R3a). Drawn exactly like the prototype both
 * children approved. Only codes from lib/avatar.ts reach this drawing (colours are constants),
 * never text: the character's name is shown by the caller, as plain text. Decorative: the
 * caller names what the picture stands for (aria-hidden here).
 */
const INK = "#1D2422";

export function AvatarFace({ look, expr, className }: { look: Avatar; expr: Expression; className?: string }) {
  const hc = HAIR_COLORS[look.hair][1];
  const sk = SKINS[look.skin][1];
  const oc = OUTFIT_COLORS[look.outfit][1];
  const ec = EYE_COLORS[look.eye][1];

  const back = {
    long: <path d="M18 46 Q14 10 50 8 Q86 10 82 46 L88 100 L12 100 Z" fill={hc} />,
    short: <path d="M20 50 Q16 12 50 10 Q84 12 80 50 L78 62 L22 62 Z" fill={hc} />,
    ponytail: (
      <>
        <path d="M20 50 Q16 12 50 10 Q84 12 80 50 L78 62 L22 62 Z" fill={hc} />
        <path d="M72 28 Q100 44 92 86 Q88 96 82 98 Q88 70 72 46 Z" fill={hc} />
      </>
    ),
    messy: <path d="M16 50 Q12 8 50 6 Q88 8 84 50 L88 70 L78 62 L72 72 L64 62 L50 74 L36 62 L28 72 L22 62 L12 70 Z" fill={hc} />,
  }[look.style];

  const brow = expr === "angry" ? "M28 37 L42 41 M72 37 L58 41" : expr === "sad" ? "M29 41 L42 37 M71 41 L58 37" : "M29 39 Q35 36 42 39 M58 39 Q65 36 71 39";
  const mouth = { smile: "M43 64 Q50 71 57 64", calm: "M46 66 Q50 68 54 66", angry: "M43 68 Q50 62 57 68", sad: "M44 68 Q50 64 56 68" }[expr];
  const bangs =
    look.style === "messy"
      ? "M24 46 Q26 16 50 14 Q74 16 76 46 L70 36 L66 44 L60 32 L54 42 L50 30 L46 42 L40 32 L34 44 L30 36 Z"
      : "M24 44 Q26 16 50 15 Q74 16 76 44 Q70 32 64 40 Q58 26 50 36 Q42 26 36 40 Q30 32 24 44 Z";

  function eye(x: number) {
    const y = 50;
    if (expr === "smile") return <path d={`M${x - 6} ${y + 2} Q${x} ${y - 5} ${x + 6} ${y + 2}`} stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />;
    const ry = expr === "angry" ? 5 : expr === "sad" ? 4 : 7;
    return (
      <>
        <ellipse cx={x} cy={y} rx="6" ry={ry} fill="#fff" />
        <ellipse cx={x} cy={y + 1} rx="4.5" ry={Math.max(ry - 1.5, 3)} fill={ec} />
        <circle cx={x} cy={y + 1} r="2.2" fill={INK} />
        <circle cx={x - 2} cy={y - 2} r="1.4" fill="#fff" />
        {expr === "angry" ? (
          <path d={`M${x - 7} ${y - 3} L${x + 7} ${y - ry}`} stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        ) : (
          <path d={`M${x - 7} ${y - ry + 2} Q${x} ${y - ry - 3} ${x + 7} ${y - ry + 2}`} stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        )}
        {expr === "sad" && <path d={`M${x - 7} ${y - 2} H${x + 7}`} stroke={sk} strokeWidth="3.5" />}
      </>
    );
  }

  const acc: Record<keyof typeof ACCESSORIES, React.ReactNode> = {
    none: null,
    hat: (
      <>
        <path d="M20 30 Q24 6 50 5 Q76 6 80 30 Z" fill="#8B6B4A" />
        <path d="M14 31 L86 31 L82 37 L18 37 Z" fill="#6E5236" />
      </>
    ),
    glasses: (
      <g fill="none" stroke={INK} strokeWidth="1.8">
        <circle cx="37" cy="50" r="9" />
        <circle cx="63" cy="50" r="9" />
        <path d="M46 50 h8" />
      </g>
    ),
    phones: (
      <>
        <path d="M22 50 Q22 12 50 12 Q78 12 78 50" stroke={INK} strokeWidth="4" fill="none" />
        <rect x="15" y="44" width="10" height="18" rx="5" fill="#C8463A" />
        <rect x="75" y="44" width="10" height="18" rx="5" fill="#C8463A" />
      </>
    ),
    ribbon: (
      <>
        <path d="M70 20 L60 13 L59 27 Z M70 20 L80 13 L81 27 Z" fill="#C8463A" />
        <circle cx="70" cy="20" r="3.5" fill="#C8463A" />
      </>
    ),
    leaf: (
      <>
        <ellipse cx="72" cy="24" rx="8" ry="3.5" transform="rotate(-35 72 24)" fill="#7BAE5A" />
        <ellipse cx="77" cy="31" rx="7" ry="3" transform="rotate(10 77 31)" fill="#9CCB74" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className={className}>
      {back}
      <path d="M22 100 Q24 82 50 78 Q76 82 78 100 Z" fill={oc} />
      <rect x="45" y="70" width="10" height="10" fill={sk} />
      <path d="M24 46 Q24 76 50 77 Q76 76 76 46 Q76 18 50 18 Q24 18 24 46 Z" fill={sk} />
      <ellipse cx="34" cy="60" rx="5" ry="2.5" fill="#F28B8B" opacity=".35" />
      <ellipse cx="66" cy="60" rx="5" ry="2.5" fill="#F28B8B" opacity=".35" />
      <path d={brow} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
      {eye(37)}
      {eye(63)}
      <path d={mouth} stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d={bangs} fill={hc} />
      {acc[look.acc]}
    </svg>
  );
}

/**
 * R3b: the child's Picrew picture for that face when there is one (its own, else the first),
 * otherwise the character made in the app. Decorative like AvatarFace (empty alt).
 */
export function Character({ look, pics, expr, className }: { look: Avatar; pics: AvatarPics; expr: Expression; className?: string }) {
  const pic = picFor(pics, expr);
  // A picture that does not load (e.g. just replaced in another tab): the drawn character instead.
  const [broken, setBroken] = useState<string | null>(null);
  if (!pic || broken === pic) return <AvatarFace look={look} expr={expr} className={className} />;
  return (
    // Served from our own address (/api/files/avatar); next/image would add nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={picUrl(pic)} alt="" aria-hidden="true" draggable={false} onError={() => setBroken(pic)} className={`aspect-square rounded-xl bg-white object-contain ${className ?? ""}`} />
  );
}
