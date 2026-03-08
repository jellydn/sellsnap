import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/test-utils";
import { SignIn } from "../SignIn";

const mockSignInEmail = vi.fn();
vi.mock("../../lib/auth", () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => mockSignInEmail(...args) },
    useSession: () => ({ data: null, isPending: false }),
  },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

describe("SignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sign in form with email, password fields and submit button", () => {
    renderWithRouter(<SignIn />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it('shows "Sign In" heading', () => {
    renderWithRouter(<SignIn />);

    expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
  });

  it("has link to sign up page", () => {
    renderWithRouter(<SignIn />);

    const link = screen.getByRole("link", { name: "Sign Up" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/sign-up");
  });

  it("submits form and calls authClient.signIn.email with email and password", async () => {
    mockSignInEmail.mockResolvedValueOnce({});
    renderWithRouter(<SignIn />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockSignInEmail).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  it("shows error message when sign in fails", async () => {
    mockSignInEmail.mockRejectedValueOnce(new Error("Invalid credentials"));
    renderWithRouter(<SignIn />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it('disables button and shows "Signing in..." while loading', async () => {
    const noop = () => {};
    let resolveSignIn: (value: unknown) => void = noop;
    mockSignInEmail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    renderWithRouter(<SignIn />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      const button = screen.getByRole("button", { name: "Signing in..." });
      expect(button).toBeDisabled();
    });

    resolveSignIn({});
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled();
    });
  });
});
