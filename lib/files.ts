/**
 * Homework attachments (parent decision 17/10/2026): photos + PDF + Word + Excel,
 * at most 5 MB per file and 6 files per homework item. Shared by browser and server.
 *
 * Files live in the private `homework` bucket at
 *   {family_id}/{child_id}/{YYYY-MM-DD}/{uuid}.{ext}
 * and are always opened through /api/files/homework (same origin as the app), so the
 * browser extension never has to allow the storage domain.
 */

export type FileKind = "image" | "pdf" | "word" | "excel";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_HOMEWORK_FILES = 6;

const TYPES: Record<string, { mime: string; kind: FileKind }> = {
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  png: { mime: "image/png", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  pdf: { mime: "application/pdf", kind: "pdf" },
  doc: { mime: "application/msword", kind: "word" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "word" },
  xls: { mime: "application/vnd.ms-excel", kind: "excel" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "excel" },
};

/** `accept` attribute for the parent's file picker. */
export const HOMEWORK_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx";

export const KIND_LABEL: Record<FileKind, string> = { image: "Ảnh", pdf: "PDF", word: "Word", excel: "Excel" };

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/** Kind of a stored path or a picked file name; null when not an allowed type. */
export function fileKind(name: string): FileKind | null {
  return TYPES[extOf(name)]?.kind ?? null;
}

export function mimeOf(name: string): string | null {
  return TYPES[extOf(name)]?.mime ?? null;
}

/** Extension to store a picked (non-image) file under; null when not allowed. */
export function storedExt(file: { name: string; type: string }): string | null {
  const ext = extOf(file.name);
  if (TYPES[ext]) return ext === "jpeg" ? "jpg" : ext;
  const byMime = Object.entries(TYPES).find(([, t]) => t.mime === file.type);
  return byMime ? byMime[0] : null;
}

const FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|pdf|doc|docx|xls|xlsx)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A homework file must sit in this family's + child's folder (any date sub-folder, since
 * the due date can be edited later), so nobody can attach another child's file.
 */
export function isHomeworkFilePath(path: string, familyId: string, childId: string): boolean {
  const prefix = `${familyId}/${childId}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length).split("/");
  return rest.length === 2 && DATE_RE.test(rest[0] ?? "") && FILE_RE.test(rest[1] ?? "");
}

/** Same-origin URL that streams one homework file after an RLS-checked download. */
export function homeworkFileUrl(path: string): string {
  return `/api/files/homework?path=${encodeURIComponent(path)}`;
}

/** What screens need to show one attachment. */
export interface AttachmentView {
  path: string;
  kind: FileKind;
  url: string;
}

export function attachmentViews(paths: string[]): AttachmentView[] {
  return paths.flatMap((path) => {
    const kind = fileKind(path);
    return kind ? [{ path, kind, url: homeworkFileUrl(path) }] : [];
  });
}
