/**
 * "Thêm nhanh" bundles for "Trang học" (parent decision 24/10/2026). These are only
 * SUGGESTIONS: nothing is allowed until a parent taps the bundle, and then each domain is
 * stored as an ordinary allowlist row the parent can remove (family rules stay data).
 * Google sign-in itself (accounts.google.com) is already a system entry.
 * Extra pieces a page turns out to need are found by the extension's blocked-frame report.
 */
export interface Preset {
  id: "meet" | "notebooklm" | "gdocs" | "zalo";
  label: string;
  sub: string;
  domains: readonly string[];
}

export const PRESETS: readonly Preset[] = [
  {
    id: "meet",
    label: "Google Meet",
    sub: "Vào phòng học online qua link Meet",
    // ogs = the Google bar / account menu, apis = Google's embedded widgets,
    // contacts = people cards inside Meet.
    domains: ["meet.google.com", "ogs.google.com", "apis.google.com", "contacts.google.com"],
  },
  {
    id: "notebooklm",
    label: "NotebookLM",
    sub: "Sổ học, thẻ ghi nhớ, bài kiểm tra của NotebookLM",
    domains: ["notebooklm.google.com", "notebooklm.google", "ogs.google.com", "apis.google.com"],
  },
  {
    id: "gdocs",
    label: "Google Docs / Drive / Forms",
    sub: "Link bài tập là tài liệu, bảng tính, Form hoặc file Drive",
    domains: ["docs.google.com", "drive.google.com", "drive.usercontent.google.com", "forms.gle"],
  },
  {
    // 12/11/2026: on by default (migration 0016); zalo.me also covers chat.zalo.me.
    id: "zalo",
    label: "Zalo",
    sub: "Nhắn thầy cô, nhận file bài tập qua Zalo trên web",
    domains: ["zalo.me"],
  },
];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
