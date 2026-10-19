import { redirect } from "next/navigation";

/** Mở/khóa now lives on each child's card ("Hôm nay") as a bottom sheet (UI review 19/10/2026). */
export default function ControlPage() {
  redirect("/parent");
}
