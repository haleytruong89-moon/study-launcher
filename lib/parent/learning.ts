/**
 * L-3 "Học với app" (parent decisions 15/11/2026, hub BAO_CAO_PHU_HUYNH_DESIGN_v1.md, SQL 0021).
 * Each learning app writes its own summary (public.learning_cards, learning_attention,
 * learning_pending_rules); the Launcher only SHOWS it. PURE: shaping rows into tiles.
 *
 * Not counted anywhere else: tutor time does not feed the break bank, the lock or free time (Q3).
 */

export interface LearningCardRow {
  child_id: string;
  local_date: string;
  source: string;
  sessions: number;
  minutes: number;
  self_solved: number;
  saved_for_later: number;
  abandoned: number;
  pending_review: number;
}

export interface LearningAttentionRow {
  child_id: string;
  local_date: string;
  source: string;
  slot: number;
  body: string;
}

export interface LearningPendingRulesRow {
  child_id: string;
  app: string;
  pending: number;
}

export interface LearningTile {
  source: string;
  label: string;
  /** null when the app wrote no card that day (only attention lines or pending rules). */
  stats: { minutes: number; sessions: number; selfSolved: number; savedForLater: number; abandoned: number; pendingReview: number } | null;
  /** At most 2, in slot order (parents only: the child never reads them, Q5). */
  attention: string[];
  /** Teaching rules waiting for the parents (Q4: approved in the tutor app). */
  pendingRules: number;
  /** Where "N luật chờ duyệt ›" goes; null when the tutor app is not reachable (plain text). */
  rulesHref: string | null;
  /** Where "Xem báo cáo ›" goes; null when that app is not reachable from here. */
  reportHref: string | null;
}

const SUBJECTS: Record<string, string> = { toan: "Toán", anh: "Anh", van: "Văn", khtn: "KHTN" };

/** "tutor:toan" → "Gia sư Toán"; an unknown source keeps a readable name. */
export function sourceLabel(source: string): string {
  const [app, key = ""] = source.split(":");
  if (app === "tutor") return `Gia sư ${SUBJECTS[key] ?? key.toUpperCase()}`.trim();
  return key ? `${app} ${key}` : source;
}

const isTutor = (source: string) => source === "tutor" || source.startsWith("tutor:");

/** The tutor's parent page for that day; only when the tutor app is reachable (TUTOR_APP_ORIGIN). */
export function reportHref(source: string, day: string, tutorOn: boolean): string | null {
  if (!isTutor(source) || !tutorOn) return null;
  return `/gia-su/bo-me?ngay=${day}`;
}

/** Where "N luật chờ duyệt ›" goes (the tutor app approves them, Q4). */
export const TUTOR_RULES_HREF = "/gia-su/bo-me";

/**
 * One child, one day → tiles, one per source. Order: sources with a card first (most minutes
 * first), then the rest by name. Pending rules (per child, not per day) go on the first tutor
 * tile; with no tutor tile that day they get a small "Gia sư AI" tile of their own.
 */
export function buildLearningTiles(
  childId: string,
  day: string,
  cards: readonly LearningCardRow[],
  attention: readonly LearningAttentionRow[],
  pendingRules: readonly LearningPendingRulesRow[],
  tutorOn: boolean,
): LearningTile[] {
  const tiles = new Map<string, LearningTile>();
  const tile = (source: string): LearningTile => {
    let t = tiles.get(source);
    if (!t) {
      t = { source, label: sourceLabel(source), stats: null, attention: [], pendingRules: 0, rulesHref: null, reportHref: reportHref(source, day, tutorOn) };
      tiles.set(source, t);
    }
    return t;
  };
  for (const c of cards) {
    if (c.child_id !== childId || c.local_date !== day) continue;
    const t = tile(c.source);
    const s = t.stats ?? { minutes: 0, sessions: 0, selfSolved: 0, savedForLater: 0, abandoned: 0, pendingReview: 0 };
    t.stats = {
      minutes: s.minutes + Math.max(0, c.minutes),
      sessions: s.sessions + c.sessions,
      selfSolved: s.selfSolved + c.self_solved,
      savedForLater: s.savedForLater + c.saved_for_later,
      abandoned: s.abandoned + c.abandoned,
      pendingReview: s.pendingReview + c.pending_review,
    };
  }
  const lines = attention.filter((a) => a.child_id === childId && a.local_date === day && a.body.trim() !== "").sort((a, b) => a.slot - b.slot);
  for (const a of lines) {
    const t = tile(a.source);
    if (t.attention.length < 2) t.attention.push(a.body.trim());
  }
  const ordered = [...tiles.values()].sort((a, b) => (b.stats?.minutes ?? -1) - (a.stats?.minutes ?? -1) || a.label.localeCompare(b.label, "vi"));

  const rules = pendingRules.filter((r) => r.child_id === childId && r.app === "tutor").reduce((n, r) => n + r.pending, 0);
  if (rules > 0) {
    const first = ordered.find((t) => isTutor(t.source));
    const rulesHref = tutorOn ? TUTOR_RULES_HREF : null;
    if (first) Object.assign(first, { pendingRules: rules, rulesHref });
    else ordered.push({ source: "tutor", label: "Gia sư AI", stats: null, attention: [], pendingRules: rules, rulesHref, reportHref: null });
  }
  return ordered;
}

/** The tile's numbers in one line: "3 bài tự làm xong · 1 để dành · 1 bỏ dở" (zeros left out). */
export function tileCounts(stats: NonNullable<LearningTile["stats"]>): string {
  const parts = [
    stats.selfSolved > 0 ? `${stats.selfSolved} bài tự làm xong` : null,
    stats.savedForLater > 0 ? `${stats.savedForLater} để dành` : null,
    stats.abandoned > 0 ? `${stats.abandoned} bỏ dở` : null,
    stats.pendingReview > 0 ? `${stats.pendingReview} chờ thầy xem` : null,
  ].filter((p) => p !== null);
  return parts.length > 0 ? parts.join(" · ") : "Chưa có bài nào xong";
}

/** "N chỗ cần bố mẹ xem" = attention lines + pending rules (parent decision 15/11/2026). */
export function needsLook(tiles: readonly LearningTile[]): number {
  return tiles.reduce((n, t) => n + t.attention.length + t.pendingRules, 0);
}

/** The one line on Hôm nay under a child: "Gia sư: 35′ · 1 chỗ cần xem"; null when nothing. */
export function homeLine(tiles: readonly LearningTile[]): string | null {
  if (tiles.length === 0) return null;
  const minutes = tiles.reduce((n, t) => n + (t.stats?.minutes ?? 0), 0);
  const look = needsLook(tiles);
  const parts = [minutes > 0 ? `${minutes}′` : null, look > 0 ? `${look} chỗ cần xem` : null].filter((p) => p !== null);
  if (parts.length === 0) return null;
  const allTutor = tiles.every((t) => isTutor(t.source));
  return `${allTutor ? "Gia sư" : "Học với app"}: ${parts.join(" · ")}`;
}
