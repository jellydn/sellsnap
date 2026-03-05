import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../../test/test-utils";
import { SignUp } from "../SignUp";

const mockSignUpEmail = vi.fn();
vi.mock("../../lib/auth", () => ({
  authClient: {
    signUp: { email: (...args: unknown[]) => mockSignUpEmail(...args) },
    useSession: () => ({ data: null, isPending: false }),
  },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

describe("SignUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sign up form with name, email, password fields", () => {
    renderWithRouter(<SignUp />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeInTheDocument();
  });

  it('shows "Sign Up" heading', () => {
    renderWithRouter(<SignUp />);

    expect(screen.getByRole("heading", { name: "Sign Up" })).toBeInTheDocument();
  });

  it("has link to sign in page", () => {
    renderWithRouter(<SignUp />);

    const link = screen.getByRole("link", { name: "Sign In" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/sign-in");
  });

  it("submits form with name, email, password", async () => {
    mockSignUpEmail.mockResolvedValueOnce({});
    renderWithRouter(<SignUp />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(mockSignUpEmail).toHaveBeenCalledWith({
        email: "john@example.com",
        password: "password123",
        name: "John Doe",
      });
    });
  });

  it("shows error on failure", async () => {
    mockSignUpEmail.mockRejectedValueOnce(new Error("Email already exists"));
    renderWithRouter(<SignUp />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(screen.getByText("Email already exists")).toBeInTheDocument();
    });
  });
});
