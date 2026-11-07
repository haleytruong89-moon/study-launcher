import { describe, expect, it } from "vitest";
import { cleanAvatarName, defaultAvatar, parseAvatar, storedAvatar } from "@/lib/avatar";
import { ACTIVITIES, WORDS } from "@/lib/binhYen/catalog";
import { ACTIVITY_EMOJI, WORD_EMOJI, wordEmoji } from "@/lib/binhYen/emoji";

const ok = { style: "long", hair: "den", eye: "nau", skin: "sang", outfit: "nau", acc: "none", name: "Mèo Đen" };

describe("avatar codes (R3a)", () => {
  it("accepts known codes and a short name", () => {
    expect(parseAvatar(ok)).toEqual(ok);
    expect(parseAvatar({ ...ok, name: undefined })).toEqual({ ...ok, name: "" });
  });
  it.each([
    ["unknown hair colour", { ...ok, hair: "cau_vong" }],
    ["unknown accessory", { ...ok, acc: "kiem" }],
    ["extra field (e.g. a photo URL)", { ...ok, photo: "https://x" }],
    ["name too long", { ...ok, name: "x".repeat(25) }],
    ["name not text", { ...ok, name: 5 }],
    ["a prototype-inherited key", { ...ok, __proto__: { x: 1 }, style: "constructor" }],
    ["not an object", "long"],
    ["array", [ok]],
  ])("refuses %s", (_l, v) => expect(parseAvatar(v)).toBeNull());
  it("cleans the name (spaces, control and direction characters)", () => {
    expect(cleanAvatarName("  Mèo‮   Đen\n ")).toBe("Mèo Đen");
    expect(cleanAvatarName("🐱".repeat(24))).toBe("🐱".repeat(24));
  });
  it("a bad stored value falls back to the default character", () => {
    expect(storedAvatar({ hair: "??" }, "detective")).toEqual({ avatar: defaultAvatar("detective"), mine: false });
    expect(storedAvatar(ok, "scientist")).toEqual({ avatar: ok, mine: true });
    expect(defaultAvatar("scientist").acc).toBe("hat");
  });
});

describe("pictures beside words and activities (R3a §C)", () => {
  it("every word and every activity has one", () => {
    for (const w of WORDS) expect(WORD_EMOJI[w.key], w.key).toBeTruthy();
    for (const a of ACTIVITIES) expect(ACTIVITY_EMOJI[a.key], a.key).toBeTruthy();
  });
  it("a word no longer in the list gets its quadrant's picture", () => {
    expect(wordEmoji("khong_co", "blue")).toBe("🌊");
  });
});
