import { screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/test-utils";
import { Dashboard } from "../Dashboard";

vi.mock("../../lib/api", () => ({
  fetchProducts: vi.fn(),
  fetchAnalytics: vi.fn(),
}));

import { fetchAnalytics, fetchProducts } from "../../lib/api";

const mockFetchProducts = fetchProducts as ReturnType<typeof vi.fn>;
const mockFetchAnalytics = fetchAnalytics as ReturnType<typeof vi.fn>;

const mockProducts = [
  {
    id: "1",
    title: "Test Product",
    slug: "test-product",
    description: "A test",
    price: 999,
    coverImageUrl: null,
    previewContent: null,
    published: true,
    viewCount: 42,
    purchaseCount: 5,
    createdAt: "2025-01-01",
  },
];

const mockAnalytics = {
  products: [{ id: "1", title: "Test Product", viewCount: 42, purchaseCount: 5, revenue: 4995 }],
  totals: { totalViews: 42, totalPurchases: 5, totalRevenue: 4995 },
};

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockFetchProducts.mockReturnValue(new Promise(() => {}));
    mockFetchAnalytics.mockReturnValue(new Promise(() => {}));

    renderWithRouter(<Dashboard />);

    expect(screen.getByText("Loading products...")).toBeInTheDocument();
  });

  it("renders products and analytics after fetch", async () => {
    mockFetchProducts.mockResolvedValueOnce(mockProducts);
    mockFetchAnalytics.mockResolvedValueOnce(mockAnalytics);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByText("Test Product")).toHaveLength(2);
    });

    expect(screen.getAllByText("$49.95")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();
  });

  it("shows empty state when no products", async () => {
    mockFetchProducts.mockResolvedValueOnce([]);
    mockFetchAnalytics.mockResolvedValueOnce({
      products: [],
      totals: { totalViews: 0, totalPurchases: 0, totalRevenue: 0 },
    });

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("You haven't created any products yet.")).toBeInTheDocument();
    });

    expect(screen.getByText("Create your first product")).toBeInTheDocument();
  });

  it("shows error message on fetch failure", async () => {
    mockFetchProducts.mockRejectedValueOnce(new Error("Network error"));
    mockFetchAnalytics.mockRejectedValueOnce(new Error("Network error"));

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Error: Network error")).toBeInTheDocument();
    });
  });

  it('shows "Create Product" link', async () => {
    mockFetchProducts.mockResolvedValueOnce(mockProducts);
    mockFetchAnalytics.mockResolvedValueOnce(mockAnalytics);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByText("Test Product")).toHaveLength(2);
    });

    const link = screen.getByRole("link", { name: "Create Product" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/dashboard/products/new");
  });
});
