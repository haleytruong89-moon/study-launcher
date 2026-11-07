"use client";

import type { Avatar } from "@/lib/avatar";
import { QUAD_EXPRESSION } from "@/lib/avatar";
import type { AvatarPics } from "@/lib/avatarPics";
import { QUADS, QUAD_COLORS, type Quad, type QuadInfo, type Voice } from "@/lib/binhYen/catalog";
import { Character } from "./avatar-face";

/** The four regions' drawings (Góc bình yên; R6a: also the feelings of the week). */
export const QUAD_ICONS: Record<QuadInfo["icon"], React.ReactNode> = {
  volcano: <path d="M4 28 L13 12 H19 L28 28 Z M14 12 Q16 4 13 2 M18 12 Q17 6 20 3" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  sun: (
    <>
      <circle cx="16" cy="16" r="7" fill="currentColor" />
      <path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M26 6l-3 3M9 23l-3 3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  sea: (
    <>
      <path d="M2 12 Q8 6 14 12 T26 12 T32 12 V30 H2 Z" fill="currentColor" opacity=".35" />
      <path d="M2 18 Q8 12 14 18 T26 18 T32 18 V30 H2 Z" fill="currentColor" />
    </>
  ),
  forest: <path d="M10 4 L18 18 H2 Z M22 8 L30 22 H14 Z M9 18 h2.5 v8 H9 Z M21 22 h2.5 v6 H21 Z" fill="currentColor" />,
  folder: (
    <>
      <path d="M3 8 h9 l3 3 h14 v16 H3 Z" fill="currentColor" opacity=".35" />
      <circle cx="17" cy="18" r="5" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path d="M21 22 l5 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
};

/**
 * R6a (parent 08/11: "biểu tượng giống ô cảm xúc"): a feeling shown the way the child picked it —
 * An's region (núi lửa, mặt trời, biển sâu, khu rừng), Nguyên's own character with that file's face.
 * Decorative: the caller gives the accessible name.
 */
export function QuadMark({ quad, voice, look, pics, size }: { quad: Quad; voice: Voice; look?: Avatar | null; pics?: AvatarPics; size: number }) {
  const { c, soft } = QUAD_COLORS[quad];
  if (voice === "detective" && look)
    return (
      <span aria-hidden className="inline-flex shrink-0 overflow-hidden rounded-full border-2" style={{ width: size, height: size, borderColor: c, background: soft }}>
        <Character look={look} pics={pics ?? {}} expr={QUAD_EXPRESSION[quad]} className="size-full" />
      </span>
    );
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: soft, color: c }}>
      <svg viewBox="0 0 32 32" width={Math.round(size * 0.66)} height={Math.round(size * 0.66)} focusable="false">
        {QUAD_ICONS[QUADS[voice][quad].icon]}
      </svg>
    </span>
  );
}
