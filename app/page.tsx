import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.profile) redirect("/setup");
  redirect(me.profile.role === "parent" ? "/parent" : "/today");
}
