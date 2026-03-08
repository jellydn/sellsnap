import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchProduct, type Product, toggleProductPublish, updateProduct } from "../lib/api";

export function ProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [slug, setSlug] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);

  useEffect(() => {
    if (!id) return;

    fetchProduct(id)
      .then((p) => {
        setProduct(p);
        setTitle(p.title);
        setDescription(p.description);
        setPrice((p.price / 100).toString());
        setSlug(p.slug);
        setPreviewContent(p.previewContent || "");
        setCoverImagePreview(p.coverImageUrl);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const data: Parameters<typeof updateProduct>[1] = {
        title,
        description,
        price: parseFloat(price),
        slug,
        previewContent: previewContent || undefined,
      };

      if (coverImage) {
        data.coverImage = coverImage;
      }

      if (productFile) {
        data.productFile = productFile;
      }

      const updated = await updateProduct(id, data);
      setProduct(updated);
      setSuccess("Product updated successfully!");
      setCoverImagePreview(updated.coverImageUrl);
      setCoverImage(null);
      setProductFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!id) return;

    try {
      const result = await toggleProductPublish(id);
      setProduct((p) => (p ? { ...p, published: result.published } : null));
      setSuccess(result.published ? "Product published!" : "Product unpublished");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle publish status");
    }
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImage(file);
      setCoverImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCopyLink = () => {
    if (product?.published) {
      navigator.clipboard.writeText(`${window.location.origin}/p/${product.slug}`);
      setSuccess("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-500">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 text-white bg-gray-600 rounded hover:bg-gray-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit Product</h1>
        {product && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePublishToggle}
              className={`px-4 py-2 rounded ${
                product.published
                  ? "bg-yellow-500 hover:bg-yellow-600"
                  : "bg-green-500 hover:bg-green-600"
              } text-white`}
            >
              {product.published ? "Unpublish" : "Publish"}
            </button>
            {product.published && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
              >
                Copy Link
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600">{error}</div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-600">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium mb-1">
            Slug
          </label>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="price" className="block text-sm font-medium mb-1">
            Price (in dollars)
          </label>
          <input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="previewContent" className="block text-sm font-medium mb-1">
            Preview Content (optional)
          </label>
          <textarea
            id="previewContent"
            value={previewContent}
            onChange={(e) => setPreviewContent(e.target.value)}
            rows={4}
            placeholder="Content shown to customers before purchase"
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="coverImage" className="block text-sm font-medium mb-1">
            Cover Image
          </label>
          <input
            id="coverImage"
            type="file"
            accept="image/*"
            onChange={handleCoverImageChange}
            className="w-full px-3 py-2 border rounded-md"
          />
          {coverImagePreview && (
            <img
              src={coverImagePreview}
              alt="Cover preview"
              className="mt-2 max-w-xs rounded border"
            />
          )}
        </div>

        <div>
          <label htmlFor="productFile" className="block text-sm font-medium mb-1">
            Product File
          </label>
          <input
            id="productFile"
            type="file"
            onChange={(e) => setProductFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border rounded-md"
          />
          {productFile && (
            <p className="mt-1 text-sm text-gray-500">Selected: {productFile.name}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {product?.published && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-700">
            This product is live at:{" "}
            <a
              href={`/p/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {window.location.origin}/p/{product.slug}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
