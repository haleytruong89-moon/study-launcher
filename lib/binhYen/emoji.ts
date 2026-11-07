import type { Quad } from "./catalog";

/**
 * Little pictures beside the words and activities of Góc bình yên (docs/BINH_YEN_BIEU_TUONG.md
 * §C, R3a). Draft list the children review on the preview (parent decision 07/11/2026): change a
 * picture here, never a key. Pictures sit NEXT to the words (aria-hidden), never replace them,
 * and are never stored — a visit still stores only keys.
 */
export const WORD_EMOJI: Readonly<Record<string, string>> = {
  tuc_gian: "😠",
  buc_boi: "😤",
  lo_lang: "😟",
  cang_thang: "😣",
  hoang: "😱",
  ghen_ti: "😒",
  vui: "😊",
  hao_hung: "🤩",
  tu_hao: "🏅",
  to_mo: "🧐",
  phan_khich: "🥳",
  tran_nang_luong: "⚡",
  buon: "😢",
  chan: "😑",
  met: "😪",
  co_don: "😶",
  that_vong: "😞",
  tui_than: "🥺",
  binh_yen: "😌",
  thu_thai: "🍃",
  biet_on: "🙏",
  nhe_nhom: "😮‍💨",
  an_toan: "🤗",
  man_nguyen: "☺️",
};

export const ACTIVITY_EMOJI: Readonly<Record<string, string>> = {
  thought_case: "🧠",
  breath: "🌬️",
  rest: "🛌",
  dance: "💃",
  talk: "💬",
  share: "🗣️",
  evidence: "🔍",
  gratitude: "💛",
  savor: "📸",
  heart: "💓",
  jar: "🫙",
  volcano: "🌋",
  bubbles: "🫧",
  whale: "🐋",
  body: "🧍",
  sky: "🌙",
  observe: "🔬",
  curious: "❓",
  release: "🎈",
  move: "🦘",
};

/** A quadrant's fallback picture (a word that is not in the list any more). */
const QUAD_EMOJI: Record<Quad, string> = { red: "🌋", yellow: "☀️", blue: "🌊", green: "🌳" };

export function wordEmoji(key: string, quad?: Quad): string {
  return WORD_EMOJI[key] ?? (quad ? QUAD_EMOJI[quad] : "");
}

export function activityEmoji(key: string): string {
  return ACTIVITY_EMOJI[key] ?? "";
}
