import { byJson } from "@/lib/binhYen/http";

/**
 * Gone (parent decision 07/11/2026): Góc bình yên has no separate PIN any more — the child's
 * own login opens it (POST /api/by/open). Kept as 410 so an old open tab gets a clear answer.
 */
export function POST() {
  return byJson({ error: "Góc bình yên không cần PIN nữa. Tải lại trang nhé." }, 410);
}
