import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

interface ProductData {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  coverImageUrl: string | null;
  previewContent: string | null;
  viewCount: number;
  createdAt: string;
  creator: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
  };
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductData | null>(null);

  useEffect(() => {
    if (!slug) return;

    fetch(`/api/products/by-slug/${slug}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Product not found" }));
          throw new Error(err.error || "Product not found");
        }
        return res.json();
      })
      .then(setProduct)
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h1 className="text-2xl font-bold">Product Not Found</h1>
        <p className="text-gray-500">{error || "This product doesn't exist or is unpublished."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {product.coverImageUrl && (
        <img
          src={product.coverImageUrl}
          alt={product.title}
          className="w-full h-64 object-cover rounded-lg mb-8"
        />
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.title}</h1>
          <a href={`/creator/${product.creator.slug}`} className="text-blue-500 hover:underline">
            by {product.creator.name}
          </a>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold">{formatPrice(product.price)}</p>
        </div>
      </div>

      {product.previewContent && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Preview</h2>
          <div className="whitespace-pre-wrap">{product.previewContent}</div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Description</h2>
        <div className="whitespace-pre-wrap text-gray-700">{product.description}</div>
      </div>

      <button
        type="button"
        className="w-full py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white text-lg font-semibold rounded-lg"
      >
        Buy Now — {formatPrice(product.price)}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500">{product.viewCount} views</p>
    </div>
  );
}
