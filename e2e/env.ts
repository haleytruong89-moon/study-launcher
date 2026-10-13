/** Values come from the local Supabase stack started by CI (`supabase status -o env`). */
export function e2eEnv() {
  const need = (name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`e2e: missing env ${name}`);
    return v;
  };
  return {
    supabaseUrl: need("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: need("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceKey: need("SUPABASE_SERVICE_ROLE_KEY"),
    parentEmail: need("FIRST_PARENT_EMAIL"),
    parentPassword: "Parent-e2e-Passw0rd!",
    strangerEmail: "stranger@example.com",
    strangerPassword: "Stranger-e2e-Passw0rd!",
  };
}
