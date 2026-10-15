/**
 * Client-side photo compression before upload (SPEC 2.6 "Giao bài", DESIGN section 9):
 * longest edge <= 1600 px, JPEG quality 0.8 (~200-400 KB per photo).
 */

export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.8;

/** Target size that fits within `maxEdge` on the longest side, never upscaling. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  if (width <= 0 || height <= 0) throw new Error("fitWithin: invalid size");
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Browser only: decodes the photo (respecting EXIF orientation), downsizes and re-encodes as JPEG. */
export async function compressImage(file: Blob, maxEdge = MAX_EDGE, quality = JPEG_QUALITY): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas không dùng được trên trình duyệt này");
    ctx.fillStyle = "#ffffff"; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Không nén được ảnh");
    return blob;
  } finally {
    bitmap.close();
  }
}
