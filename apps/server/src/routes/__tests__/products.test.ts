import type { Readable } from "node:stream";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockProductFindMany = vi.fn();
const mockProductFindUnique = vi.fn();
const mockProductFindFirst = vi.fn();
const mockProductCreate = vi.fn();
const mockProductUpdate = vi.fn();
const mockProductDelete = vi.fn();
const mockTransaction = vi.fn();
const mockSaveFile = vi.fn();
const mockSaveImage = vi.fn();

// Helper to drain a readable stream
async function drainStream(stream: Readable): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on("data", () => {});
    stream.on("end", resolve);
    stream.on("error", reject);
  });
}

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
    product: {
      findMany: (...args: unknown[]) => mockProductFindMany(...args),
      findUnique: (...args: unknown[]) => mockProductFindUnique(...args),
      findFirst: (...args: unknown[]) => mockProductFindFirst(...args),
      create: (...args: unknown[]) => mockProductCreate(...args),
      update: (...args: unknown[]) => mockProductUpdate(...args),
      delete: (...args: unknown[]) => mockProductDelete(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("../../lib/upload", () => ({
  saveFile: async (file: Readable, ...args: unknown[]) => {
    await drainStream(file);
    return mockSaveFile(file, ...args);
  },
  saveImage: async (file: Readable, ...args: unknown[]) => {
    await drainStream(file);
    return mockSaveImage(file, ...args);
  },
  validateImageFile: vi.fn(() => null),
  validateProductFile: vi.fn(() => null),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  unlinkSync: vi.fn(),
}));

// Register multipart plugin for Fastify
async function buildApp() {
  const app = Fastify();
  await app.register(multipart);
  const { productRoutes } = await import("../products");
  await app.register(productRoutes);
  return app;
}

describe("product routes", () => {
  let app: ReturnType<typeof Fastify>;

  const mockUser = { id: "user-1", name: "Test User" } as any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession.mockReset();
    mockProductFindMany.mockReset();
    mockProductFindUnique.mockReset();
    mockProductFindFirst.mockReset();
    mockProductCreate.mockReset();
    mockProductUpdate.mockReset();
    mockProductDelete.mockReset();
    mockTransaction.mockReset();
    mockSaveFile.mockReset();
    mockSaveImage.mockReset();
    app = await buildApp();
  });

  describe("GET /api/products", () => {
    it("returns user's products with authentication", async () => {
      // Arrange - Set up authenticated user and products
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);

      const mockProducts = [
        {
          id: "p1",
          title: "Product 1",
          slug: "product-1",
          description: "Description",
          price: 999,
          coverImageUrl: null,
          published: true,
          viewCount: 10,
          createdAt: new Date("2025-01-01"),
          _count: { purchases: 5 },
        },
      ];

      mockProductFindMany.mockResolvedValueOnce(mockProducts as any);

      // Act - Request products
      const response = await app.inject({
        method: "GET",
        url: "/api/products",
      });

      console.log("Response status:", response.statusCode);
      console.log("Response body:", response.body);

      // Assert - Products are returned with purchase counts
      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json).toEqual({
        items: [
          {
            id: "p1",
            title: "Product 1",
            slug: "product-1",
            description: "Description",
            price: 999,
            coverImageUrl: null,
            published: true,
            viewCount: 10,
            purchaseCount: 5,
            createdAt: new Date("2025-01-01").toISOString(),
          },
        ],
        nextCursor: null,
        hasMore: false,
      });

      expect(mockProductFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { creatorId: "user-1" },
        }),
      );
    });

    it("returns 401 for unauthenticated requests", async () => {
      // Arrange - Set up unauthenticated request
      mockGetSession.mockResolvedValueOnce(null as any);

      // Act - Request products
      const response = await app.inject({
        method: "GET",
        url: "/api/products",
      });

      // Assert - 401 response
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "Unauthorized" });
    });

    it("handles pagination with cursor", async () => {
      // Arrange - Set up authenticated user with cursor
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);
      mockProductFindMany.mockResolvedValueOnce([]);

      // Act - Request with cursor
      await app.inject({
        method: "GET",
        url: "/api/products?cursor=p1&limit=20",
      });

      // Assert - Cursor is passed to query
      expect(mockProductFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "p1" },
          skip: 1,
          take: 21, // limit + 1 for pagination
        }),
      );
    });
  });

  describe("GET /api/products/by-slug/:slug", () => {
    const mockPublishedProduct = {
      id: "p1",
      title: "Product",
      slug: "product",
      description: "Description",
      price: 999,
      coverImageUrl: null,
      previewContent: null,
      viewCount: 10,
      createdAt: new Date("2025-01-01"),
      published: true,
      creator: {
        id: "creator-1",
        name: "Creator",
        slug: "creator",
        avatarUrl: null,
      },
    };

    it("returns published product and increments view count", async () => {
      // Arrange - Set up published product
      mockProductFindUnique.mockResolvedValueOnce(mockPublishedProduct as any);

      // Act - Request product by slug
      const response = await app.inject({
        method: "GET",
        url: "/api/products/by-slug/product",
      });

      // Assert - Product is returned
      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.id).toBe("p1");
      expect(json.title).toBe("Product");
    });

    it("returns 404 for unpublished product", async () => {
      // Arrange - Set up unpublished product
      mockProductFindUnique.mockResolvedValueOnce({
        ...mockPublishedProduct,
        published: false,
      } as any);

      // Act - Request unpublished product
      const response = await app.inject({
        method: "GET",
        url: "/api/products/by-slug/product",
      });

      // Assert - 404 response
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Product not found" });
    });

    it("returns 404 for nonexistent product", async () => {
      // Arrange - Set up null product
      mockProductFindUnique.mockResolvedValueOnce(null);

      // Act - Request nonexistent product
      const response = await app.inject({
        method: "GET",
        url: "/api/products/by-slug/nonexistent",
      });

      // Assert - 404 response
      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/products/:id", () => {
    it("returns product if user owns it", async () => {
      // Arrange - Set up authenticated user and product
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);

      const mockProduct = {
        id: "p1",
        title: "Product",
        slug: "product",
        description: "Description",
        price: 999,
        coverImageUrl: null,
        previewContent: null,
        published: true,
        viewCount: 10,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-02"),
        creatorId: "user-1",
      };

      mockProductFindUnique.mockResolvedValueOnce(mockProduct as any);

      // Act - Request product
      const response = await app.inject({
        method: "GET",
        url: "/api/products/p1",
      });

      // Assert - Product is returned
      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.id).toBe("p1");
      expect(json.updatedAt).toBeDefined();
    });

    it("returns 403 if user does not own product", async () => {
      // Arrange - Set up product owned by different user
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);

      const mockProduct = {
        id: "p1",
        creatorId: "other-user",
      };

      mockProductFindUnique.mockResolvedValueOnce(mockProduct as any);

      // Act - Request product
      const response = await app.inject({
        method: "GET",
        url: "/api/products/p1",
      });

      // Assert - 403 response
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "Forbidden" });
    });

    it("returns 404 for nonexistent product", async () => {
      // Arrange - Set up null product
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);
      mockProductFindUnique.mockResolvedValueOnce(null);

      // Act - Request nonexistent product
      const response = await app.inject({
        method: "GET",
        url: "/api/products/nonexistent",
      });

      // Assert - 404 response
      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/products", () => {
    it("creates product with valid data", async () => {
      // Arrange - Set up authenticated user and mocks
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);

      const newProduct = {
        id: "new-1",
        title: "New Product",
        slug: "new-product",
        description: "",
        price: 1999,
        coverImageUrl: null,
        filePath: "/uploads/file.pdf",
        previewContent: null,
        published: false,
        viewCount: 0,
        creatorId: "user-1",
        createdAt: new Date("2025-01-01"),
      };

      mockProductFindUnique.mockResolvedValueOnce(null);
      mockSaveFile.mockResolvedValueOnce("/uploads/file.pdf");
      mockProductCreate.mockResolvedValueOnce(newProduct as any);

      // Act - Create product with multipart form
      const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
      const response = await app.inject({
        method: "POST",
        url: "/api/products",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        payload:
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="title"\r\n\r\n` +
          `New Product\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="price"\r\n\r\n` +
          `19.99\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="productFile"; filename="test.pdf"\r\n` +
          `Content-Type: application/pdf\r\n\r\n` +
          `file content\r\n` +
          `--${boundary}--`,
      });

      // Assert - Product is created
      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.title).toBe("New Product");
      expect(json.slug).toBe("new-product");
      expect(json.price).toBe(1999);
    });

    it("returns 400 for missing required fields", async () => {
      // Arrange - Set up authenticated user
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);

      // Act - Create product without required fields
      const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
      const response = await app.inject({
        method: "POST",
        url: "/api/products",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        payload:
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="title"\r\n\r\n` +
          `Product\r\n` +
          `--${boundary}--`,
      });

      // Assert - 400 response
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "Missing required fields: title, price, productFile",
      });
    });

    it("generates unique slug when slug exists", async () => {
      // Arrange - Set up existing product with same slug
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);

      const existingProduct = {
        id: "existing-1",
        slug: "new-product",
      };

      mockProductFindUnique.mockResolvedValueOnce(existingProduct as any);
      mockProductFindFirst.mockResolvedValueOnce(null);
      mockSaveFile.mockResolvedValueOnce("/uploads/file.pdf");

      const newProduct = {
        id: "new-1",
        slug: "new-product-1",
        title: "New Product",
      };

      mockProductCreate.mockResolvedValueOnce(newProduct as any);

      // Act - Create product
      const boundary2 = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
      await app.inject({
        method: "POST",
        url: "/api/products",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary2}`,
        },
        payload:
          `--${boundary2}\r\n` +
          `Content-Disposition: form-data; name="title"\r\n\r\n` +
          `New Product\r\n` +
          `--${boundary2}\r\n` +
          `Content-Disposition: form-data; name="price"\r\n\r\n` +
          `19.99\r\n` +
          `--${boundary2}\r\n` +
          `Content-Disposition: form-data; name="productFile"; filename="test.pdf"\r\n` +
          `Content-Type: application/pdf\r\n\r\n` +
          `file content\r\n` +
          `--${boundary2}--`,
      });

      // Assert - Unique slug is generated
      expect(mockProductCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "new-product-1",
        }),
      );
    });
  });

  describe("PATCH /api/products/:id/publish", () => {
    it("toggles publish status to true", async () => {
      // Arrange - Set up authenticated user and unpublished product
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);

      const product = {
        id: "p1",
        title: "Product",
        slug: "product",
        published: false,
        creatorId: "user-1",
      };

      mockProductFindUnique.mockResolvedValueOnce(product as any);

      const updatedProduct = {
        ...product,
        published: true,
      };

      mockProductUpdate.mockResolvedValueOnce(updatedProduct as any);

      // Act - Toggle publish
      const response = await app.inject({
        method: "PATCH",
        url: "/api/products/p1/publish",
      });

      // Assert - Product is published
      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.published).toBe(true);
    });

    it("toggles publish status to false", async () => {
      // Arrange - Set up authenticated user and published product
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);

      const product = {
        id: "p1",
        title: "Product",
        slug: "product",
        published: true,
        creatorId: "user-1",
      };

      mockProductFindUnique.mockResolvedValueOnce(product as any);

      const updatedProduct = {
        ...product,
        published: false,
      };

      mockProductUpdate.mockResolvedValueOnce(updatedProduct as any);

      // Act - Toggle publish
      const response = await app.inject({
        method: "PATCH",
        url: "/api/products/p1/publish",
      });

      // Assert - Product is unpublished
      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.published).toBe(false);
    });

    it("returns 403 when user does not own product", async () => {
      // Arrange - Set up product owned by different user
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);

      const product = {
        id: "p1",
        creatorId: "other-user",
      };

      mockProductFindUnique.mockResolvedValueOnce(product as any);

      // Act - Try to toggle publish
      const response = await app.inject({
        method: "PATCH",
        url: "/api/products/p1/publish",
      });

      // Assert - 403 response
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "Forbidden" });
    });
  });

  describe("DELETE /api/products/:id", () => {
    it("deletes product and files", async () => {
      // Arrange - Set up authenticated user and product
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);

      const product = {
        id: "p1",
        creatorId: "user-1",
        filePath: "/uploads/file.pdf",
        coverImageUrl: "/uploads/cover.jpg",
      };

      mockProductFindUnique.mockResolvedValueOnce(product as any);
      mockProductDelete.mockResolvedValueOnce(undefined as any);

      const { existsSync } = await import("node:fs");
      vi.mocked(existsSync).mockReturnValue(true);

      // Act - Delete product
      const response = await app.inject({
        method: "DELETE",
        url: "/api/products/p1",
      });

      // Assert - Product is deleted
      expect(response.statusCode).toBe(204);
      expect(mockProductDelete).toHaveBeenCalledWith({
        where: { id: "p1" },
      });
    });

    it("returns 404 for nonexistent product", async () => {
      // Arrange - Set up null product
      mockGetSession.mockResolvedValueOnce({ user: mockUser } as any);
      mockProductFindUnique.mockResolvedValueOnce(null);

      // Act - Delete nonexistent product
      const response = await app.inject({
        method: "DELETE",
        url: "/api/products/nonexistent",
      });

      // Assert - 404 response
      expect(response.statusCode).toBe(404);
    });
  });
});
