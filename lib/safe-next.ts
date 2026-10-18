/** A same-site path to go to after login ("/ghep-may"), or null. Never another site. */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.length > 2000) return null;
  return value;
}
