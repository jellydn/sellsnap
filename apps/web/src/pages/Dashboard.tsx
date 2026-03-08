import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAnalytics, fetchProducts, type Product } from "../lib/api";
import { formatPrice } from "../lib/format";

// Reusable style constants for consistency
const tableHeaderStyle = {
  padding: "0.75rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#6b7280",
};

const cellPaddingStyle = { padding: "0.75rem" };

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

function AnalyticsSection({ analytics }: { analytics: AnalyticsData }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.25rem", fontWeight: 600 }}>Analytics</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ padding: "1rem", backgroundColor: "#eff6ff", borderRadius: "8px" }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>Total Views</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 600 }}>
            {analytics.totals.totalViews}
          </p>
        </div>
        <div style={{ padding: "1rem", backgroundColor: "#f0fdf4", borderRadius: "8px" }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>Total Purchases</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 600 }}>
            {analytics.totals.totalPurchases}
          </p>
        </div>
        <div style={{ padding: "1rem", backgroundColor: "#fdf4ff", borderRadius: "8px" }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>Total Revenue</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 600 }}>
            {formatPrice(analytics.totals.totalRevenue)}
          </p>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ textAlign: "left", ...tableHeaderStyle }}>Product</th>
              <th style={{ textAlign: "right", ...tableHeaderStyle }}>Views</th>
              <th style={{ textAlign: "right", ...tableHeaderStyle }}>Purchases</th>
              <th style={{ textAlign: "right", ...tableHeaderStyle }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {analytics.products.map((product) => (
              <tr key={product.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={cellPaddingStyle}>{product.title}</td>
                <td style={{ ...cellPaddingStyle, textAlign: "right" }}>{product.viewCount}</td>
                <td style={{ ...cellPaddingStyle, textAlign: "right" }}>{product.purchaseCount}</td>
                <td style={{ ...cellPaddingStyle, textAlign: "right" }}>
                  {formatPrice(product.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadProducts = useCallback(async (cursorParam?: string) => {
    const isInitialLoad = !cursorParam;
    if (isInitialLoad) setLoading(true);
    else setLoadingMore(true);

    try {
      const data = await fetchProducts(cursorParam);
      if (cursorParam) {
        setProducts((prev) => [...prev, ...data.items]);
      } else {
        setProducts(data.items);
      }
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadProducts(), fetchAnalytics()])
      .then(([, analyticsData]) => {
        setAnalytics(analyticsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loadProducts]);

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

      {analytics && <AnalyticsSection analytics={analytics} />}

      <h2 style={{ margin: "0 0 1rem", fontSize: "1.25rem", fontWeight: 600 }}>Products</h2>

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
        <>
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
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
              <button
                type="button"
                onClick={() => loadProducts(cursor ?? undefined)}
                disabled={loadingMore}
                style={{
                  backgroundColor: loadingMore ? "#9ca3af" : "#2563eb",
                  color: "white",
                  padding: "0.625rem 1.5rem",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: loadingMore ? "not-allowed" : "pointer",
                }}
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
