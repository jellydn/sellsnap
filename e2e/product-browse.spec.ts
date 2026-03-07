import { expect, test } from "@playwright/test";

test.describe("Product Browse (Public)", () => {
	test("product page shows 404 for non-existent slug", async ({ page }) => {
		const response = await page.goto("/p/non-existent-product-slug-12345");
		expect(response?.status()).toBe(200);
		await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible(
			{ timeout: 10_000 },
		);
	});

	test("creator profile shows 404 for non-existent creator", async ({
		page,
	}) => {
		await page.goto("/creator/non-existent-creator-slug");
		await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible(
			{ timeout: 10_000 },
		);
	});

	test("purchase success page without session_id shows error", async ({
		page,
	}) => {
		await page.goto("/purchase/success");
		await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible(
			{ timeout: 10_000 },
		);
	});

	test("purchase success page with invalid session_id shows error", async ({
		page,
	}) => {
		await page.goto("/purchase/success?session_id=invalid-session");
		await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 10_000 });
	});
});
