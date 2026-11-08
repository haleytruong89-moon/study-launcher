import type { Voice } from "@/lib/binhYen/catalog";

/** "Chọn trước con sẽ làm gì" in Giờ tự do (R6d, artifact vHome). Suggestions only, not rules. */
export const PLAY_IDEAS: Record<Voice, readonly string[]> = {
  detective: ["Đọc truyện tranh", "Vẽ / cosplay", "Nghe nhạc", "Ra ngoài"],
  scientist: ["Thí nghiệm nhỏ", "Ngắm sao", "Chơi game", "Đạp xe"],
};
