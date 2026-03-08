import { describe, expect, it, vi } from "vitest";

vi.mock("better-auth", () => ({
  betterAuth: vi.fn(() => ({ api: {} })),
}));
vi.mock("better-auth/adapters/prisma", () => ({
  prismaAdapter: vi.fn(),
}));
vi.mock("../prisma", () => ({
  prisma: {},
}));

const { headersToHeaders } = await import("../auth");

describe("headersToHeaders", () => {
  it("converts string values correctly", () => {
    const result = headersToHeaders({ "content-type": "application/json" });
    expect(result).toBeInstanceOf(Headers);
    expect(result.get("content-type")).toBe("application/json");
  });

  it("converts array values by joining with comma-space", () => {
    const result = headersToHeaders({ accept: ["text/html", "application/json"] });
    expect(result.get("accept")).toBe("text/html, application/json");
  });

  it("skips undefined values", () => {
    const result = headersToHeaders({ "x-custom": undefined, "x-present": "yes" });
    expect(result.has("x-custom")).toBe(false);
    expect(result.get("x-present")).toBe("yes");
  });

  it("returns a Headers instance", () => {
    const result = headersToHeaders({});
    expect(result).toBeInstanceOf(Headers);
  });
});
