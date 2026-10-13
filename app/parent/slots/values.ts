/** Shared (server + client) shapes for the slot form. Kept out of the "use client" module. */

export interface SlotValues {
  id?: string;
  childId: string | null;
  subject: string;
  kind: "internal" | "external" | "placeholder";
  label: string;
  url: string;
  allowDomains: string[];
  active: boolean;
}

export const EMPTY_SLOT: SlotValues = { childId: null, subject: "", kind: "external", label: "", url: "", allowDomains: [], active: true };
