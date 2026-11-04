/**
 * Góc bình yên — on-device safety check (docs/BINH_YEN.md R3, catalog §C). Spike S3.
 *
 * Runs in the CHILD's browser on every text box (while typing, debounced) before anything
 * is saved or sent. Result:
 *   "strong" → safety screen (111 / 115) + content-free `needs_care` signal to the parents
 *   "ask"    → ask the child gently "Con có đang nghĩ đến việc làm đau mình không?"
 *   null     → nothing
 *
 * Design (spike findings 01/11/2026):
 *   - Match whole words on two forms of the text: with diacritics, and folded (no diacritics,
 *     đ→d). The prototype matched folded substrings, so "từ từ" / "tư tưởng" became "tự tử".
 *   - A folded phrase is only trusted when it cannot be an everyday phrase without accents
 *     ("tu tu" can be "từ từ" → only "ask", and only when the child typed without accents).
 *   - Vietnamese hyperbole: "cười muốn chết", "nóng muốn chết" are everyday; "mệt / chán /
 *     buồn muốn chết" might not be → "ask"; "con muốn chết" → "strong".
 *   - Teen spelling: repeated letters ("chếttt"), letters split by spaces/dots ("c h ế t"),
 *     teencode ("mún", "ko") and a few English phrases.
 * No filter catches everything: the "Con muốn nói chuyện" button is on every screen.
 * The phrase lists are data (to move into by_catalog when the feature is built).
 */

export type RiskLevel = "strong" | "ask";

/** Lowercase, NFC, đ kept; punctuation → space; letters repeated 3+ times → one; spaced-out letters joined. */
export function normalize(text: string): string {
  let s = text.normalize("NFC").toLowerCase();
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " "); // punctuation, emoji, dots → space
  s = s.replace(/(\p{L})\1{2,}/gu, "$1"); // "chếttt" → "chết"
  s = s.replace(/\s+/g, " ").trim();
  // "m u o n c h e t" / "c.h.ế.t" → join runs of 3+ single letters.
  s = s.replace(/(?:^|(?<= ))((?:\p{L} ){2,}\p{L})(?= |$)/gu, (run) => run.replace(/ /g, ""));
  return s;
}

/** Removes Vietnamese diacritics (đ → d). Input should already be normalized. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").normalize("NFC");
}

const hasDiacritics = (s: string) => s !== fold(s);

/** Whole-word phrase test on a normalized, space-separated string. */
function containsPhrase(haystack: string, phrase: string): boolean {
  return ` ${haystack} `.includes(` ${phrase} `);
}

// --- Phrase lists (catalog §C, reviewed by the parent before the feature ships) -------------

/** Clear meaning, matched with diacritics. */
const STRONG_ACCENTED = [
  "tự tử", "tự sát", "chết đi cho xong", "chết quách", "chết quách cho xong",
  "không muốn sống", "chẳng muốn sống", "không muốn sống nữa", "sống làm gì", "sống để làm gì",
  "tự làm đau mình", "tự làm đau bản thân", "tự làm hại", "tự hại", "rạch tay",
  "muốn biến mất mãi mãi", "không muốn tồn tại", "ngủ luôn không dậy", "ngủ mãi không dậy",
  "kết thúc tất cả", "kết thúc cuộc đời", "không ai cần mình", "mình là gánh nặng",
  "mọi người sẽ tốt hơn nếu không có mình", "mún chết", "mún chít",
];

/** Clear meaning even without accents (cannot be an everyday phrase). */
const STRONG_FOLDED = [
  "tu sat", "chet di cho xong", "chet quach", "khong muon song", "chang muon song", "song de lam gi",
  "tu lam dau minh", "tu lam dau ban than", "tu lam hai", "rach tay", "khong muon ton tai",
  "ngu luon khong day", "ket thuc cuoc doi", "khong ai can minh", "minh la ganh nang",
  // teencode
  "mun chet", "mun chit", "ko mun song", "k mun song", "ko muon song", "k muon song", "kh muon song", "hong muon song",
  // English
  "kms", "kill myself", "killing myself", "want to die", "wanna die", "unalive", "end it all", "self harm", "suicide",
];

