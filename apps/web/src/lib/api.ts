const API_BASE = "/api";

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

export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(`${API_BASE}/products`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch products" }));
    throw new Error(error.error || "Failed to fetch products");
  }

  return response.json();
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

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to create product" }));
    throw new Error(error.error || "Failed to create product");
  }

  return response.json();
}

export async function fetchProduct(id: string): Promise<Product> {
  const response = await fetch(`${API_BASE}/products/${id}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch product" }));
    throw new Error(error.error || "Failed to fetch product");
  }

  return response.json();
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
  const formData = new FormData();

  if (data.title !== undefined) formData.append("title", data.title);
  if (data.description !== undefined) formData.append("description", data.description);
  if (data.price !== undefined) formData.append("price", data.price.toString());
  if (data.slug !== undefined) formData.append("slug", data.slug);
  if (data.previewContent !== undefined) formData.append("previewContent", data.previewContent);
  if (data.coverImage !== undefined) {
    if (data.coverImage === null) {
      formData.append("coverImage", "");
    } else {
      formData.append("coverImage", data.coverImage);
    }
  }
  if (data.productFile !== undefined) {
    if (data.productFile === null) {
      formData.append("productFile", "");
    } else {
      formData.append("productFile", data.productFile);
    }
  }

  const response = await fetch(`${API_BASE}/products/${id}`, {
    method: "PUT",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to update product" }));
    throw new Error(error.error || "Failed to update product");
  }

  return response.json();
}

export async function toggleProductPublish(
  id: string,
): Promise<{ id: string; title: string; slug: string; published: boolean }> {
  const response = await fetch(`${API_BASE}/products/${id}/publish`, {
    method: "PATCH",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to toggle publish status" }));
    throw new Error(error.error || "Failed to toggle publish status");
  }

  return response.json();
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

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Failed to create checkout session" }));
    throw new Error(error.error || "Failed to create checkout session");
  }

  return response.json();
}

export async function fetchAnalytics() {
  const response = await fetch(`${API_BASE}/analytics`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch analytics" }));
    throw new Error(error.error || "Failed to fetch analytics");
  }

  return response.json();
}
