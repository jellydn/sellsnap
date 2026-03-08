import { describe, expect, it } from "vitest";
import { formatPrice } from "../format";

describe("formatPrice", () => {
  it("formats cents to dollars correctly", () => {
    expect(formatPrice(999)).toBe("$9.99");
    expect(formatPrice(100)).toBe("$1.00");
    expect(formatPrice(1)).toBe("$0.01");
  });

  it("handles zero price", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("handles large amounts", () => {
    expect(formatPrice(12345678)).toBe("$123456.78");
    expect(formatPrice(99999999)).toBe("$999999.99");
  });

  it("handles single digit cents", () => {
    expect(formatPrice(501)).toBe("$5.01");
    expect(formatPrice(109)).toBe("$1.09");
  });

  it("handles round dollar amounts", () => {
    expect(formatPrice(1000)).toBe("$10.00");
    expect(formatPrice(50000)).toBe("$500.00");
  });
});
