const API_BASE = "/api";

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  coverImageUrl: string | null;
  published: boolean;
  viewCount: number;
  purchaseCount: number;
  createdAt: string;
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
