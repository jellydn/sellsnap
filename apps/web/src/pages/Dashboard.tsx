import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProducts, type Product } from "../lib/api";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      to={`/dashboard/products/${product.id}`}
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "1rem",
        backgroundColor: "white",
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      {product.coverImageUrl && (
        <img
          src={product.coverImageUrl}
          alt={product.title}
          style={{
            width: "100%",
            height: "120px",
            objectFit: "cover",
            borderRadius: "4px",
            marginBottom: "0.75rem",
          }}
        />
      )}
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}>{product.title}</h3>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
        <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>{formatPrice(product.price)}</span>
        <span
          style={{
            fontSize: "0.75rem",
            padding: "0.125rem 0.5rem",
            borderRadius: "9999px",
            backgroundColor: product.published ? "#dcfce7" : "#f3f4f6",
            color: product.published ? "#166534" : "#6b7280",
          }}
        >
          {product.published ? "Published" : "Draft"}
        </span>
      </div>
      <div style={{ display: "flex", gap: "1rem", fontSize: "0.875rem", color: "#6b7280" }}>
        <span>{product.viewCount} views</span>
        <span>{product.purchaseCount} purchases</span>
      </div>
    </Link>
  );
}

export function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <p style={{ color: "#dc2626" }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>Dashboard</h1>
        <Link
          to="/dashboard/products/new"
          style={{
            backgroundColor: "#2563eb",
            color: "white",
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Create Product
        </Link>
      </div>

      {products.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
            You haven't created any products yet.
          </p>
          <Link
            to="/dashboard/products/new"
            style={{
              color: "#2563eb",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Create your first product
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "1rem",
          }}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
