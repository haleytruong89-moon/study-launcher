import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // Domain used for the internal e-mail of child accounts (never receives mail).
  CHILD_EMAIL_DOMAIN: z.string().min(3).default("study-launcher.local"),
  // Only this e-mail may run the first-run setup (blocks strangers who sign up before the parent does).
  FIRST_PARENT_EMAIL: z.string().email().optional(),
});

/** Browser-safe settings. NEXT_PUBLIC_* must be referenced literally so Next.js can inline them. */
export function publicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

/** Server-only settings (includes the service_role key). Never import this from client code. */
export function serverEnv() {
  return serverSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    CHILD_EMAIL_DOMAIN: process.env.CHILD_EMAIL_DOMAIN || undefined,
    FIRST_PARENT_EMAIL: process.env.FIRST_PARENT_EMAIL || undefined,
  });
}
