/** Shared (server + client) shapes for the template form. Kept out of the "use client" module. */

export interface TemplateValues {
  id?: string;
  childId: string;
  part: "extra" | "skill";
  title: string;
  subject: string;
  appSlotId: string | null;
  weekdays: number[];
  minMinutes: string; // "" = family default
  deepLink: string;
  sort: number;
  active: boolean;
}

export interface SlotOption {
  id: string;
  childId: string | null;
  label: string;
}

export function emptyTemplate(childId: string, part: TemplateValues["part"] = "extra"): TemplateValues {
  return { childId, part, title: "", subject: "", appSlotId: null, weekdays: [], minMinutes: "", deepLink: "", sort: 0, active: true };
}
