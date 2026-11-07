import { describe, expect, it } from "vitest";
import { MAX_PIC_BYTES, hasPics, isAvatarPicPath, isPicSlot, parsePics, picFor, picUrl, sniffPic } from "@/lib/avatarPics";

const FAM = "10000000-0000-4000-8000-00000000000a";
const KID = "00000000-0000-4000-8000-0000000000c1";
const SIB = "00000000-0000-4000-8000-0000000000c2";
const p = (n: number, ext = "png") => `${FAM}/${KID}/${String(n).repeat(8)}-1111-4111-8111-111111111111.${ext}`;

describe("Picrew pictures (R3b)", () => {
  it("accepts only paths in that child's folder, png or jpg", () => {
    expect(isAvatarPicPath(p(1), FAM, KID)).toBe(true);
    expect(isAvatarPicPath(p(1, "jpg"), FAM, KID)).toBe(true);
    expect(isAvatarPicPath(p(1), FAM, SIB)).toBe(false);
    expect(isAvatarPicPath(p(1, "svg"), FAM, KID)).toBe(false);
    expect(isAvatarPicPath(`../${p(1)}`, FAM)).toBe(false);
    expect(isAvatarPicPath(`${p(1)}/x.png`, FAM)).toBe(false);
    expect(isAvatarPicPath(p(1), FAM)).toBe(true);
  });
  it("reads the stored map: unknown faces and foreign paths are dropped", () => {
    expect(parsePics({ calm: p(1), smile: p(2), photo: p(3), sad: `${FAM}/${SIB}/x.png` }, FAM, KID)).toEqual({ calm: p(1), smile: p(2) });
    expect(parsePics(null, FAM, KID)).toEqual({});
    expect(parsePics([p(1)], FAM, KID)).toEqual({});
    expect(hasPics({})).toBe(false);
    expect(hasPics({ sad: p(1) })).toBe(true);
  });
  it("a face without its own picture uses the first one (bình yên, vui, buồn, bực)", () => {
    expect(picFor({ calm: p(1), sad: p(3) }, "sad")).toBe(p(3));
    expect(picFor({ calm: p(1), sad: p(3) }, "angry")).toBe(p(1));
    expect(picFor({ sad: p(3), angry: p(4) }, "smile")).toBe(p(3));
    expect(picFor({}, "calm")).toBeNull();
    expect(isPicSlot("calm")).toBe(true);
    expect(isPicSlot("photo")).toBe(false);
  });
  it("knows the file type from its first bytes only", () => {
    expect(sniffPic(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(sniffPic(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffPic(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffPic(new Uint8Array([]))).toBeNull();
  });
  it("is served from our own address; 1 MB at most", () => {
    expect(picUrl(p(1))).toBe(`/api/files/avatar?path=${encodeURIComponent(p(1))}`);
    expect(MAX_PIC_BYTES).toBe(1024 * 1024);
  });
});
