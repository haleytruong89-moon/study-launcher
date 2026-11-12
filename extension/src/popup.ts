/// <reference types="chrome" />
import { LAUNCHER_URL } from "./config";
import { currentWarning, warningText, type EffectiveState } from "./core";

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

async function render() {
  const r = await chrome.storage.local.get(["lastEffective", "token", "warn"]);
  const eff = r.lastEffective as EffectiveState | undefined;
  const paired = typeof r.token === "string";
  const status = document.getElementById("status");
  const pair = document.getElementById("pair") as HTMLAnchorElement | null;
  if (!status) return;
  if (!paired) status.textContent = "Chưa ghép máy với tài khoản của con.";
  else if (eff?.reason === "no-host-access")
    status.textContent = "Tiện ích bị tắt quyền truy cập trang web — đang khóa. Bố mẹ/con vào Quản lý tiện ích › Study Launcher › Quyền truy cập trang web, chọn “Trên tất cả các trang web”.";
  else if (!eff || eff.locked) {
    status.textContent =
      eff?.reason === "offline" ? "Mất kết nối máy chủ — đang chỉ mở trang học." : eff?.reason === "unconfirmed" || eff?.reason === "never-synced" ? "Đang kiểm tra với máy chủ…" : "Giờ học — chỉ mở trang học.";
  } else {
    const warning = currentWarning(r.warn, eff); // D2 A2: the last minutes before it locks again
    status.textContent = warning ? warningText(warning) : eff.openUntil ? `Đang mở mọi trang đến ${hhmm(eff.openUntil)}.` : "Đang mở mọi trang.";
  }
  if (pair) pair.hidden = paired;
}

document.getElementById("open")?.addEventListener("click", () => void chrome.tabs.create({ url: `${LAUNCHER_URL}/today` }));
const pairLink = document.getElementById("pair") as HTMLAnchorElement | null;
if (pairLink) pairLink.href = `${LAUNCHER_URL}/ghep-may`;
void render();
