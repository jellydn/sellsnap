import { screen } from "@testing-library/react";
import { renderWithRouter } from "../../test/test-utils";
import { AppLayout } from "../AppLayout";

const mockUseSession = vi.fn();
vi.mock("../../lib/auth", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSession(...args),
    signOut: vi.fn(),
  },
}));

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "SellSnap" brand link', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    renderWithRouter(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );

    const link = screen.getByRole("link", { name: "SellSnap" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it('shows "Sign In" link when no session', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    renderWithRouter(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );

    expect(screen.getByRole("link", { name: "Sign In" })).toBeInTheDocument();
  });

  it('shows user name and "Sign Out" button when session exists', () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "John Doe" } },
      isPending: false,
    });

    renderWithRouter(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
  });

  it('shows "Loading..." when session is pending', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true });

    renderWithRouter(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
