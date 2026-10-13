import { createClient } from "@/lib/supabase/server";

export type Role = "parent" | "child";

export interface CurrentUser {
  userId: string;
  email: string | undefined;
  /** null when the auth user exists but no profile has been created yet (first-run setup). */
  profile: {
    id: string;
    family_id: string;
    role: Role;
    display_name: string;
    grade: number | null;
    color: string | null;
  } | null;
}

/** Returns the signed-in user and profile, or null when not signed in. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id, role, display_name, grade, color")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    userId: data.user.id,
    email: data.user.email,
    profile: profile ? { ...profile, role: profile.role as Role } : null,
  };
}