/** Might be serious, might be everyday → ask the child. */
const ASK_ACCENTED = ["cắt tay", "muốn biến mất", "chán sống", "mệt mỏi với tất cả", "không chịu nổi nữa", "bỏ cuộc hết", "muốn ngủ mãi"];
const ASK_FOLDED = ["cat tay", "muon bien mat", "chan song", "khong chiu noi nua", "bo cuoc het", "muon ngu mai"];
/** "tu tu" is "từ từ" far more often than "tự tử": ask only when the child typed no accents at all. */
const ASK_FOLDED_ONLY_WITHOUT_ACCENTS = ["tu tu"];

/** "X muốn chết": everyday hyperbole for these X. */
const HYPERBOLE_BEFORE_MUON_CHET = ["cười", "buồn cười", "nóng", "lạnh", "đói", "khát", "sợ", "ngon", "xấu hổ", "ngại", "mỏi", "vui", "sướng", "thích", "hồi hộp", "run"];
/** "X muốn chết": could be real → ask. */
const ASK_BEFORE_MUON_CHET = ["mệt", "chán", "buồn", "khổ", "tủi", "cô đơn", "đau"];

function muonChetLevel(accented: string, folded: string): RiskLevel | null {
  const words = accented.split(" ");
  const foldedWords = folded.split(" ");
  const w = (k: number) => words[k] ?? "";
  let level: RiskLevel | null = null;
  for (let i = 0; i + 1 < foldedWords.length; i++) {
    if (foldedWords[i] !== "muon" || foldedWords[i + 1] !== "chet") continue;
    // With accents, "muốn chết" must really be muốn + chết (not "muôn chẹt").
    if (hasDiacritics(w(i) + w(i + 1)) && !(w(i) === "muốn" && w(i + 1) === "chết")) continue;
    // The words right before "muốn chết": one word, two words, or the word two back
    // ("đau bụng muốn chết" → "đau").
    const before = [i >= 1 ? w(i - 1) : "", i >= 2 ? `${w(i - 2)} ${w(i - 1)}` : "", i >= 2 ? w(i - 2) : ""].filter(Boolean);
    const accentless = !hasDiacritics(before.join(" "));
    const isIn = (list: string[]) => list.some((x) => before.includes(x) || (accentless && before.some((b) => fold(b) === fold(x))));
    if (isIn(HYPERBOLE_BEFORE_MUON_CHET)) continue;
    if (isIn(ASK_BEFORE_MUON_CHET)) {
      level = level ?? "ask";
      continue;
    }
    return "strong";
  }
  return level;
}

/** Words that came from spaced-out letters ("m u ố n c h ế t" → "muốnchết"): word gaps are lost. */
function squashedWords(text: string): string[] {
  const loose = text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return (loose.match(/(?:^|(?<= ))(?:\p{L} ){2,}\p{L}(?= |$)/gu) ?? []).map((run) => run.replace(/ /g, ""));
}

const SQUASHED_STRONG = [...STRONG_ACCENTED, ...STRONG_FOLDED, "muốn chết", "muon chet"].map((p) => p.replace(/ /g, ""));

/** The safety check. Pure and synchronous: cheap enough to run on every keystroke pause. */
export function detectRisk(text: string): RiskLevel | null {
  const accented = normalize(text);
  if (!accented) return null;
  const folded = fold(accented);

  // Spaced-out letters: look for strong phrases inside the joined letters.
  for (const word of squashedWords(text)) {
    if (SQUASHED_STRONG.some((p) => word.includes(p) || fold(word).includes(fold(p)))) return "strong";
  }

  if (STRONG_ACCENTED.some((p) => containsPhrase(accented, p))) return "strong";
  if (STRONG_FOLDED.some((p) => containsPhrase(folded, p))) return "strong";

  const muonChet = muonChetLevel(accented, folded);
  if (muonChet === "strong") return "strong";

  if (muonChet === "ask") return "ask";
  if (ASK_ACCENTED.some((p) => containsPhrase(accented, p))) return "ask";
  if (ASK_FOLDED.some((p) => containsPhrase(folded, p))) return "ask";
  if (!hasDiacritics(accented) && ASK_FOLDED_ONLY_WITHOUT_ACCENTS.some((p) => containsPhrase(folded, p))) return "ask";
  return null;
}
