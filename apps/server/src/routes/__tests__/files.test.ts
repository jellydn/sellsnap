import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockPurchaseFindUnique = vi.fn();
const mockPurchaseUpdate = vi.fn();
const mockPurchaseUpdateMany = vi.fn();
const mockPurchaseFindMany = vi.fn();

vi.mock("../../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
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
  getSessionFromRequest: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    purchase: {
      findUnique: (...args: unknown[]) => mockPurchaseFindUnique(...args),
      update: (...args: unknown[]) => mockPurchaseUpdate(...args),
      updateMany: (...args: unknown[]) => mockPurchaseUpdateMany(...args),
      findMany: (...args: unknown[]) => mockPurchaseFindMany(...args),
    },
  },
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
  createReadStream: vi.fn(() => {
    const { Readable } = require("node:stream");
    return Readable.from(["file content"]);
  }),
}));

vi.mock("@sellsnap/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

async function buildApp() {
  const app = Fastify();
  const { fileRoutes } = await import("../files");
  await app.register(fileRoutes);
  return app;
}

describe("file routes", () => {
  let app: ReturnType<typeof Fastify>;

  const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const pastDate = new Date(Date.now() - 1000);

  const mockPurchase = {
    id: "purchase-1",
    downloadToken: "valid-token",
    downloadExpiresAt: futureDate,
    downloadAttempts: 0,
    maxDownloadAttempts: 3,
    boundIpAddress: null,
    revokedAt: null,
    product: {
      id: "p1",
      title: "Test Product",
      filePath: "/uploads/test.pdf",
      creatorId: "creator-1",
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  describe("GET /api/download/:token", () => {
    it("allows download for a valid token", async () => {
      // Arrange
      mockPurchaseFindUnique.mockResolvedValueOnce(mockPurchase as any);
      mockPurchaseUpdateMany.mockResolvedValueOnce({ count: 1 } as any);

      // Act
      const response = await app.inject({
        method: "GET",
        url: "/api/download/valid-token",
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-disposition"]).toContain("Test Product");
      expect(response.headers["content-type"]).toBe("application/octet-stream");
      expect(mockPurchaseUpdateMany).toHaveBeenCalledWith({
        where: { id: "purchase-1", downloadAttempts: { lt: 3 } },
        data: {
          downloadAttempts: { increment: 1 },
          boundIpAddress: expect.any(String),
        },
      });
    });

    it("returns 404 for unknown token", async () => {
      // Arrange
      mockPurchaseFindUnique.mockResolvedValueOnce(null);

      // Act
      const response = await app.inject({
        method: "GET",
        url: "/api/download/unknown-token",
      });

      // Assert
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Download not found" });
    });

    it("returns 410 for expired token", async () => {
      // Arrange
      mockPurchaseFindUnique.mockResolvedValueOnce({
        ...mockPurchase,
        downloadExpiresAt: pastDate,
      } as any);

      // Act
      const response = await app.inject({
        method: "GET",
        url: "/api/download/expired-token",
      });

      // Assert
      expect(response.statusCode).toBe(410);
      expect(response.json()).toEqual({ error: "Download link expired" });
    });

    it("returns 410 for revoked token", async () => {
      // Arrange
      mockPurchaseFindUnique.mockResolvedValueOnce({
        ...mockPurchase,
        revokedAt: pastDate,
      } as any);

      // Act
      const response = await app.inject({
        method: "GET",
        url: "/api/download/revoked-token",
      });

      // Assert
      expect(response.statusCode).toBe(410);
      expect(response.json()).toEqual({ error: "Download link has been revoked" });
    });

    it("returns 429 when download attempt limit is exceeded", async () => {
      // Arrange
      mockPurchaseFindUnique.mockResolvedValueOnce({
        ...mockPurchase,
        downloadAttempts: 3,
        maxDownloadAttempts: 3,
      } as any);
      mockPurchaseUpdateMany.mockResolvedValueOnce({ count: 0 } as any);

      // Act
      const response = await app.inject({
        method: "GET",
        url: "/api/download/overused-token",
      });

      // Assert
      expect(response.statusCode).toBe(429);
      expect(response.json()).toEqual({ error: "Download attempt limit exceeded" });
    });

    it("returns 403 when IP does not match bound IP", async () => {
      // Arrange
      mockPurchaseFindUnique.mockResolvedValueOnce({
        ...mockPurchase,
        boundIpAddress: "10.0.0.1",
      } as any);

      // Act - request comes from a different IP (default Fastify test IP is 127.0.0.1)
      const response = await app.inject({
        method: "GET",
        url: "/api/download/ip-bound-token",
        remoteAddress: "10.0.0.2",
      });

      // Assert
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: "Download token is not valid for this IP address",
      });
    });

    it("binds IP on first download attempt", async () => {
      // Arrange
      mockPurchaseFindUnique.mockResolvedValueOnce({
        ...mockPurchase,
        boundIpAddress: null,
      } as any);
      mockPurchaseUpdateMany.mockResolvedValueOnce({ count: 1 } as any);

      // Act
      const response = await app.inject({
        method: "GET",
        url: "/api/download/new-token",
        remoteAddress: "192.168.1.1",
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(mockPurchaseUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "purchase-1" }),
          data: expect.objectContaining({
            boundIpAddress: "192.168.1.1",
            downloadAttempts: { increment: 1 },
          }),
        }),
      );
    });

    it("allows download from the same bound IP", async () => {
      // Arrange
      mockPurchaseFindUnique.mockResolvedValueOnce({
        ...mockPurchase,
        boundIpAddress: "192.168.1.1",
        downloadAttempts: 1,
      } as any);
      mockPurchaseUpdateMany.mockResolvedValueOnce({ count: 1 } as any);

      // Act
      const response = await app.inject({
        method: "GET",
        url: "/api/download/bound-token",
        remoteAddress: "192.168.1.1",
      });

      // Assert
      expect(response.statusCode).toBe(200);
    });

    it("returns 404 when file does not exist on disk", async () => {
      // Arrange
      mockPurchaseFindUnique.mockResolvedValueOnce(mockPurchase as any);
      const { existsSync } = await import("node:fs");
      vi.mocked(existsSync).mockReturnValueOnce(false);

      // Act
      const response = await app.inject({
        method: "GET",
        url: "/api/download/valid-token",
      });

      // Assert
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "File not found" });
    });
  });

  describe("POST /api/download/:token/revoke", () => {
    const mockCreator = { id: "creator-1", name: "Creator" };

    it("revokes a valid token owned by the creator", async () => {
      // Arrange
      mockGetSession.mockResolvedValueOnce({ user: mockCreator } as any);
      mockPurchaseFindUnique.mockResolvedValueOnce(mockPurchase as any);
      mockPurchaseUpdate.mockResolvedValueOnce({
        ...mockPurchase,
        revokedAt: new Date(),
      } as any);

      // Act
      const response = await app.inject({
        method: "POST",
        url: "/api/download/valid-token/revoke",
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ revoked: true });
      expect(mockPurchaseUpdate).toHaveBeenCalledWith({
        where: { id: "purchase-1" },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("returns 401 for unauthenticated requests", async () => {
      // Arrange
      mockGetSession.mockResolvedValueOnce(null as any);

      // Act
      const response = await app.inject({
        method: "POST",
        url: "/api/download/valid-token/revoke",
      });

      // Assert
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 403 when user does not own the product", async () => {
      // Arrange
      mockGetSession.mockResolvedValueOnce({ user: { id: "other-user" } } as any);
      mockPurchaseFindUnique.mockResolvedValueOnce(mockPurchase as any);

      // Act
      const response = await app.inject({
        method: "POST",
        url: "/api/download/valid-token/revoke",
      });

      // Assert
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "Forbidden" });
    });

    it("returns 404 for unknown token", async () => {
      // Arrange
      mockGetSession.mockResolvedValueOnce({ user: mockCreator } as any);
      mockPurchaseFindUnique.mockResolvedValueOnce(null);

      // Act
      const response = await app.inject({
        method: "POST",
        url: "/api/download/unknown-token/revoke",
      });

      // Assert
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Download not found" });
    });

    it("returns 409 when token is already revoked", async () => {
      // Arrange
      mockGetSession.mockResolvedValueOnce({ user: mockCreator } as any);
      mockPurchaseFindUnique.mockResolvedValueOnce({
        ...mockPurchase,
        revokedAt: pastDate,
      } as any);

      // Act
      const response = await app.inject({
        method: "POST",
        url: "/api/download/already-revoked-token/revoke",
      });

      // Assert
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: "Token already revoked" });
    });
  });

  describe("GET /api/purchases", () => {
    it("returns purchases for authenticated creator", async () => {
      // Arrange
      const mockCreator = { id: "creator-1", name: "Creator" };
      mockGetSession.mockResolvedValueOnce({ user: mockCreator } as any);

      const mockPurchases = [
        {
          id: "purchase-1",
          customerEmail: "buyer@example.com",
          customerName: "Buyer",
          amount: 999,
          downloadAttempts: 1,
          maxDownloadAttempts: 3,
          downloadExpiresAt: futureDate,
          revokedAt: null,
          createdAt: new Date("2025-01-01"),
          product: { id: "p1", title: "Test Product" },
        },
      ];

      mockPurchaseFindMany.mockResolvedValueOnce(mockPurchases as any);

      // Act
      const response = await app.inject({
        method: "GET",
        url: "/api/purchases",
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.purchases).toHaveLength(1);
      expect(json.purchases[0].customerEmail).toBe("buyer@example.com");
    });

    it("returns 401 for unauthenticated requests", async () => {
      // Arrange
      mockGetSession.mockResolvedValueOnce(null as any);

      // Act
      const response = await app.inject({
        method: "GET",
        url: "/api/purchases",
      });

      // Assert
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "Unauthorized" });
    });
  });
});
