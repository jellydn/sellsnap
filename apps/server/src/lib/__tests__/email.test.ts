import { describe, expect, it, vi } from "vitest";
import { sendEmail } from "../email";

describe("sendEmail", () => {
  it("logs email to console in development mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await sendEmail("user@example.com", "Test Subject", "Hello!");

    expect(spy).toHaveBeenCalledWith("=== EMAIL ===");
    expect(spy).toHaveBeenCalledWith("To: user@example.com");
    expect(spy).toHaveBeenCalledWith("Subject: Test Subject");
    expect(spy).toHaveBeenCalledWith("Content: Hello!");
    expect(spy).toHaveBeenCalledWith("=============");

    spy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it("throws in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    await expect(sendEmail("user@example.com", "Subject", "Content")).rejects.toThrow(
      "Email sending is not implemented in production",
    );

    process.env.NODE_ENV = originalEnv;
  });
});
