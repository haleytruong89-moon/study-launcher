/**
 * 25/11/2026 (parent: "điện thoại mẹ không nhận được tin báo"): the Thông báo page lists, for
 * each parent, the phones that get notifications, so a phone that silently lost its
 * subscription shows up as "chưa có máy nào". PURE: only a short device word from the browser's
 * user agent, never the endpoint or keys.
 */
export function deviceWord(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Điện thoại Android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Máy Mac";
  if (/Windows/i.test(ua)) return "Máy Windows";
  return "Một máy";
}

export interface ParentDevices {
  name: string;
  devices: { word: string; since: string }[];
}

/** One entry per parent (in the given order), with their devices oldest first. */
export function familyDevices(
  parents: readonly { id: string; display_name: string | null }[],
  subs: readonly { profile_id: string; user_agent: string | null; created_at: string }[],
  fmt: (iso: string) => string,
): ParentDevices[] {
  return parents.map((p) => ({
    name: p.display_name?.trim() || "Bố/mẹ",
    devices: subs
      .filter((s) => s.profile_id === p.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((s) => ({ word: deviceWord(s.user_agent), since: fmt(s.created_at) })),
  }));
}
