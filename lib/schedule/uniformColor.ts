import { fold } from "@/lib/timetable/rules";

/** Colour words in a uniform text (folded, whole words), checked in order of appearance. */
const COLOURS: [string, string][] = [
  ["xanh la", "#3A9A4A"],
  ["xanh lam", "#2F5D9E"],
  ["xanh duong", "#2F5D9E"],
  ["xanh navy", "#22365E"],
  ["xanh", "#2F5D9E"],
  ["do", "#D23B2E"],
  ["trang", "#FFFFFF"],
  ["den", "#2A2A2A"],
  ["vang", "#E2B93B"],
  ["hong", "#E58BB0"],
  ["tim", "#7A5AA8"],
  ["cam", "#E07B2A"],
  ["xam", "#9AA19C"],
];

/**
 * 22/11/2026: the colour of the SHIRT in a uniform text, for the little shirt icon ("Áo polo đỏ,
 * quần thể thao" → red; "Đồng phục thể dục (áo xanh lá)" → green; "Áo trắng" → white). The first
 * colour word after "áo" wins (else the first in the text); none → null (grey icon). Pure.
 */
export function shirtColour(uniform: string | null | undefined): string | null {
  if (!uniform) return null;
  const words = fold(uniform).replace(/[^a-z0-9]+/g, " ").trim();
  const firstAt = (from: number) => {
    let best: { at: number; colour: string } | null = null;
    for (const [word, colour] of COLOURS) {
      const m = new RegExp(`(^| )${word}( |$)`).exec(words.slice(from));
      if (m && (!best || m.index < best.at)) best = { at: m.index, colour };
    }
    return best?.colour ?? null;
  };
  const ao = /(^| )ao( |$)/.exec(words);
  return (ao ? firstAt(ao.index) : null) ?? firstAt(0);
}
