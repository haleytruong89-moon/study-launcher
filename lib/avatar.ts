import type { Quad, Voice } from "@/lib/binhYen/catalog";

/**
 * The child's own character (R3a, docs/BINH_YEN_BIEU_TUONG.md §A–B; parent decisions 07/11/2026).
 * Taken from the prototype both children tried and approved: the same parts, colours and faces.
 *
 * PURE: safe on the server (validation of POST /api/profile/avatar) and in the browser (the
 * creator and every face). Stored in profiles.avatar as CODES only (+ an optional name the
 * whole family can see). Keys are stable forever: a part is never removed, only added.
 */

export const HAIR_STYLES = { long: "Dài", short: "Ngắn", ponytail: "Đuôi ngựa", messy: "Rối, xù" } as const;
export const HAIR_COLORS = {
  den: ["Đen", "#2A2522"],
  nau: ["Nâu", "#7A4E2D"],
  bac: ["Bạc", "#D7DDE3"],
  hong: ["Hồng", "#F2A7C3"],
  xanhduong: ["Xanh dương", "#6E9BD8"],
  tim: ["Tím", "#9C7BD1"],
  do: ["Đỏ", "#C8463A"],
  vang: ["Vàng", "#E9C46A"],
} as const;
export const EYE_COLORS = {
  nau: ["Nâu", "#7A4E2D"],
  xanhduong: ["Xanh dương", "#4A7FC1"],
  xanhla: ["Xanh lá", "#6FA34F"],
  tim: ["Tím", "#8A63C7"],
  vang: ["Vàng", "#D9A520"],
} as const;
export const SKINS = {
  sang: ["Sáng", "#FBE3D3"],
  vua: ["Vừa", "#F2C9A8"],
  ngam: ["Ngăm", "#D9A57E"],
} as const;
export const OUTFIT_COLORS = {
  nau: ["Nâu", "#7A5638"],
  xanhduong: ["Xanh dương", "#3A5A8C"],
  do: ["Đỏ", "#A8392E"],
  den: ["Đen", "#2B2B30"],
  xanhla: ["Xanh lá", "#3F6B43"],
  tim: ["Tím", "#6A4C93"],
  vang: ["Vàng", "#C9A23A"],
} as const;
export const ACCESSORIES = { none: "Không", hat: "Mũ thám tử", glasses: "Kính", phones: "Tai nghe", ribbon: "Nơ", leaf: "Kẹp lá" } as const;

export const AVATAR_NAME_MAX = 24;

export interface Avatar {
  style: keyof typeof HAIR_STYLES;
  hair: keyof typeof HAIR_COLORS;
  eye: keyof typeof EYE_COLORS;
  skin: keyof typeof SKINS;
  outfit: keyof typeof OUTFIT_COLORS;
  acc: keyof typeof ACCESSORIES;
  /** Optional, shown on the comic cover / the forest sign. The whole family sees it. */
  name: string;
}

/** Each quadrant shows the character with its own face (the child never picks it). */
export type Expression = "angry" | "smile" | "sad" | "calm";
export const QUAD_EXPRESSION: Record<Quad, Expression> = { red: "angry", yellow: "smile", blue: "sad", green: "calm" };

/** The prototype's characters, used until the child makes their own ("Hình tạm"). */
export function defaultAvatar(voice: Voice): Avatar {
  return voice === "detective"
    ? { style: "long", hair: "den", eye: "nau", skin: "sang", outfit: "nau", acc: "none", name: "" }
    : { style: "short", hair: "nau", eye: "nau", skin: "vua", outfit: "xanhla", acc: "hat", name: "" };
}

const has = <T extends object>(map: T, k: unknown): k is keyof T => typeof k === "string" && Object.prototype.hasOwnProperty.call(map, k);

/** Tidies a character name: trims, collapses spaces, drops control characters. */
export function cleanAvatarName(raw: unknown): string | null {
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim();
  return [...s].length > AVATAR_NAME_MAX ? null : s;
}

/** Validates a character sent by a browser: only known codes, nothing else. null = refused. */
export function parseAvatar(input: unknown): Avatar | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const allowed = new Set(["style", "hair", "eye", "skin", "outfit", "acc", "name"]);
  if (Object.keys(o).some((k) => !allowed.has(k))) return null;
  const name = cleanAvatarName(o.name);
  if (name === null) return null;
  if (!has(HAIR_STYLES, o.style) || !has(HAIR_COLORS, o.hair) || !has(EYE_COLORS, o.eye) || !has(SKINS, o.skin) || !has(OUTFIT_COLORS, o.outfit) || !has(ACCESSORIES, o.acc)) {
    return null;
  }
  return { style: o.style, hair: o.hair, eye: o.eye, skin: o.skin, outfit: o.outfit, acc: o.acc, name };
}

/** What is stored (from the database): a bad or old value falls back to the default, never breaks a page. */
export function storedAvatar(value: unknown, voice: Voice): { avatar: Avatar; mine: boolean } {
  const a = parseAvatar(value);
  return a ? { avatar: a, mine: true } : { avatar: defaultAvatar(voice), mine: false };
}
