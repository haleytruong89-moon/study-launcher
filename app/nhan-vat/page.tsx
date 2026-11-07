import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { storedAvatar } from "@/lib/avatar";
import { readAvatar } from "@/lib/avatarServer";
import type { AvatarPics } from "@/lib/avatarPics";
import { voiceFor } from "@/lib/binhYen/catalog";
import { bySettings } from "@/lib/binhYen/session";
import { requireChild } from "@/lib/today/service";
import { Creator } from "./creator";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nhân vật của con",
  robots: { index: false, follow: false },
};

/** R3a: the child makes their own character (docs/BINH_YEN_BIEU_TUONG.md §A). Child only. */
export default async function AvatarPage({ searchParams }: { searchParams: Promise<{ tu?: string }> }) {
  const { tu } = await searchParams;
  const me = await getCurrentUser();
  if (!me?.profile) redirect(`/login?next=${encodeURIComponent("/nhan-vat")}`);
  if (me.profile.role === "parent") redirect("/parent");
  const guard = await requireChild();
  if (!guard.ok) redirect("/login");
  const { ctx } = guard;

  const voice = voiceFor(ctx.grade);
  let avatar: unknown = null;
  let pics: AvatarPics = {};
  let icon: string | null = null;
  let byEnabled = false;
  try {
    [{ avatar, pics, icon }, { enabled: byEnabled }] = await Promise.all([readAvatar(ctx), bySettings(ctx.familyId)]);
  } catch {
    console.error("avatar page failed");
  }
  const { avatar: look, mine } = storedAvatar(avatar, voice);

  return (
    <Creator
      voice={voice}
      color={ctx.color ?? "#2B5D4F"}
      icon={icon}
      initial={look}
      initialPics={pics}
      mine={mine}
      back={tu === "binh-yen" && byEnabled ? "binh-yen" : "hom-nay"}
      byEnabled={byEnabled}
    />
  );
}
