import type { Metadata } from "next";
import { BlockedView } from "./blocked-view";

export const metadata: Metadata = { title: "Giờ học — trang này đang tạm chặn" };

/** Lock page the extension redirects to: /blocked?u=<original URL> (DESIGN section 7). Public. */
export default function BlockedPage() {
  return <BlockedView />;
}
