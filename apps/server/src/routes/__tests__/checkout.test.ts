import { describe, expect, it } from "vitest";
import { z } from "zod";

const checkoutBodySchema = z.object({
  customerEmail: z.string().email().optional(),
});

describe("checkoutBodySchema", () => {
  it("accepts valid email", () => {
    const result = checkoutBodySchema.safeParse({ customerEmail: "test@example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerEmail).toBe("test@example.com");
    }
  });

  it("accepts empty body", () => {
    const result = checkoutBodySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerEmail).toBeUndefined();
    }
  });

  it("rejects invalid email", () => {
    const result = checkoutBodySchema.safeParse({ customerEmail: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("accepts undefined email", () => {
    const result = checkoutBodySchema.safeParse({ customerEmail: undefined });
    expect(result.success).toBe(true);
  });

  it("rejects non-string email", () => {
    const result = checkoutBodySchema.safeParse({ customerEmail: 123 });
    expect(result.success).toBe(false);
  });
});
