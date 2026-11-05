import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTION_GROUP,
  actionsInGroup,
  AUDIT_GROUPS,
  auditText,
  HIDDEN_ACTIONS,
  LOG_MAX,
  LOG_PAGE_SIZE,
  logHref,
  parseLogQuery,
  UNKNOWN_TEXT,
  type AuditEntry,
} from "@/lib/admin/auditText";
import { decisionSchema } from "@/lib/admin/allowlist";

const AN = "00000000-0000-4000-8000-0000000000a1";
const NGUYEN = "00000000-0000-4000-8000-0000000000a2";
const PARENT = "00000000-0000-4000-8000-0000000000b1";
const names = new Map([
  [AN, "An"],
  [NGUYEN, "Nguyên"],
]);
const text = (action: string, payload: Record<string, unknown> = {}, actor: string | null = PARENT) => auditText({ action, payload, actor_id: actor }, names).text;

/** Every action string written to audit_log anywhere in app/ and lib/ (source scan). */
function actionsInSource(): Set<string> {
  const root = join(__dirname, "..");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name)) files.push(full);
    }
  };
  walk(join(root, "app"));
  walk(join(root, "lib"));
  const found = new Set<string>();
  const patterns = [
    /writeAudit\(ctx,\s*"([a-z_]+\.[a-z0-9_]+)"/g,
    /action:\s*"([a-z_]+\.[a-z0-9_]+)"/g,
    /audit\(admin,[^;]*?"([a-z_]+\.[a-z0-9_]+)"/g,
    /export const [A-Z_]+ = "([a-z_]+\.[a-z0-9_]+)";/g,
    /^const [A-Z_]+ = "([a-z_]+\.[a-z0-9_]+)";/gm,
  ];
  for (const f of files) {
    if (f.endsWith(join("lib", "admin", "auditText.ts"))) continue;
    const src = readFileSync(f, "utf8");
    if (!/audit/i.test(src)) continue;
    for (const re of patterns) for (const m of src.matchAll(re)) if (m[1]) found.add(m[1]);
  }
  // Template literals: `override.${action}` and `request.${decision}`.
  for (const a of ["open", "lock", "extend", "clear"]) found.add(`override.${a}`);
  for (const d of decisionSchema.shape.decision.options) found.add(`request.${d}`);
  return found;
}

describe("Nhật ký: every action in the repo has a sentence", () => {
  it("knows every action string written anywhere", () => {
    const inSource = actionsInSource();
    expect(inSource.size).toBeGreaterThan(30);
    const unknown = [...inSource].filter((a) => !(a in ACTION_GROUP));
    expect(unknown).toEqual([]);
  });

  it("gives every known action a real sentence and a group (never the fallback)", () => {
    for (const action of Object.keys(ACTION_GROUP)) {
      const r = auditText({ action, payload: { child_id: AN }, actor_id: PARENT }, names);
      expect(r.text, action).not.toBe(UNKNOWN_TEXT);
      expect(r.text.length, action).toBeGreaterThan(5);
      expect(r.group, action).toBe(ACTION_GROUP[action]);
    }
  });

  it("falls back to a neutral line for an unknown action, showing nothing of the payload", () => {
    const r = auditText({ action: "something.new", payload: { token_hash: "abc123", endpoint: "https://push.example/xyz" }, actor_id: PARENT }, names);
    expect(r).toEqual({ text: UNKNOWN_TEXT, group: null });
    expect(auditText({ action: "toString", payload: {}, actor_id: null }, names)).toEqual({ text: UNKNOWN_TEXT, group: null });
  });

  it("survives broken payloads", () => {
    for (const payload of [null, "x", 42, [], { child_id: 5 }]) {
      for (const action of [...Object.keys(ACTION_GROUP), "x.y"]) {
        const e: AuditEntry = { action, payload, actor_id: null };
        expect(typeof auditText(e, names).text).toBe("string");
      }
    }
  });
});

describe("Nhật ký: sentences", () => {
  it("trust", () => {
    expect(text("trust.set", { child_id: AN, mode: "trust", previous: "lock", via: "suggestion" })).toBe("Chuyển An sang chế độ Tin tưởng · theo gợi ý");
    expect(text("trust.set", { child_id: AN, mode: "lock", previous: "trust", via: "manual" })).toBe("Chuyển An về chế độ Khóa");
    expect(text("trust.dismissed", { child_id: NGUYEN, suggestion: "trust", week: "2026-11-02" })).toBe("Để sau gợi ý chuyển Nguyên sang chế độ Tin tưởng");
    expect(text("trust.dismissed", { child_id: NGUYEN, suggestion: "lock" })).toBe("Để sau gợi ý đưa Nguyên về chế độ Khóa");
  });

  it("open / lock (times in Vietnam; 00:00 = end of the day)", () => {
    expect(text("override.open", { child_id: AN, kind: "open_until", until: "2026-11-04T14:30:00.000Z", minutes: 30 })).toBe("Mở máy cho An đến 21:30");
    expect(text("override.lock", { child_id: AN, until: "2026-11-04T17:00:00.000Z", reason: "ăn cơm" })).toBe("Khóa máy của An đến hết ngày · “ăn cơm”");
    expect(text("override.extend", { child_id: AN, until: "2026-11-04T14:45:00.000Z", minutes: 15 })).toBe("Cộng 15 phút cho An (mở đến 21:45)");
    expect(text("override.clear", { child_id: AN })).toBe("Đưa máy của An về bình thường");
    expect(text("day_type.set", { child_id: AN, date: "2026-11-05", day_type: "sick", disabled_template_ids: [] })).toBe("Đặt ngày ốm 05/11 cho An");
    expect(text("day_type.set", { child_id: AN, date: "2026-11-05", day_type: "exam", disabled_template_ids: ["a", "b"] })).toBe("Đặt ngày thi 05/11 cho An · bỏ 2 việc");
    expect(text("day_type.set", { child_id: AN, date: "2026-11-05", day_type: "normal" })).toBe("Để 05/11 là ngày thường cho An");
  });

  it("homework", () => {
    expect(text("homework.create", { child_id: AN, subject: "Toán", due_date: "2026-11-06", files: 2 })).toBe("Giao bài Toán cho An · hạn 06/11 · 2 tệp");
    expect(text("homework.edit", { child_id: AN, subject: "Toán", due_date: "2026-11-07", previous_due_date: "2026-11-06" })).toBe("Sửa bài Toán của An · dời hạn 06/11 → 07/11");
    expect(text("homework.archive", { id: "x" })).toBe("Gỡ bài đã giao");
    expect(text("homework.restore", { child_id: AN, subject: "Văn" })).toBe("Khôi phục bài Văn của An");
    expect(text("run.verdict", { run_id: "r", verdict: "ok" })).toBe("Đánh dấu Đạt cho một bài");
    expect(text("run.verdict", { run_id: "r", child_id: AN, verdict: "not_ok" })).toBe("Đánh dấu Chưa đạt cho một bài của An");
    expect(text("run.confirm_ok", { child_id: AN })).toBe("Xem bài trực tiếp và cho xong một bài của An");
    expect(text("template.create", { child_id: AN, title: "Luyện đề" })).toBe("Thêm việc “Luyện đề” vào lịch tuần của An");
    expect(text("template.update", { child_id: AN, title: "Luyện đề", active: false })).toBe("Tắt việc “Luyện đề” trong lịch tuần của An");
  });

  it("requests and study sites (host names only)", () => {
    expect(text("request.create", { id: "x", domain: "zalo.me" }, AN)).toBe("An xin mở trang zalo.me");
    expect(text("request.15m", { child_id: AN, domain: "a.vn", requested: "a.vn" })).toBe("Cho An mở a.vn 15 phút");
    expect(text("request.day", { child_id: AN, domain: "a.vn" })).toBe("Cho An mở a.vn đến hết hôm nay");
    expect(text("request.permanent_base", { child_id: AN, domain: "zalo.me", requested: "chat.zalo.me" })).toBe("Luôn cho phép cả zalo.me (An xin chat.zalo.me)");
    expect(text("request.deny", { child_id: AN, domain: "x.com", requested: "x.com" })).toBe("Không cho An mở x.com");
    expect(text("allowlist.add", { domain: "meet.google.com", child_id: null, expires_at: null })).toBe("Thêm trang học meet.google.com cho cả nhà · luôn luôn");
    expect(text("allowlist.add", { domain: "a.vn", child_id: AN, expires_at: "2026-11-04T17:00:00.000Z" })).toBe("Thêm trang học a.vn cho An · đến hết 04/11");
    expect(text("allowlist.preset", { preset: "meet", added: ["meet.google.com"] })).toBe("Thêm nhanh Google Meet cho cả nhà (1 trang mới)");
    // A full URL never shows up as a "domain".
    expect(text("request.create", { domain: "https://evil.example/?token=abc" }, AN)).toBe("An xin mở trang mới");
  });

  it("devices: labels and browsers, never ids or hashes", () => {
    const pair = text("device.pair", { label: "Laptop An" }, AN);
    expect(pair).toBe("Laptop “Laptop An” của An đã ghép extension");
    const gone = text("ext.uninstalled", { device_id: "dddd-1111", label: "Laptop", notified: true }, AN);
    expect(gone).toBe("Extension trên “Laptop” của An bị gỡ");
    expect(gone).not.toContain("dddd");
    expect(text("ext.missing", { browser: "Edge", notified: true }, AN)).toBe("An mở Study Launcher trên Edge không có extension");
    expect(text("device.code", { child_id: NGUYEN, expires_at: "2026-11-04T12:00:00Z" })).toBe("Tạo mã ghép laptop cho Nguyên");
    expect(text("device.revoke", { id: "x", child_id: NGUYEN })).toBe("Gỡ một laptop của Nguyên khỏi Study Launcher");
  });

  it("login, settings and automatic jobs", () => {
    expect(text("pin.login", { child_id: AN }, AN)).toBe("An đăng nhập bằng PIN");
    expect(text("pin.login_failed", { child_id: AN, try: 3 }, AN)).toBe("An nhập sai PIN (lần 3)");
    expect(text("child.password_reset", { child_id: AN, signed_out: true })).toBe("Đặt lại mật khẩu của An (đăng xuất khỏi mọi máy)");
    expect(text("settings.update", { settings: { free_minutes: 45 } })).toBe("Sửa Luật trong nhà");
    expect(text("child.create", { child_id: AN, display_name: "Đăng An" })).toBe("Tạo tài khoản cho Đăng An");
    expect(text("photos.cleanup", { proofs: 3, homework: 2, bytes: 1, retentionDays: 120 }, null)).toBe("Tự xóa 5 ảnh/tệp cũ hơn 120 ngày");
  });

  it("a parent actor is never taken for the child", () => {
    expect(text("run.verdict", { run_id: "r", verdict: "ok" }, PARENT)).not.toContain("của");
    // An unknown child id reads "con".
    expect(text("child.pin_set", { child_id: "00000000-0000-4000-8000-0000000000ff" })).toBe("Đặt PIN mới cho con");
  });
});

describe("Nhật ký: groups and page parameters", () => {
  it("each group lists only its actions; hidden markers are never listed", () => {
    const all = AUDIT_GROUPS.flatMap((g) => actionsInGroup(g));
    expect(new Set(all).size).toBe(all.length);
    for (const h of HIDDEN_ACTIONS) expect(all).not.toContain(h);
    expect(actionsInGroup("trust")).toEqual(["trust.set", "trust.dismissed"]);
    expect(actionsInGroup("lock")).toContain("override.open");
  });

  it("reads the query string safely", () => {
    expect(parseLogQuery({}, [AN])).toEqual({ childId: null, group: null, limit: LOG_PAGE_SIZE });
    expect(parseLogQuery({ con: AN, nhom: "trust", so: "100" }, [AN])).toEqual({ childId: AN, group: "trust", limit: 100 });
    // Not one of this family's children, a made-up group, silly numbers: ignored / clamped.
    expect(parseLogQuery({ con: NGUYEN, nhom: "x", so: "-5" }, [AN])).toEqual({ childId: null, group: null, limit: LOG_PAGE_SIZE });
    expect(parseLogQuery({ con: "a,b),or(x.eq.1", so: "99999" }, [AN]).childId).toBeNull();
    expect(parseLogQuery({ so: "99999" }, [AN]).limit).toBe(LOG_MAX);
    expect(parseLogQuery({ so: "70" }, [AN]).limit).toBe(100);
  });

  it("builds the 'Xem thêm' link with the filters kept", () => {
    expect(logHref({ childId: null, group: null, limit: LOG_PAGE_SIZE })).toBe("/parent/log");
    expect(logHref({ childId: AN, group: "request", limit: 100 })).toBe(`/parent/log?con=${AN}&nhom=request&so=100`);
  });
});
