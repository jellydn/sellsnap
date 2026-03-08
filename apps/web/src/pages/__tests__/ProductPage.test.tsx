import { screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/test-utils";
import { ProductPage } from "../ProductPage";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useParams: () => ({ slug: "test-product" }) };
});

const mockProduct = {
  id: "1",
  title: "Test Product",
  slug: "test-product",
  description: "A great product",
  price: 999,
  coverImageUrl: null,
  previewContent: null,
  viewCount: 42,
  createdAt: "2025-01-01",
  creator: {
    id: "u1",
    name: "Creator Name",
    slug: "creator-name",
    avatarUrl: null,
  },
};

describe("ProductPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("shows loading state", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}) as Promise<Response>);

    renderWithRouter(<ProductPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders product details after fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProduct),
    } as Response);

    renderWithRouter(<ProductPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Product")).toBeInTheDocument();
    });

    expect(screen.getByText("A great product")).toBeInTheDocument();
    expect(screen.getByText("by Creator Name")).toBeInTheDocument();
  });

  it("shows product not found on error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Product not found" }),
    } as Response);

    renderWithRouter(<ProductPage />);

    await waitFor(() => {
      expect(screen.getByText("Product Not Found")).toBeInTheDocument();
    });
  });

  it("displays price formatted correctly (999 cents → $9.99)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProduct),
    } as Response);

    renderWithRouter(<ProductPage />);

    await waitFor(() => {
      expect(screen.getByText("$9.99")).toBeInTheDocument();
    });
  });

  it("shows buy button with price", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProduct),
    } as Response);

    renderWithRouter(<ProductPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Buy Now — $9.99" })).toBeInTheDocument();
    });
  });
});
