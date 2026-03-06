import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsRoutes } from "../analytics";

vi.mock("../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
  headersToHeaders: (h: Record<string, string | string[] | undefined>) => h,
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
    },
    purchase: {
      groupBy: vi.fn(),
    },
  },
}));

import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

const mockGetSession = vi.mocked(auth.api.getSession);
const mockProductFindMany = vi.mocked(prisma.product.findMany);
const mockPurchaseGroupBy = vi.mocked(prisma.purchase.groupBy);

describe("analytics routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(analyticsRoutes);
  });

  describe("GET /api/analytics", () => {
    const mockUser = { id: "user-1", name: "Test User" } as any;

    it("returns 401 for unauthenticated requests", async () => {
      mockGetSession.mockResolvedValue(null as any);

      const response = await app.inject({
        method: "GET",
        url: "/api/analytics",
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns correct totals using groupBy aggregation", async () => {
      mockGetSession.mockResolvedValue({ user: mockUser } as any);

      mockProductFindMany.mockResolvedValue([
        { id: "p1", title: "Product 1", viewCount: 100, _count: { purchases: 5 } },
        { id: "p2", title: "Product 2", viewCount: 200, _count: { purchases: 3 } },
      ] as any);

      mockPurchaseGroupBy.mockResolvedValue([
        { productId: "p1", _sum: { amount: 5000 } },
        { productId: "p2", _sum: { amount: 3000 } },
      ] as any);

      const response = await app.inject({
        method: "GET",
        url: "/api/analytics",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        products: [
          { id: "p1", title: "Product 1", viewCount: 100, purchaseCount: 5, revenue: 5000 },
          { id: "p2", title: "Product 2", viewCount: 200, purchaseCount: 3, revenue: 3000 },
        ],
        totals: {
          totalViews: 300,
          totalPurchases: 8,
          totalRevenue: 8000,
        },
      });

      expect(mockPurchaseGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ["productId"],
          _sum: { amount: true },
        }),
      );
    });

    it("only includes user's own products", async () => {
      mockGetSession.mockResolvedValue({ user: mockUser } as any);

      mockProductFindMany.mockResolvedValue([]);
      mockPurchaseGroupBy.mockResolvedValue([]);

      await app.inject({
        method: "GET",
        url: "/api/analytics",
      });

      expect(mockProductFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { creatorId: "user-1" },
        }),
      );
      expect(mockPurchaseGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            product: { creatorId: "user-1" },
            status: "completed",
          },
        }),
      );
    });

    it("handles empty products", async () => {
      mockGetSession.mockResolvedValue({ user: mockUser } as any);

      mockProductFindMany.mockResolvedValue([]);
      mockPurchaseGroupBy.mockResolvedValue([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/analytics",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        products: [],
        totals: {
          totalViews: 0,
          totalPurchases: 0,
          totalRevenue: 0,
        },
      });
    });

    it("handles products with zero revenue", async () => {
      mockGetSession.mockResolvedValue({ user: mockUser } as any);

      mockProductFindMany.mockResolvedValue([
        { id: "p1", title: "Free Product", viewCount: 50, _count: { purchases: 0 } },
      ] as any);

      mockPurchaseGroupBy.mockResolvedValue([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/analytics",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        products: [
          { id: "p1", title: "Free Product", viewCount: 50, purchaseCount: 0, revenue: 0 },
        ],
        totals: {
          totalViews: 50,
          totalPurchases: 0,
          totalRevenue: 0,
        },
      });
    });
  });
});
