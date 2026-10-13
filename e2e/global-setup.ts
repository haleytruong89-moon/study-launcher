import { createClient } from "@supabase/supabase-js";
import { e2eEnv } from "./env";

/** Creates two auth users the way the parent does in the Supabase dashboard (sign-ups are disabled). */
export default async function globalSetup() {
  const env = e2eEnv();
  const admin = createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } });

  for (const [email, password] of [
    [env.parentEmail, env.parentPassword],
    [env.strangerEmail, env.strangerPassword],
  ] as const) {
    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error && !/already/i.test(error.message)) throw error;
  }
}
