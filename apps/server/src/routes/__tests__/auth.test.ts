import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Create a mock function that can be controlled from tests
const mockHandler = vi.fn();

vi.mock("../../lib/auth", () => {
  return {
    auth: {
      handler: (...args: unknown[]) => mockHandler(...args),
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
    mockHandler.mockReset();
    app = Fastify();
    const { authRoutes } = await import("../auth");
    await app.register(authRoutes);
  });

  describe("GET /api/auth/*", () => {
    it("forwards GET requests to auth handler", async () => {
      // Arrange - Set up successful auth response
      const mockResponseBody = '{"user": {"id": "123"}}';
      const mockResponse = {
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(mockResponseBody));
            controller.close();
          },
        }),
        text: async () => mockResponseBody,
      } as any;

      mockHandler.mockResolvedValueOnce(mockResponse);

      // Act - Make GET request
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/session",
        headers: {
          host: "localhost:3000",
          cookie: "session=test",
        },
      });

      // Assert - Auth handler was called with correct Request
      expect(mockHandler).toHaveBeenCalledWith(expect.any(Request));
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ user: { id: "123" } });
    });

    it("forwards POST requests to auth handler", async () => {
      // Arrange - Set up successful auth response
      const mockResponseBody = '{"user": {"id": "456"}}';
      const mockResponse = {
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(mockResponseBody));
            controller.close();
          },
        }),
        text: async () => mockResponseBody,
      } as any;

      mockHandler.mockResolvedValueOnce(mockResponse);

      // Act - Make POST request
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/signin",
        headers: {
          host: "localhost:3000",
          "content-type": "application/json",
        },
        body: { email: "test@example.com", password: "password" },
      });

      // Assert - Auth handler was called and response is returned
      expect(mockHandler).toHaveBeenCalledWith(expect.any(Request));
      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({ user: { id: "456" } });
    });

    it("includes all headers in forwarded request", async () => {
      // Arrange - Set up auth handler to capture Request
      let capturedRequest: Request | null = null;
      mockHandler.mockImplementation(async (req: Request) => {
        capturedRequest = req;
        const responseBody = "{}";
        return {
          status: 200,
          headers: new Headers(),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(responseBody));
              controller.close();
            },
          }),
          text: async () => responseBody,
        } as any;
      });

      // Act - Make request with custom headers
      await app.inject({
        method: "GET",
        url: "/api/auth/session",
        headers: {
          host: "localhost:3000",
          "user-agent": "TestAgent",
          "x-custom-header": "custom-value",
        },
      });

      // Assert - Request includes all headers
      expect(capturedRequest).not.toBeNull();
      expect((capturedRequest as Request | null)?.headers.get("user-agent")).toBe("TestAgent");
      expect((capturedRequest as Request | null)?.headers.get("x-custom-header")).toBe(
        "custom-value",
      );
    });

    it("includes request body in forwarded request", async () => {
      // Arrange - Set up auth handler to capture Request
      let capturedBody: string | null = null;
      mockHandler.mockImplementation(async (req: Request) => {
        capturedBody = await req.text();
        const responseBody = "{}";
        return {
          status: 200,
          headers: new Headers(),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(responseBody));
              controller.close();
            },
          }),
          text: async () => responseBody,
        } as any;
      });

      // Act - Make POST request with body
      await app.inject({
        method: "POST",
        url: "/api/auth/signin",
        headers: {
          host: "localhost:3000",
          "content-type": "application/json",
        },
        body: { email: "test@example.com", password: "password" },
      });

      // Assert - Body is included in forwarded request
      expect(capturedBody).toBe('{"email":"test@example.com","password":"password"}');
    });

    it("returns null body when response has no body", async () => {
      // Arrange - Set up auth response without body (undefined body, not null)
      mockHandler.mockResolvedValueOnce({
        status: 204,
        headers: new Headers(),
        text: async () => "",
      } as any);

      // Act - Make request (use GET since route only supports GET/POST)
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/session",
        headers: { host: "localhost:3000" },
      });

      // Assert - Response is empty
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
    });

    it("handles auth handler errors", async () => {
      // Arrange - Set up auth handler to throw error
      mockHandler.mockRejectedValueOnce(new Error("Auth service error"));

      // Act - Make request
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/session",
        headers: { host: "localhost:3000" },
      });

      // Assert - Error is caught and returns 500
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
    });

    it("copies response headers from auth handler", async () => {
      // Arrange - Set up auth response with headers
      const responseBody = '{"success": true}';
      mockHandler.mockResolvedValueOnce({
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
          "set-cookie": "session=new-value",
        }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(responseBody));
            controller.close();
          },
        }),
        text: async () => responseBody,
      } as any);

      // Act - Make request
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/session",
        headers: { host: "localhost:3000" },
      });

      // Assert - Headers are copied
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.headers["set-cookie"]).toBe("session=new-value");
    });
  });
});
