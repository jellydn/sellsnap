import { expect, test } from "@playwright/test";

test.describe("Navigation & Public Pages", () => {
  test("home page loads with welcome message", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome to SellSnap" })).toBeVisible();
    await expect(page.getByText("Sell in a snap")).toBeVisible();
  });

  test("header has SellSnap brand link and sign in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "SellSnap" })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("sign in link navigates to sign in page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  });

  test("404 page shown for unknown routes", async ({ page }) => {
    await page.goto("/this-does-not-exist");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("Page not found")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go home" })).toBeVisible();
  });

  test("404 page go home link works", async ({ page }) => {
    await page.goto("/this-does-not-exist");
    await page.getByRole("link", { name: "Go home" }).click();
    await expect(page).toHaveURL("/");
  });
});
