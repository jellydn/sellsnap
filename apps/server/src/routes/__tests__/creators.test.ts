import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { creatorRoutes } from "../creators";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../../lib/prisma";

const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockProductFindMany = vi.mocked(prisma.product.findMany);

describe("creator routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(creatorRoutes);
  });

  describe("GET /api/creators/:slug", () => {
    const mockCreator = {
      id: "creator-1",
      name: "Jane Doe",
      slug: "jane-doe",
      avatarUrl: "https://example.com/avatar.jpg",
    };

    const mockProducts = [
      {
        id: "p1",
        title: "Product 1",
        slug: "product-1",
        price: 999,
        coverImageUrl: "https://example.com/cover1.jpg",
        createdAt: new Date("2025-01-01"),
      },
      {
        id: "p2",
        title: "Product 2",
        slug: "product-2",
        price: 1999,
        coverImageUrl: null,
        createdAt: new Date("2025-01-02"),
      },
    ];

    it("returns creator with published products", async () => {
      // Arrange - Set up database mocks
      mockUserFindUnique.mockResolvedValueOnce(mockCreator as any);
      mockProductFindMany.mockResolvedValueOnce(mockProducts as any);

      // Act - Request creator profile
      const response = await app.inject({
        method: "GET",
        url: "/api/creators/jane-doe",
      });

      // Assert - Response contains creator and products
      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json).toEqual({
        id: "creator-1",
        name: "Jane Doe",
        slug: "jane-doe",
        avatarUrl: "https://example.com/avatar.jpg",
        products: {
          items: [
            {
              id: "p1",
              title: "Product 1",
              slug: "product-1",
              price: 999,
              coverImageUrl: "https://example.com/cover1.jpg",
              createdAt: new Date("2025-01-01").toISOString(),
            },
            {
              id: "p2",
              title: "Product 2",
              slug: "product-2",
              price: 1999,
              coverImageUrl: null,
              createdAt: new Date("2025-01-02").toISOString(),
            },
          ],
          nextCursor: null,
          hasMore: false,
        },
      });

      // Verify products query was for published products only
      expect(mockProductFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            creatorId: "creator-1",
            published: true,
          },
        }),
      );
    });

    it("returns 404 when creator not found", async () => {
      // Arrange - Set up database to return null
      mockUserFindUnique.mockResolvedValueOnce(null);

      // Act - Request nonexistent creator
      const response = await app.inject({
        method: "GET",
        url: "/api/creators/nonexistent",
      });

      // Assert - 404 response
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Creator not found" });
    });

    it("returns empty products array when creator has no products", async () => {
      // Arrange - Set up creator with no products
      mockUserFindUnique.mockResolvedValueOnce(mockCreator as any);
      mockProductFindMany.mockResolvedValueOnce([]);

      // Act - Request creator profile
      const response = await app.inject({
        method: "GET",
        url: "/api/creators/jane-doe",
      });

      // Assert - Response has empty products
      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.products.items).toEqual([]);
      expect(json.products.hasMore).toBe(false);
    });

    it("handles pagination with cursor", async () => {
      // Arrange - Set up pagination
      mockUserFindUnique.mockResolvedValueOnce(mockCreator as any);
      mockProductFindMany.mockResolvedValueOnce([
        {
          id: "p2",
          title: "Product 2",
          slug: "product-2",
          price: 1999,
          coverImageUrl: null,
          createdAt: new Date("2025-01-02"),
        },
      ] as any);

      // Act - Request with cursor
      const response = await app.inject({
        method: "GET",
        url: "/api/creators/jane-doe?cursor=p1&limit=10",
      });

      // Assert - Cursor and skip are passed to query
      expect(response.statusCode).toBe(200);
      expect(mockProductFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "p1" },
          skip: 1,
          take: 11, // limit + 1 for pagination
        }),
      );
    });

    it("sets hasMore to true when there are more products", async () => {
      // Arrange - Return more products than limit
      const manyProducts = Array.from({ length: 11 }, (_, i) => ({
        id: `p${i}`,
        title: `Product ${i}`,
        slug: `product-${i}`,
        price: 999,
        coverImageUrl: null,
        createdAt: new Date(`2025-01-0${i + 1}`),
      }));

      mockUserFindUnique.mockResolvedValueOnce(mockCreator as any);
      mockProductFindMany.mockResolvedValueOnce(manyProducts as any);

      // Act - Request with limit 10
      const response = await app.inject({
        method: "GET",
        url: "/api/creators/jane-doe?limit=10",
      });

      // Assert - hasMore is true and nextCursor is set
      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.products.items).toHaveLength(10);
      expect(json.products.hasMore).toBe(true);
      expect(json.products.nextCursor).toBe("p9");
    });

    it("sets hasMore to false when there are no more products", async () => {
      // Arrange - Return fewer products than limit
      mockUserFindUnique.mockResolvedValueOnce(mockCreator as any);
      mockProductFindMany.mockResolvedValueOnce(mockProducts as any);

      // Act - Request with limit 10
      const response = await app.inject({
        method: "GET",
        url: "/api/creators/jane-doe?limit=10",
      });

      // Assert - hasMore is false
      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.products.items).toHaveLength(2);
      expect(json.products.hasMore).toBe(false);
      expect(json.products.nextCursor).toBeNull();
    });

    it("uses default limit of 10 when not specified", async () => {
      // Arrange - Set up mocks
      mockUserFindUnique.mockResolvedValueOnce(mockCreator as any);
      mockProductFindMany.mockResolvedValueOnce([]);

      // Act - Request without limit
      await app.inject({
        method: "GET",
        url: "/api/creators/jane-doe",
      });

      // Assert - Default limit of 10 is used
      expect(mockProductFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 11, // limit + 1 for pagination check
        }),
      );
    });

    it("orders products by createdAt descending", async () => {
      // Arrange - Set up mocks
      mockUserFindUnique.mockResolvedValueOnce(mockCreator as any);
      mockProductFindMany.mockResolvedValueOnce([]);

      // Act - Request creator
      await app.inject({
        method: "GET",
        url: "/api/creators/jane-doe",
      });

      // Assert - Products are ordered by createdAt desc
      expect(mockProductFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("returns creator without avatar", async () => {
      // Arrange - Set up creator without avatar
      const creatorWithoutAvatar = {
        ...mockCreator,
        avatarUrl: null,
      };

      mockUserFindUnique.mockResolvedValueOnce(creatorWithoutAvatar as any);
      mockProductFindMany.mockResolvedValueOnce([]);

      // Act - Request creator
      const response = await app.inject({
        method: "GET",
        url: "/api/creators/jane-doe",
      });

      // Assert - AvatarUrl is null in response
      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.avatarUrl).toBeNull();
    });
  });
});
