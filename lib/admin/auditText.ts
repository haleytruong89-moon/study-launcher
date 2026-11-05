/**
 * "Nhật ký" (S3d): every audit_log action as ONE short Vietnamese sentence for the parent.
 * PURE. Only named, harmless fields of the payload are used (names, domains, dates, counts);
 * the raw payload, ids, token hashes, push endpoints and the like are never shown.
 * An action this file does not know yet falls back to a neutral line.
 *
 * Every action written anywhere in the repo must be listed in ACTION_GROUP
 * (tests/auditText.test.ts scans the source to make sure).
 */
import { DAY_TYPE_INFO, type DayType } from "@/lib/admin/specialDay";
import { presetById } from "@/lib/admin/presets";
import { localDate } from "@/lib/time";
import { vnTime } from "@/lib/today/view";

export const AUDIT_GROUPS = ["lock", "homework", "request", "device", "settings", "login", "trust"] as const;
export type AuditGroup = (typeof AUDIT_GROUPS)[number];

export const AUDIT_GROUP_LABEL: Record<AuditGroup, string> = {
  lock: "Mở/khóa",
  homework: "Bài tập",
  request: "Xin mở trang",
  device: "Thiết bị/Extension",
  settings: "Cài đặt",
  login: "Đăng nhập/PIN",
  trust: "Tin tưởng",
};

/** Every known action and its filter group. */
export const ACTION_GROUP: Readonly<Record<string, AuditGroup>> = {
  "override.open": "lock",
  "override.lock": "lock",
  "override.extend": "lock",
  "override.clear": "lock",
  "day_type.set": "lock",

  "homework.create": "homework",
  "homework.edit": "homework",
  "homework.archive": "homework",
  "homework.restore": "homework",
  "run.verdict": "homework",
  "run.confirm_ok": "homework",
  "run.confirm_reject": "homework",
  "template.create": "homework",
  "template.update": "homework",

  "request.create": "request",
  "request.15m": "request",
  "request.day": "request",
  "request.permanent": "request",
  "request.permanent_base": "request",
  "request.deny": "request",
  "allowlist.add": "request",
  "allowlist.remove": "request",
  "allowlist.preset": "request",

  "device.code": "device",
  "device.pair": "device",
  "device.revoke": "device",
  "ext.uninstalled": "device",
  "ext.missing": "device",

  "family.setup": "settings",
  "settings.update": "settings",
  "slot.create": "settings",
  "slot.update": "settings",
  "child.create": "settings",
  "child.update": "settings",
  "photos.cleanup": "settings",

  "pin.login": "login",
  "pin.login_failed": "login",
  "child.pin_set": "login",
  "child.password_reset": "login",
  "child.sign_out_all": "login",
  "child.sessions_revoked": "login",

  "trust.set": "trust",
  "trust.dismissed": "trust",
};

/**
 * Technical markers that always come together with a readable action (e.g. the
 * "sessions revoked" stamp written by a password reset): left out of the list.
 */
export const HIDDEN_ACTIONS: readonly string[] = ["child.sessions_revoked"];

export function actionsInGroup(group: AuditGroup): string[] {
  return Object.entries(ACTION_GROUP)
    .filter(([action, g]) => g === group && !HIDDEN_ACTIONS.includes(action))
    .map(([action]) => action);
}

export interface AuditEntry {
  action: string;
  payload: unknown;
  actor_id: string | null;
}

/** The family's CHILDREN: display name by profile id (parents are not in here). */
export type Names = ReadonlyMap<string, string>;

export const UNKNOWN_TEXT = "Một thay đổi khác trong ứng dụng";

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Only a plain host name is ever shown (never a full URL with paths or query strings). */
function host(v: unknown): string | null {
  const s = str(v);
  return s && /^[a-z0-9.-]{1,253}$/i.test(s) ? s.toLowerCase() : null;
}

