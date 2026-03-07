import { act, screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/test-utils";
import { CreatorProfile } from "../CreatorProfile";

const mockCreator = {
  id: "creator-1",
  name: "Jane Doe",
  slug: "jane-doe",
  avatarUrl: "https://example.com/avatar.jpg",
  products: {
    items: [
      {
        id: "p1",
        title: "Test Product",
        slug: "test-product",
        price: 999,
        coverImageUrl: "https://example.com/cover.jpg",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ],
    nextCursor: null,
    hasMore: false,
  },
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it("shows loading state initially", async () => {
  globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

  await act(async () => {
    renderWithRouter(<CreatorProfile />, { route: "/creators/jane-doe" });
  });

  expect(screen.getByText("Loading...")).toBeInTheDocument();
});

it("renders creator profile with avatar and products", async () => {
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockCreator),
    } as Response),
  );

  await act(async () => {
    renderWithRouter(<CreatorProfile />, { route: "/creators/jane-doe" });
  });

  await waitFor(() => {
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("@jane-doe")).toBeInTheDocument();
  });

  const avatar = screen.getByAltText("Jane Doe");
  expect(avatar).toBeInTheDocument();
  expect(avatar).toHaveAttribute("src", "https://example.com/avatar.jpg");

  expect(screen.getByText("Test Product")).toBeInTheDocument();
  expect(screen.getByText("$9.99")).toBeInTheDocument();
});

it("renders creator without avatar - shows initial", async () => {
  const creatorWithoutAvatar = {
    ...mockCreator,
    avatarUrl: null,
  };

  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(creatorWithoutAvatar),
    } as Response),
  );

  await act(async () => {
    renderWithRouter(<CreatorProfile />, { route: "/creators/jane-doe" });
  });

  await waitFor(() => {
    expect(screen.getByText("J")).toBeInTheDocument();
  });
});

it("shows empty state when creator has no products", async () => {
  const creatorWithNoProducts = {
    ...mockCreator,
    products: {
      items: [],
      nextCursor: null,
      hasMore: false,
    },
  };

  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(creatorWithNoProducts),
    } as Response),
  );

  await act(async () => {
    renderWithRouter(<CreatorProfile />, { route: "/creators/jane-doe" });
  });

  await waitFor(() => {
    expect(screen.getByText("No products yet.")).toBeInTheDocument();
  });
});

it("shows error state when creator is not found", async () => {
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Creator not found" }),
    } as Response),
  );

  await act(async () => {
    renderWithRouter(<CreatorProfile />, { route: "/creators/nonexistent" });
  });

  await waitFor(() => {
    expect(screen.getByText("Creator Not Found")).toBeInTheDocument();
  });
});

it("shows error message on network failure", async () => {
  globalThis.fetch = vi.fn().mockImplementation(() => Promise.reject(new Error("Network error")));

  await act(async () => {
    renderWithRouter(<CreatorProfile />, { route: "/creators/jane-doe" });
  });

  await waitFor(() => {
    expect(screen.getByText("Creator Not Found")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });
});

it("links products to correct pages", async () => {
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockCreator),
    } as Response),
  );

  await act(async () => {
    renderWithRouter(<CreatorProfile />, { route: "/creators/jane-doe" });
  });

  await waitFor(() => {
    const productLink = screen.getByRole("link", { name: /Test Product/i });
    expect(productLink).toHaveAttribute("href", "/p/test-product");
  });
});

it("renders products without cover image", async () => {
  const creatorWithProductNoImage = {
    ...mockCreator,
    products: {
      items: [
        {
          id: "p1",
          title: "Test Product",
          slug: "test-product",
          price: 999,
          coverImageUrl: null,
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      nextCursor: null,
      hasMore: false,
    },
  };

  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(creatorWithProductNoImage),
    } as Response),
  );

  await act(async () => {
    renderWithRouter(<CreatorProfile />, { route: "/creators/jane-doe" });
  });

  await waitFor(() => {
    expect(screen.getByText("Test Product")).toBeInTheDocument();
    expect(screen.getByText("$9.99")).toBeInTheDocument();
  });
});

it("does not fetch when slug is undefined", async () => {
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockCreator),
    } as Response),
  );

  await act(async () => {
    renderWithRouter(<CreatorProfile />, { route: "/" });
  });

  await waitFor(() => {
    expect(screen.getByText("Creator Not Found")).toBeInTheDocument();
  });
});
