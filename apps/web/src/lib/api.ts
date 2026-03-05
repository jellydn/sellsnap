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
