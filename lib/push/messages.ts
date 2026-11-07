/**
 * Web Push messages for parents (S5, parent decisions 01/11/2026). Pure: no I/O, so tests can
 * pin the exact Vietnamese wording.
 *
 * Privacy: a push travels through Apple / Google push servers (encrypted end to end), so a
 * message only says WHO needs WHAT and opens the page where the parent decides. Never put a
 * child's own words (request reason, notes) in a push.
 */

export interface PushMessage {
  title: string;
  body: string;
  /** Path inside the app that opens when the parent taps the notification. */
  url: string;
  /** Same tag replaces an older notification instead of stacking (e.g. evening reminder). */
  tag: string;
}

/** "Xin mở trang": the child asked to open a blocked site. */
export function unlockRequestMessage(childName: string, domain: string): PushMessage {
  return {
    title: `${childName} xin mở trang`,
    body: `${domain} · chạm để duyệt`,
    url: "/parent/requests",
    tag: `unlock-${domain}`,
  };
}

/** "Nhờ bố mẹ xem trực tiếp": the child cannot send a photo and asks a parent nearby. */
export function confirmRequestMessage(childName: string): PushMessage {
  return {
    title: `${childName} nhờ bố mẹ xem bài`,
    body: "Con không nộp được ảnh, nhờ bố mẹ xem tận nơi · chạm để mở",
    url: "/parent/requests",
    tag: "confirm-request",
  };
}

/**
 * Evening reminder (21:00–21:59, Vercel Cron): only when something still waits for the parent. `unreviewed` =
 * today's finished tasks with no Đạt / Chưa đạt yet; `waiting` = open requests from the children.
 * Returns null when there is nothing to do, so no push is sent.
 */
export function eveningMessage(unreviewed: number, waiting: number): PushMessage | null {
  if (unreviewed <= 0 && waiting <= 0) return null;
  const parts: string[] = [];
  if (unreviewed > 0) parts.push(`${unreviewed} bài chưa xem`);
  if (waiting > 0) parts.push(`${waiting} việc con đang nhờ`);
  return {
    title: "Xem lại ngày của con",
    body: `${parts.join(" · ")} · chạm để mở`,
    url: unreviewed > 0 ? "/parent/review" : "/parent/requests",
    tag: "evening",
  };
}

/** S6: the extension was removed from one of the child's laptops (its uninstall address opened). */
export function extensionRemovedMessage(childName: string, deviceLabel: string, deviceId: string): PushMessage {
  return {
    title: `Extension trên laptop của ${childName} vừa bị gỡ`,
    body: `${deviceLabel} · web trên máy này không còn bị khóa · chạm để xem`,
    url: "/parent/devices",
    tag: `ext-removed-${deviceId}`,
  };
}

/** S6: the child opened the Launcher on a desktop Chrome / Edge where the extension did not answer. */
export function extensionMissingMessage(childName: string, browser: string, childId: string): PushMessage {
  return {
    title: `${childName} đang mở Study Launcher trên một trình duyệt không có extension`,
    body: `${browser} trên máy tính · chạm để xem cách xử lý`,
    url: "/parent/devices",
    tag: `ext-missing-${childId}`,
  };
}

/**
 * Góc bình yên "Con muốn nói chuyện" (S-BY0). Deliberately generic: WHO only, never a feeling,
 * a reason or anything the child chose inside Góc bình yên (BINH_YEN.md §6).
 */
export function wantTalkMessage(childName: string): PushMessage {
  return {
    title: `${childName} muốn nói chuyện với bố mẹ`,
    body: "Chạm để mở, rồi tìm con khi có thể",
    url: "/parent/talk",
    tag: "want-talk",
  };
}

/** Same signal, nobody pressed "Đã thấy" after 10 minutes (sent once). */
export function wantTalkReminderMessage(childName: string): PushMessage {
  return {
    title: `Nhắc lại: ${childName} muốn nói chuyện với bố mẹ`,
    body: "Chưa ai bấm “Đã thấy” · chạm để mở",
    url: "/parent/talk",
    tag: "want-talk",
  };
}

/** The "Gửi thử" button on the notifications page. */
export function testMessage(): PushMessage {
  return {
    title: "Study Launcher",
    body: "Thông báo đã bật trên máy này ✓",
    url: "/parent/notifications",
    tag: "test",
  };
}

/** A subscription as the browser's PushManager returns it (PushSubscription.toJSON()). */
export interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const BASE64URL = /^[A-Za-z0-9_-]+=*$/;

/** Validates a subscription from the browser: https endpoint and base64url keys of sane size. */
export function parseSubscription(input: unknown): SubscriptionInput | null {
  if (!input || typeof input !== "object") return null;
  const o = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof o.endpoint !== "string" || o.endpoint.length > 1000) return null;
  let url: URL;
  try {
    url = new URL(o.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const p256dh = o.keys?.p256dh;
  const auth = o.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (!BASE64URL.test(p256dh) || !BASE64URL.test(auth)) return null;
  if (p256dh.length < 80 || p256dh.length > 100 || auth.length < 16 || auth.length > 32) return null;
  return { endpoint: o.endpoint, keys: { p256dh, auth } };
}
