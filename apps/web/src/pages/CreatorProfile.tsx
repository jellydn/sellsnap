import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { PaginatedResponse } from "../lib/api";
import { formatPrice } from "../lib/format";

interface CreatorProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
  coverImageUrl: string | null;
  createdAt: string;
}

interface CreatorData {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  products: PaginatedResponse<CreatorProduct>;
}

// Helper component for avatar display
function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.charAt(0).toUpperCase();

  return avatarUrl ? (
    <img src={avatarUrl} alt={name} className="w-20 h-20 rounded-full object-cover" />
  ) : (
    <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
      <span className="text-2xl font-bold text-gray-500">{initials}</span>
    </div>
  );
}

export function CreatorProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creator, setCreator] = useState<CreatorData | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    fetch(`/api/creators/${slug}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Creator not found" }));
          throw new Error(err.error || "Creator not found");
        }
        return res.json();
      })
      .then(setCreator)
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

  if (error || !creator) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h1 className="text-2xl font-bold">Creator Not Found</h1>
        <p className="text-gray-500">{error || "This creator doesn't exist."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-8">
        <Avatar name={creator.name} avatarUrl={creator.avatarUrl} />
        <div>
          <h1 className="text-2xl font-bold">{creator.name}</h1>
          {creator.slug && <p className="text-gray-500">@{creator.slug}</p>}
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">Products</h2>

      {creator.products.items.length === 0 ? (
        <p className="text-gray-500">No products yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {creator.products.items.map((product) => (
            <Link
              key={product.id}
              to={`/p/${product.slug}`}
              className="block border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              {product.coverImageUrl && (
                <img
                  src={product.coverImageUrl}
                  alt={product.title}
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-4">
                <h3 className="font-semibold mb-1">{product.title}</h3>
                <p className="font-bold text-lg">{formatPrice(product.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
