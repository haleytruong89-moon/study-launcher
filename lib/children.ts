import { randomBytes } from "node:crypto";

/** "Hạnh Nguyên" -> "hanh-nguyen" (ASCII, safe for an e-mail local part). */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "child";
}

/** Internal sign-in e-mail for a child account. The address never receives mail. */
export function childEmail(displayName: string, domain: string, suffix = randomBytes(3).toString("hex")): string {
  return `${slugify(displayName)}-${suffix}@${domain}`;
}

/** Strong random password. The child never needs to know it (DESIGN section 2). */
export function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}
