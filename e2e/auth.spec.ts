import { expect, test } from "@playwright/test";

test.describe("Authentication Pages", () => {
	test("sign in page renders form", async ({ page }) => {
		await page.goto("/sign-in");
		await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password")).toBeVisible();
		await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
	});

	test("sign up page renders form", async ({ page }) => {
		await page.goto("/sign-up");
		await expect(page.getByRole("heading", { name: "Sign Up" })).toBeVisible();
		await expect(page.getByLabel("Name")).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password")).toBeVisible();
		await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible();
	});

	test("sign in page has link to sign up", async ({ page }) => {
		await page.goto("/sign-in");
		const signUpLink = page.getByRole("link", { name: "Sign Up" });
		await expect(signUpLink).toBeVisible();
		await signUpLink.click();
		await expect(page).toHaveURL("/sign-up");
	});

	test("sign up page has link to sign in", async ({ page }) => {
		await page.goto("/sign-up");
		const signInLink = page.getByRole("link", { name: "Sign In" }).first();
		await expect(signInLink).toBeVisible();
		await signInLink.click();
		await expect(page).toHaveURL("/sign-in");
	});

	test("protected route /dashboard redirects to sign in", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page).toHaveURL("/sign-in");
	});

	test("protected route /dashboard/products/new redirects to sign in", async ({
		page,
	}) => {
		await page.goto("/dashboard/products/new");
		await expect(page).toHaveURL("/sign-in");
	});

	test("protected route /dashboard/settings redirects to sign in", async ({
		page,
	}) => {
		await page.goto("/dashboard/settings");
		await expect(page).toHaveURL("/sign-in");
	});
});