function short(v: unknown, max = 60): string | null {
  const s = str(v)?.replace(/\s+/g, " ");
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** "05/11" from "2026-11-05". */
function dm(date: unknown): string | null {
  const s = str(date);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : null;
}

/** "đến 21:30" or "đến hết ngày" (every open window ends at 00:00). */
function untilText(until: unknown): string | null {
  const s = str(until);
  if (!s || !Number.isFinite(Date.parse(s))) return null;
  const t = vnTime(s);
  return t === "00:00" ? "đến hết ngày" : `đến ${t}`;
}

/** "đến hết 05/11" for an allowlist row that expires, "luôn luôn" when it does not. */
function expiryText(expiresAt: unknown): string {
  const s = str(expiresAt);
  if (!s || !Number.isFinite(Date.parse(s))) return "luôn luôn";
  const at = new Date(s);
  const t = vnTime(s);
  // Expiry at 00:00 means "until the end of the previous day".
  const day = localDate(new Date(at.getTime() - (t === "00:00" ? 1 : 0)));
  return t === "00:00" ? `đến hết ${dm(day)}` : `đến ${t} ${dm(day)}`;
}

function spaced(s: string | null): string {
  return s ? ` ${s}` : "";
}

function quoted(s: string | null): string {
  return s ? ` “${s}”` : "";
}

/**
 * One sentence per entry. `names` holds the children; the child of an entry is
 * payload.child_id, otherwise the actor when the actor is a child (their own actions).
 */
export function auditText(entry: AuditEntry, names: Names): { text: string; group: AuditGroup | null } {
  const p = (entry.payload && typeof entry.payload === "object" && !Array.isArray(entry.payload) ? entry.payload : {}) as Record<string, unknown>;
  const childId = str(p.child_id) ?? (entry.actor_id && names.has(entry.actor_id) ? entry.actor_id : null);
  const kid = (childId && names.get(childId)) || "con";
  const group = Object.hasOwn(ACTION_GROUP, entry.action) ? (ACTION_GROUP[entry.action] ?? null) : null;
  const say = (text: string) => ({ text, group });

  switch (entry.action) {
    // --- Mở/khóa -------------------------------------------------------------
    case "override.open":
      return say(`Mở máy cho ${kid}${spaced(untilText(p.until))}${reason(p)}`);
    case "override.lock":
      return say(`Khóa máy của ${kid}${spaced(untilText(p.until))}${reason(p)}`);
    case "override.extend": {
      const m = num(p.minutes);
      const u = untilText(p.until);
      return say(`Cộng ${m ? `${m} phút` : "thêm giờ"} cho ${kid}${u ? ` (mở ${u})` : ""}` + reason(p));
    }
    case "override.clear":
      return say(`Đưa máy của ${kid} về bình thường` + reason(p));
    case "day_type.set": {
      const type = (str(p.day_type) ?? "normal") as DayType;
      const label = DAY_TYPE_INFO[type]?.label ?? "Ngày đặc biệt";
      const date = dm(p.date) ?? "một ngày";
      if (type === "normal") return say(`Để ${date} là ngày thường cho ${kid}`);
      const off = Array.isArray(p.disabled_template_ids) ? p.disabled_template_ids.length : 0;
      return say(`Đặt ${label.toLowerCase()} ${date} cho ${kid}${off > 0 ? ` · bỏ ${off} việc` : ""}`);
    }

    // --- Bài tập -------------------------------------------------------------
    case "homework.create": {
      const due = dm(p.due_date);
      const files = num(p.files);
      const subject = short(p.subject, 30);
      return say(`Giao bài${subject ? ` ${subject}` : ""} cho ${kid}${due ? ` · hạn ${due}` : ""}${files ? ` · ${files} tệp` : ""}`);
    }
    case "homework.edit": {
      const due = dm(p.due_date);
      const before = dm(p.previous_due_date);
      const moved = due && before && due !== before ? ` · dời hạn ${before} → ${due}` : "";
      const subject = short(p.subject, 30);
      return say(`Sửa bài${subject ? ` ${subject}` : ""}${childId ? ` của ${kid}` : ""}${moved}`);
    }
    case "homework.archive":
    case "homework.restore": {
      const subject = short(p.subject, 30);
      const verb = entry.action === "homework.archive" ? "Gỡ" : "Khôi phục";
      return say(`${verb} bài${subject ? ` ${subject}` : " đã giao"}${childId ? ` của ${kid}` : ""}`);
    }
    case "run.verdict": {
      const whose = childId ? ` của ${kid}` : "";
      if (p.verdict === "ok") return say(`Đánh dấu Đạt cho một bài${whose}`);
      if (p.verdict === "not_ok") return say(`Đánh dấu Chưa đạt cho một bài${whose}`);
      return say(`Bỏ đánh dấu Đạt/Chưa đạt của một bài${whose}`);
    }
    case "run.confirm_ok":
      return say(`Xem bài trực tiếp và cho xong một bài của ${kid}`);
    case "run.confirm_reject":
      return say(`Xem bài trực tiếp: một bài của ${kid} chưa được`);
    case "template.create":
      return say(`Thêm việc${quoted(short(p.title, 40))} vào lịch tuần của ${kid}`);
    case "template.update":
      return say(`${p.active === false ? "Tắt" : "Sửa"} việc${quoted(short(p.title, 40))} trong lịch tuần của ${kid}`);

    // --- Xin mở trang / trang học --------------------------------------------
    case "request.create":
      return say(`${kid} xin mở trang ${host(p.domain) ?? "mới"}`);
    case "request.15m":
      return say(`Cho ${kid} mở ${host(p.domain) ?? "trang đã xin"} 15 phút`);
    case "request.day":
      return say(`Cho ${kid} mở ${host(p.domain) ?? "trang đã xin"} đến hết hôm nay`);
    case "request.permanent":
      return say(`Luôn cho phép ${host(p.domain) ?? "trang"} (${kid} xin)`);
    case "request.permanent_base": {
      const asked = host(p.requested);
      return say(`Luôn cho phép cả ${host(p.domain) ?? "tên miền"} (${kid} xin${asked ? ` ${asked}` : ""})`);
    }
    case "request.deny":
      return say(`Không cho ${kid} mở ${host(p.requested) ?? host(p.domain) ?? "trang đã xin"}`);
    case "allowlist.add": {
      const who = str(p.child_id) ? kid : "cả nhà";
      return say(`Thêm trang học ${host(p.domain) ?? "mới"} cho ${who} · ${expiryText(p.expires_at)}`);
    }
    case "allowlist.remove":
      return say(`Bỏ ${host(p.domain) ?? "một trang"} khỏi danh sách trang học`);
    case "allowlist.preset": {
      const preset = presetById(str(p.preset) ?? "");
      const added = Array.isArray(p.added) ? p.added.length : null;
      return say(`Thêm nhanh ${preset?.label ?? "một nhóm trang"} cho cả nhà${added !== null ? ` (${added} trang mới)` : ""}`);
    }

    // --- Thiết bị / extension -------------------------------------------------
    case "device.code":
      return say(`Tạo mã ghép laptop cho ${kid}`);
    case "device.pair":
      return say(`${short(p.label, 30) ? `Laptop “${short(p.label, 30)}”` : "Một laptop"} của ${kid} đã ghép extension`);
    case "device.revoke":
      return say(`Gỡ một laptop của ${kid} khỏi Study Launcher`);
    case "ext.uninstalled":
      return say(`Extension trên ${short(p.label, 30) ? `“${short(p.label, 30)}”` : "một laptop"} của ${kid} bị gỡ`);
    case "ext.missing":
      return say(`${kid} mở Study Launcher trên ${short(p.browser, 20) ?? "trình duyệt"} không có extension`);

    // --- Cài đặt -------------------------------------------------------------
    case "family.setup":
      return say(`Tạo gia đình${quoted(short(p.family_name, 40))}`);
    case "settings.update":
      return say("Sửa Luật trong nhà");
    case "slot.create":
      return say(`Thêm app môn học${quoted(short(p.label, 40))}`);
    case "slot.update":
      return say(`${p.active === false ? "Tắt" : "Sửa"} app môn học${quoted(short(p.label, 40))}`);
    case "child.create":
      return say(`Tạo tài khoản cho ${short(p.display_name, 40) ?? kid}`);
    case "child.update":
      return say(`Sửa tên, lớp, màu của ${short(p.display_name, 40) ?? kid}`);
    case "photos.cleanup": {
      const n = (num(p.proofs) ?? 0) + (num(p.homework) ?? 0);
      const days = num(p.retentionDays);
      return say(`Tự xóa ${n} ảnh/tệp cũ${days ? ` hơn ${days} ngày` : ""}`);
    }

    // --- Đăng nhập / PIN -------------------------------------------------------
    case "pin.login":
      return say(`${kid} đăng nhập bằng PIN`);
    case "pin.login_failed": {
      const n = num(p.try);
      return say(`${kid} nhập sai PIN${n ? ` (lần ${n})` : ""}`);
    }
    case "child.pin_set":
      return say(`Đặt PIN mới cho ${kid}`);
    case "child.password_reset":
      return say(`Đặt lại mật khẩu của ${kid} (đăng xuất khỏi mọi máy)`);
    case "child.sign_out_all":
      return say(`Đăng xuất ${kid} khỏi mọi máy`);
    case "child.sessions_revoked":
      return say(`${kid} đã bị đăng xuất khỏi mọi máy`);

    // --- Tin tưởng -------------------------------------------------------------
    case "trust.set": {
      const via = p.via === "suggestion" ? " · theo gợi ý" : "";
      if (p.mode === "trust") return say(`Chuyển ${kid} sang chế độ Tin tưởng${via}`);
      return say(`Chuyển ${kid} về chế độ Khóa${via}`);
    }
    case "trust.dismissed":
      return say(p.suggestion === "lock" ? `Để sau gợi ý đưa ${kid} về chế độ Khóa` : `Để sau gợi ý chuyển ${kid} sang chế độ Tin tưởng`);

    default:
      return { text: UNKNOWN_TEXT, group: null };
  }
}

function reason(p: Record<string, unknown>): string {
  const r = short(p.reason, 60);
  return r ? ` · “${r}”` : "";
}

// ---------------------------------------------------------------------------
// "Nhật ký" page parameters (?con=<child id>&nhom=<group>&so=<how many>)
// ---------------------------------------------------------------------------

export const LOG_PAGE_SIZE = 50;
export const LOG_MAX = 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LogQuery {
  childId: string | null;
  group: AuditGroup | null;
  limit: number;
}

/** Reads the page's query string; anything odd falls back to "all" / the first page. */
export function parseLogQuery(params: { con?: string; nhom?: string; so?: string }, childIds: readonly string[]): LogQuery {
  const childId = params.con && UUID_RE.test(params.con) && childIds.includes(params.con) ? params.con : null;
  const group = (AUDIT_GROUPS as readonly string[]).includes(params.nhom ?? "") ? (params.nhom as AuditGroup) : null;
  const n = Number(params.so);
  const limit = Number.isInteger(n) && n > LOG_PAGE_SIZE ? Math.min(LOG_MAX, Math.ceil(n / LOG_PAGE_SIZE) * LOG_PAGE_SIZE) : LOG_PAGE_SIZE;
  return { childId, group, limit };
}

/** Query string for a link on the page ("Xem thêm" keeps the filters). */
export function logHref(q: LogQuery): string {
  const sp = new URLSearchParams();
  if (q.childId) sp.set("con", q.childId);
  if (q.group) sp.set("nhom", q.group);
  if (q.limit > LOG_PAGE_SIZE) sp.set("so", String(q.limit));
  const s = sp.toString();
  return `/parent/log${s ? `?${s}` : ""}`;
}
