import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock @sellsnap/logger
const mockBox = vi.fn();
const mockWarn = vi.fn();
vi.mock("@sellsnap/logger", () => ({
  logger: {
    box: (...args: unknown[]) => mockBox(...args),
    warn: (...args: unknown[]) => mockWarn(...args),
  },
}));

import { sendEmail } from "../email";

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs email via logger.box in development mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    await sendEmail("user@example.com", "Test Subject", "Hello!");

    expect(mockBox).toHaveBeenCalledWith({
      title: "EMAIL",
      message: expect.stringContaining("user@example.com"),
    });

    process.env.NODE_ENV = originalEnv;
  });

  it("warns via logger.warn in production mode without throwing", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    await expect(sendEmail("user@example.com", "Subject", "Content")).resolves.toBeUndefined();
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining("Email service not configured"));

    process.env.NODE_ENV = originalEnv;
  });
});
