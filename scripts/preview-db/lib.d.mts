// Types for lib.mjs (the project does not type-check plain JS: allowJs is off).

export const REF_RE: RegExp;
export const TEST_EMAIL_DOMAINS: string[];
export function isTestEmail(email: unknown): boolean;
export function refFromDbUrl(dbUrl: unknown): string | null;
export function refFromApiUrl(apiUrl: unknown): string | null;
export function refFromJwtKey(key: unknown): string | null;
export function checkPreviewTarget(input: {
  previewDbUrl?: string;
  productionRef?: string;
  serviceKey?: string;
  localApiUrl?: string;
}): { ok: true; ref: string; apiUrl: string } | { ok: false; reason: string };
export function vnDate(now: Date, addDays?: number): string;

export interface SeedTemplate {
  part: "extra" | "skill";
  title: string;
  subject: string | null;
  min_minutes: number;
}
export interface SeedHomework {
  subject: string;
  addDays: number;
  note: string;
}
export interface SeedChild {
  email: string;
  displayName: string;
  grade: number;
  color: string;
  templates: SeedTemplate[];
  homework: SeedHomework[];
}
export const SEED: {
  familyName: string;
  parent: { email: string; displayName: string };
  children: SeedChild[];
};
