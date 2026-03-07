import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCheckoutSession,
  createProduct,
  fetchAnalytics,
  fetchProduct,
  fetchProducts,
  type PaginatedResponse,
  type Product,
  toggleProductPublish,
  updateProduct,
} from "../api";

describe("API functions", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("fetchProducts", () => {
    it("fetches products with default pagination", async () => {
      // Arrange - Set up successful response
      const mockResponse: PaginatedResponse<Product> = {
        items: [
          {
            id: "1",
            title: "Test Product",
            slug: "test-product",
            description: "A test product",
            price: 999,
            coverImageUrl: null,
            previewContent: null,
            published: true,
            viewCount: 0,
            purchaseCount: 0,
            createdAt: "2025-01-01T00:00:00.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Act - Fetch products
      const result = await fetchProducts();

      // Assert - Request was made correctly and data is returned
      expect(mockFetch).toHaveBeenCalledWith("/api/products?limit=50", { credentials: "include" });
      expect(result).toEqual(mockResponse);
    });

    it("fetches products with cursor pagination", async () => {
      // Arrange - Set up successful response with cursor
      const mockResponse: PaginatedResponse<Product> = {
        items: [],
        nextCursor: "next-page-token",
        hasMore: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Act - Fetch products with cursor
      const result = await fetchProducts("next-page-token");

      // Assert - Request includes cursor parameter
      expect(mockFetch).toHaveBeenCalledWith("/api/products?cursor=next-page-token&limit=50", {
        credentials: "include",
      });
      expect(result.nextCursor).toBe("next-page-token");
      expect(result.hasMore).toBe(true);
    });

    it("throws error on failed fetch", async () => {
      // Arrange - Set up failed response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Unauthorized" }),
      });

      // Act & Assert - Function throws error
      await expect(fetchProducts()).rejects.toThrow("Unauthorized");
    });

    it("uses default error message when json parsing fails", async () => {
      // Arrange - Set up failed response with invalid json
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      // Act & Assert - Function uses default error message
      await expect(fetchProducts()).rejects.toThrow("Failed to fetch products");
    });
  });

  describe("createProduct", () => {
    const mockProductData = {
      title: "New Product",
      description: "A new product",
      price: 1999,
      previewContent: "<p>Preview</p>",
      productFile: new File(["content"], "product.pdf", { type: "application/pdf" }),
    };

    it("creates product successfully", async () => {
      // Arrange - Set up successful response
      const mockCreatedProduct: Product = {
        id: "new-1",
        title: "New Product",
        slug: "new-product",
        description: "A new product",
        price: 1999,
        coverImageUrl: null,
        previewContent: "<p>Preview</p>",
        published: false,
        viewCount: 0,
        purchaseCount: 0,
        createdAt: "2025-01-01T00:00:00.000Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedProduct,
      });

      // Act - Create product
      const result = await createProduct(mockProductData);

      // Assert - FormData was sent and product is returned
      expect(mockFetch).toHaveBeenCalledWith("/api/products", {
        method: "POST",
        credentials: "include",
        body: expect.any(FormData),
      });

      expect(result.title).toBe("New Product");
      expect(result.price).toBe(1999);
    });

    it("creates product with cover image", async () => {
      // Arrange - Set up data with cover image
      const dataWithImage = {
        ...mockProductData,
        coverImage: new File(["image"], "cover.jpg", { type: "image/jpeg" }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "new-1" }),
      });

      // Act - Create product with cover image
      await createProduct(dataWithImage);

      // Assert - FormData includes the cover image
      const callArgs = mockFetch.mock.calls[0];
      const formData = callArgs[1]?.body as FormData;

      expect(formData.get("coverImage")).toBeInstanceOf(File);
      expect(formData.get("title")).toBe("New Product");
    });

    it("throws error on failed creation", async () => {
      // Arrange - Set up failed response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Validation failed" }),
      });

      // Act & Assert - Function throws error
      await expect(createProduct(mockProductData)).rejects.toThrow("Validation failed");
    });
  });

  describe("fetchProduct", () => {
    it("fetches single product by id", async () => {
      // Arrange - Set up successful response
      const mockProduct: Product = {
        id: "prod-1",
        title: "Product",
        slug: "product",
        description: "Description",
        price: 999,
        coverImageUrl: null,
        previewContent: null,
        published: true,
        viewCount: 10,
        purchaseCount: 2,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-02T00:00:00.000Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProduct,
      });

      // Act - Fetch product
      const result = await fetchProduct("prod-1");

      // Assert - Request was made to correct endpoint
      expect(mockFetch).toHaveBeenCalledWith("/api/products/prod-1", {
        credentials: "include",
      });
      expect(result.id).toBe("prod-1");
      expect(result.updatedAt).toBeDefined();
    });

    it("throws error when product not found", async () => {
      // Arrange - Set up 404 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Product not found" }),
      });

      // Act & Assert - Function throws error
      await expect(fetchProduct("nonexistent")).rejects.toThrow("Product not found");
    });
  });

  describe("updateProduct", () => {
    it("updates product title and description", async () => {
      // Arrange - Set up successful response
      const mockUpdatedProduct: Product = {
        id: "prod-1",
        title: "Updated Title",
        slug: "product",
        description: "Updated description",
        price: 999,
        coverImageUrl: null,
        previewContent: null,
        published: true,
        viewCount: 10,
        purchaseCount: 2,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-02T00:00:00.000Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdatedProduct,
      });

      // Act - Update product
      const result = await updateProduct("prod-1", {
        title: "Updated Title",
        description: "Updated description",
      });

      // Assert - PUT request was made
      expect(mockFetch).toHaveBeenCalledWith("/api/products/prod-1", {
        method: "PUT",
        credentials: "include",
        body: expect.any(FormData),
      });

      expect(result.title).toBe("Updated Title");
      expect(result.description).toBe("Updated description");
    });

    it("updates product with null cover image to remove it", async () => {
      // Arrange - Set up successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "prod-1", coverImageUrl: null }),
      });

      // Act - Update product with null cover image
      await updateProduct("prod-1", { coverImage: null });

      // Assert - FormData includes empty string for cover image
      const callArgs = mockFetch.mock.calls[0];
      const formData = callArgs[1]?.body as FormData;

      expect(formData.get("coverImage")).toBe("");
    });

    it("throws error on unauthorized update", async () => {
      // Arrange - Set up 403 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Forbidden" }),
      });

      // Act & Assert - Function throws error
      await expect(updateProduct("prod-1", { title: "New Title" })).rejects.toThrow("Forbidden");
    });
  });

  describe("toggleProductPublish", () => {
    it("toggles product publish status to true", async () => {
      // Arrange - Set up successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "prod-1",
          title: "Product",
          slug: "product",
          published: true,
        }),
      });

      // Act - Toggle publish
      const result = await toggleProductPublish("prod-1");

      // Assert - PATCH request was made and status is toggled
      expect(mockFetch).toHaveBeenCalledWith("/api/products/prod-1/publish", {
        method: "PATCH",
        credentials: "include",
      });

      expect(result.published).toBe(true);
    });

    it("toggles product publish status to false", async () => {
      // Arrange - Set up successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "prod-1",
          title: "Product",
          slug: "product",
          published: false,
        }),
      });

      // Act - Toggle publish
      const result = await toggleProductPublish("prod-1");

      // Assert - Status is now false
      expect(result.published).toBe(false);
    });
  });

  describe("createCheckoutSession", () => {
    it("creates checkout session without email", async () => {
      // Arrange - Set up successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://checkout.stripe.com/pay/123" }),
      });

      // Act - Create checkout session
      const result = await createCheckoutSession("my-product");

      // Assert - POST request was made
      expect(mockFetch).toHaveBeenCalledWith("/api/checkout/my-product", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customerEmail: undefined }),
      });

      expect(result.url).toBe("https://checkout.stripe.com/pay/123");
    });

    it("creates checkout session with customer email", async () => {
      // Arrange - Set up successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://checkout.stripe.com/pay/456" }),
      });

      // Act - Create checkout session with email
      const result = await createCheckoutSession("my-product", "test@example.com");

      // Assert - Email is included in request body
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.customerEmail).toBe("test@example.com");
      expect(result.url).toBe("https://checkout.stripe.com/pay/456");
    });
  });

  describe("fetchAnalytics", () => {
    it("fetches analytics data", async () => {
      // Arrange - Set up successful response
      const mockAnalytics = {
        products: [
          { id: "p1", title: "Product 1", viewCount: 100, purchaseCount: 5, revenue: 5000 },
        ],
        totals: {
          totalViews: 100,
          totalPurchases: 5,
          totalRevenue: 5000,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalytics,
      });

      // Act - Fetch analytics
      const result = await fetchAnalytics();

      // Assert - Request was made and data is returned
      expect(mockFetch).toHaveBeenCalledWith("/api/analytics", {
        credentials: "include",
      });

      expect((result as any).products).toHaveLength(1);
      expect((result as any).totals.totalRevenue).toBe(5000);
    });

    it("throws error on failed fetch", async () => {
      // Arrange - Set up failed response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Analytics unavailable" }),
      });

      // Act & Assert - Function throws error
      await expect(fetchAnalytics()).rejects.toThrow("Analytics unavailable");
    });
  });
});
