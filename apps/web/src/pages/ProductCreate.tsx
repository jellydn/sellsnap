import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type CreateProductData, createProduct } from "../lib/api";

export function ProductCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title || !price || !productFile) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      const productData: CreateProductData = {
        title,
        description,
        price: parseFloat(price),
        previewContent: previewContent || undefined,
        coverImage: coverImage || undefined,
        productFile: productFile,
      };

      const product = await createProduct(productData);
      navigate(`/dashboard/products/${product.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.5rem", fontWeight: 600 }}>Create Product</h1>

      {error && (
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            color: "#dc2626",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="title"
            style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}
          >
            Title <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "1rem",
            }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="description"
            style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "1rem",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="price"
            style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}
          >
            Price (in dollars) <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            placeholder="9.99"
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "1rem",
            }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="previewContent"
            style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}
          >
            Preview Content
          </label>
          <textarea
            id="previewContent"
            value={previewContent}
            onChange={(e) => setPreviewContent(e.target.value)}
            rows={4}
            placeholder="Optional preview that customers can see before purchasing"
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "1rem",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="coverImage"
            style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}
          >
            Cover Image
          </label>
          <input
            id="coverImage"
            type="file"
            accept="image/*"
            onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "1rem",
            }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="productFile"
            style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}
          >
            Digital File <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            id="productFile"
            type="file"
            onChange={(e) => setProductFile(e.target.files?.[0] || null)}
            required
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "1rem",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            backgroundColor: loading ? "#9ca3af" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "1rem",
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creating..." : "Create Product"}
        </button>
      </form>
    </div>
  );
}
