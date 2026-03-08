const API_BASE = "/api";
const DEFAULT_PAGE_SIZE = 50 as const;

function buildFormData(data: Record<string, string | File | undefined | null>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value === null) {
      formData.append(key, "");
      continue;
    }
    formData.append(key, value);
  }
  return formData;
}

interface AnalyticsData {
  products: Array<{
    id: string;
    title: string;
    viewCount: number;
    purchaseCount: number;
    revenue: number;
  }>;
  totals: {
    totalViews: number;
    totalPurchases: number;
    totalRevenue: number;
  };
}

// Helper function for consistent error handling
async function handleApiResponse<T>(response: Response, defaultErrorMessage: string): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: defaultErrorMessage }));
    throw new Error(error.error || defaultErrorMessage);
  }
  return response.json();
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  coverImageUrl: string | null;
  previewContent: string | null;
  published: boolean;
  viewCount: number;
  purchaseCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function fetchProducts(cursor?: string): Promise<PaginatedResponse<Product>> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(DEFAULT_PAGE_SIZE));

  const response = await fetch(`${API_BASE}/products?${params}`, {
    credentials: "include",
  });

  return handleApiResponse<PaginatedResponse<Product>>(response, "Failed to fetch products");
}

export interface CreateProductData {
  title: string;
  description: string;
  price: number;
  previewContent?: string;
  coverImage?: File;
  productFile: File;
}

export async function createProduct(data: CreateProductData): Promise<Product> {
  const formData = new FormData();
  formData.append("title", data.title);
  formData.append("description", data.description);
  formData.append("price", data.price.toString());
  if (data.previewContent) {
    formData.append("previewContent", data.previewContent);
  }
  if (data.coverImage) {
    formData.append("coverImage", data.coverImage);
  }
  formData.append("productFile", data.productFile);

  const response = await fetch(`${API_BASE}/products`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  return handleApiResponse<Product>(response, "Failed to create product");
}

export async function fetchProduct(id: string): Promise<Product> {
  const response = await fetch(`${API_BASE}/products/${id}`, {
    credentials: "include",
  });

  return handleApiResponse<Product>(response, "Failed to fetch product");
}

export interface UpdateProductData {
  title?: string;
  description?: string;
  price?: number;
  slug?: string;
  previewContent?: string;
  coverImage?: File | null;
  productFile?: File | null;
}

export async function updateProduct(id: string, data: UpdateProductData): Promise<Product> {
  const formData = buildFormData({
    title: data.title,
    description: data.description,
    price: data.price?.toString(),
    slug: data.slug,
    previewContent: data.previewContent,
    coverImage: data.coverImage,
    productFile: data.productFile,
  });

  const response = await fetch(`${API_BASE}/products/${id}`, {
    method: "PUT",
    credentials: "include",
    body: formData,
  });

  return handleApiResponse<Product>(response, "Failed to update product");
}

export async function toggleProductPublish(
  id: string,
): Promise<{ id: string; title: string; slug: string; published: boolean }> {
  const response = await fetch(`${API_BASE}/products/${id}/publish`, {
    method: "PATCH",
    credentials: "include",
  });

  return handleApiResponse<{ id: string; title: string; slug: string; published: boolean }>(
    response,
    "Failed to toggle publish status",
  );
}

export async function createCheckoutSession(
  productSlug: string,
  customerEmail?: string,
): Promise<{ url: string }> {
  const response = await fetch(`${API_BASE}/checkout/${productSlug}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ customerEmail }),
  });

  return handleApiResponse<{ url: string }>(response, "Failed to create checkout session");
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const response = await fetch(`${API_BASE}/analytics`, {
    credentials: "include",
  });

  return handleApiResponse<AnalyticsData>(response, "Failed to fetch analytics");
}
