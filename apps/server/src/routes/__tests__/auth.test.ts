import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApiMethod = vi.fn();

vi.mock("../../lib/auth", () => {
  return {
    auth: {
      api: {
        getSession: mockApiMethod,
        getCurrentSession: mockApiMethod,
        signOut: mockApiMethod,
        signUpEmail: mockApiMethod,
        signInEmail: mockApiMethod,
      },
    },
    headersToHeaders: (h: Record<string, string | string[] | undefined>) => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(h)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            for (const v of value) {
              headers.append(key, v);
            }
          } else {
            headers.set(key, value);
          }
        }
      }
      return headers;
    },
  };
});

describe("auth routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockApiMethod.mockReset();
    app = Fastify();
    const { authRoutes } = await import("../auth");
    await app.register(authRoutes);
  });

  describe("GET /api/auth/*", () => {
    it("returns 404 for unknown auth path", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/unknown-path",
        headers: { host: "localhost:3000" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("handles auth api errors", async () => {
      mockApiMethod.mockRejectedValueOnce(new Error("Auth service error"));

      const response = await app.inject({
        method: "GET",
        url: "/api/auth/session",
        headers: { host: "localhost:3000" },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
    });
  });

  describe("POST /api/auth/*", () => {
    it("returns 404 for unknown auth path", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/unknown-path",
        headers: { host: "localhost:3000" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("handles auth api errors on POST", async () => {
      mockApiMethod.mockRejectedValueOnce(new Error("Auth service error"));

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        headers: {
          host: "localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "test@example.com", password: "password" }),
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
