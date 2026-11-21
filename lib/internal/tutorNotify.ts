// lib/internal/tutorNotify.ts — the body the maths tutor sends to POST /api/internal/tutor-notify (D23).
// Only 3 kinds, no free text: a leaked secret can at most send one of the fixed money messages.
import { z } from "zod";

const body = z.discriminatedUnion("kind", [
  z.object({ familyId: z.uuid(), kind: z.literal("economy") }).strict(),
  z.object({ familyId: z.uuid(), kind: z.literal("console_blocked") }).strict(),
  z.object({ familyId: z.uuid(), kind: z.literal("burn"), forecastUsd: z.number().positive().max(10000) }).strict(),
]);

export type TutorNotify = z.infer<typeof body>;

export function parseTutorNotify(raw: unknown): TutorNotify | null {
  const r = body.safeParse(raw);
  return r.success ? r.data : null;
}
