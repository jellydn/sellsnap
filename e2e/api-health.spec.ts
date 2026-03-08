import { expect, test } from "@playwright/test";

test.describe("API Health", () => {
	test("health endpoint returns ok", async ({ request }) => {
		const response = await request.get("/api/health");
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(body.status).toBe("ok");
	});

	test("unauthenticated product list returns 401", async ({ request }) => {
		const response = await request.get("/api/products");
		expect(response.status()).toBe(401);
	});

	test("unauthenticated analytics returns 401", async ({ request }) => {
		const response = await request.get("/api/analytics");
		expect(response.status()).toBe(401);
	});

	test("unauthenticated profile returns 401", async ({ request }) => {
		const response = await request.get("/api/profile");
		expect(response.status()).toBe(401);
	});

	test("non-existent product slug returns 404", async ({ request }) => {
		const response = await request.get(
			"/api/products/by-slug/does-not-exist-at-all",
		);
		expect(response.status()).toBe(404);
	});

	test("non-existent creator slug returns 404", async ({ request }) => {
		const response = await request.get("/api/creators/does-not-exist-at-all");
		expect([404, 429]).toContain(response.status());
	});
});
