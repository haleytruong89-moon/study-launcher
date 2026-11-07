import type { Expression } from "@/lib/avatar";

/**
 * R3b (docs/BINH_YEN_BIEU_TUONG.md §B "Bản 2"): pictures the child drew on Picrew, one per face.
 * PURE: used by the routes (checks) and the browser (which picture to show).
 *
 * Stored in profiles.avatar_pics as {face: path}; files live in the private bucket `avatars`
 * at {family_id}/{child_id}/{uuid}.png|jpg and are shown from /api/files/avatar.
 */

/** Slot order on the page; a face without its own picture uses the FIRST one in this order. */
export const PIC_SLOTS: readonly Expression[] = ["calm", "smile", "sad", "angry"];
export const PIC_SLOT_LABELS: Record<Expression, string> = { calm: "Khi bình yên", smile: "Khi vui", sad: "Khi buồn", angry: "Khi bực" };

/** Bucket limit (0012). The browser shrinks the picture first; the server checks again. */
export const MAX_PIC_BYTES = 1_048_576;
/** Longest side after the browser shrinks it (Picrew pictures are ~600 px). */
export const MAX_PIC_EDGE = 800;

export type AvatarPics = Partial<Record<Expression, string>>;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH = new RegExp(`^(${UUID})/(${UUID})/(${UUID})\\.(png|jpg)$`);

export function isPicSlot(v: unknown): v is Expression {
  return typeof v === "string" && (PIC_SLOTS as readonly string[]).includes(v);
}

/** A path in the `avatars` bucket; with family/child given, it must be THAT child's folder. */
export function isAvatarPicPath(path: unknown, familyId?: string, childId?: string): path is string {
  if (typeof path !== "string") return false;
  const m = PATH.exec(path);
  if (!m) return false;
  return (familyId === undefined || m[1] === familyId) && (childId === undefined || m[2] === childId);
}

/** From the database: only known faces with well-formed paths of that child; anything else is dropped. */
export function parsePics(value: unknown, familyId: string, childId: string): AvatarPics {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: AvatarPics = {};
  for (const slot of PIC_SLOTS) {
    const p = (value as Record<string, unknown>)[slot];
    if (isAvatarPicPath(p, familyId, childId)) out[slot] = p;
  }
  return out;
}

export function hasPics(pics: AvatarPics): boolean {
  return PIC_SLOTS.some((s) => pics[s]);
}

/** The picture for a face: its own, else the first one; null = draw the app's character. */
export function picFor(pics: AvatarPics, expr: Expression): string | null {
  return pics[expr] ?? PIC_SLOTS.map((s) => pics[s]).find((p) => p) ?? null;
}

export function picUrl(path: string): string {
  return `/api/files/avatar?path=${encodeURIComponent(path)}`;
}

/** File type from the first bytes (never trust the name or the browser's type). */
export function sniffPic(bytes: Uint8Array): "png" | "jpg" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}
