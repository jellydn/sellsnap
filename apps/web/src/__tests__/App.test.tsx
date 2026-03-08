import { screen } from "@testing-library/react";
import App from "../App";
import { renderWithRouter } from "../test/test-utils";

describe("App - 404 catch-all route", () => {
  it("renders NotFound component for unknown routes", async () => {
    renderWithRouter(<App />, { route: "/unknown-route-12345" });

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("renders NotFound for deeply nested unknown routes", async () => {
    renderWithRouter(<App />, { route: "/some/deeply/nested/unknown/path" });

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("renders NotFound for unknown dashboard routes", async () => {
    renderWithRouter(<App />, { route: "/dashboard/unknown" });

    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it('displays "Go home" link that navigates to root', async () => {
    renderWithRouter(<App />, { route: "/unknown" });

    const homeLink = screen.getByRole("link", { name: "Go home" });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("renders home page for root route", async () => {
    renderWithRouter(<App />, { route: "/" });

    expect(screen.getByText("Welcome to SellSnap")).toBeInTheDocument();
    expect(screen.getByText(/Sell in a snap/)).toBeInTheDocument();
  });

  it("renders sign-up page for /sign-up route", async () => {
    renderWithRouter(<App />, { route: "/sign-up" });

    expect(screen.getByRole("heading", { name: /sign up/i })).toBeInTheDocument();
  });

  it("renders sign-in page for /sign-in route", async () => {
    renderWithRouter(<App />, { route: "/sign-in" });

    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });
});
