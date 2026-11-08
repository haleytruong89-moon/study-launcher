import { describe, expect, it } from "vitest";
import { dropOrder, reorder } from "@/lib/today/reorder";

describe("reorder", () => {
  it("moves down and up", () => {
    expect(reorder(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(reorder(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });
  it("same index or out of range: unchanged copy", () => {
    const l = ["a", "b"];
    expect(reorder(l, 1, 1)).toEqual(l);
    expect(reorder(l, -1, 0)).toEqual(l);
    expect(reorder(l, 0, 5)).toEqual(l);
    expect(reorder(l, 0, 1)).not.toBe(l);
  });
});

describe("dropOrder (drag ⋮⋮ in Góc học tập)", () => {
  const keys = ["a", "b", "done1", "c"];
  const done = new Set(["done1"]);
  it("drops the dragged row where the target row was", () => {
    expect(dropOrder(keys, done, "b", "a")).toEqual(["b", "a", "done1", "c"]);
    expect(dropOrder(keys, done, "a", "c")).toEqual(["b", "done1", "c", "a"]);
  });
  it("done rows are pinned: they cannot be dragged and are not drop targets", () => {
    expect(dropOrder(keys, done, "done1", "a")).toBeNull();
    expect(dropOrder(keys, done, "a", "done1")).toBeNull();
  });
  it("same row or unknown keys: nothing to save", () => {
    expect(dropOrder(keys, done, "a", "a")).toBeNull();
    expect(dropOrder(keys, done, "x", "a")).toBeNull();
    expect(dropOrder(keys, done, "a", "x")).toBeNull();
  });
});
