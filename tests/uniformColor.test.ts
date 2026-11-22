import { describe, expect, it } from "vitest";
import { shirtColour } from "@/lib/schedule/uniformColor";

describe("shirtColour (22/11/2026)", () => {
  it("reads the shirt colour of the uniform texts the family uses", () => {
    expect(shirtColour("Áo polo đỏ, quần thể thao, khăn quàng đỏ, giày có dây")).toBe("#D23B2E");
    expect(shirtColour("Áo trắng, quần kaki/sooc/váy đồng phục, khăn quàng đỏ, giày có dây hoặc dép quai hậu")).toBe("#FFFFFF");
    expect(shirtColour("Đồng phục thể dục (áo xanh lá)")).toBe("#3A9A4A");
    expect(shirtColour("Áo trắng")).toBe("#FFFFFF");
  });
  it("no colour word → null; 'đồng phục' is not 'đỏ'", () => {
    expect(shirtColour("Áo đồng phục lớp")).toBeNull();
    expect(shirtColour("")).toBeNull();
    expect(shirtColour(null)).toBeNull();
  });
  it("the shirt's colour wins over trousers or a scarf mentioned first", () => {
    expect(shirtColour("Quần xanh, áo trắng")).toBe("#FFFFFF");
    expect(shirtColour("Khăn quàng đỏ")).toBe("#D23B2E");
  });
});
