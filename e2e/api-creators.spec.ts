import type { APIResponse } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
	createTestProduct,
	deleteTestProduct,
	signUpUser,
	updateProfileSlug,
} from "./helpers";

test.describe("API Creators", () => {
	test("returns 404 for non-existent creator", async ({ request }) => {
		const response = await request.get(
			"/api/creators/non-existent-creator-slug",
		);
		expect(response.status()).toBe(404);
	});

	test("returns creator profile with published products", async ({
		request,
	}) => {
		const session = await signUpUser(request);

		// Set a unique slug for the user
		const creatorSlug = `test-creator-${Date.now()}`;
		await updateProfileSlug(request, session, creatorSlug);

		// Create a published product
		const product = await createTestProduct(request, session);

		// Publish the product
		await request.patch(`/api/products/${product.id}/publish`, {
			headers: {
				cookie: session.cookie,
			},
		});

		// Get creator page
		const response = await request.get(`/api/creators/${creatorSlug}`);

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body).toHaveProperty("id");
		expect(body).toHaveProperty("name");
		expect(body).toHaveProperty("slug", creatorSlug);
		expect(body).toHaveProperty("products");
		expect(body.products).toHaveProperty("items");
		expect(Array.isArray(body.products.items)).toBeTruthy();
		expect(body.products.items).toHaveLength(1);
		expect(body.products.items[0]).toHaveProperty("id", product.id);
		expect(body.products.items[0]).toHaveProperty("title", product.title);

		// Cleanup
		await deleteTestProduct(request, session, product.id);
	});

	test("does not return unpublished products", async ({ request }) => {
		const session = await signUpUser(request);

		// Set a unique slug for the user
		const creatorSlug = `test-creator-${Date.now()}`;
		await updateProfileSlug(request, session, creatorSlug);

		// Create an unpublished product (default state)
		const product = await createTestProduct(request, session);

		// Get creator page
		const response = await request.get(`/api/creators/${creatorSlug}`);

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body.products.items).toHaveLength(0);

		// Cleanup
		await deleteTestProduct(request, session, product.id);
	});

	test("paginates creator products", async ({ request }) => {
		const session = await signUpUser(request);

		// Set a unique slug for the user
		const creatorSlug = `test-creator-${Date.now()}`;
		await updateProfileSlug(request, session, creatorSlug);

		const productIds: string[] = [];

		// Create 15 published products
		for (let i = 0; i < 15; i++) {
			const product = await createTestProduct(request, session, {
				title: `Product ${i}`,
			});
			productIds.push(product.id);

			// Publish the product
			await request.patch(`/api/products/${product.id}/publish`, {
				headers: {
					cookie: session.cookie,
				},
			});
		}

		// Get first page with limit 10
		const response = await request.get(`/api/creators/${creatorSlug}?limit=10`);

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body.products.items).toHaveLength(10);
		expect(body.products.hasMore).toBe(true);
		expect(body.products.nextCursor).toBeTruthy();

		// Get second page using cursor
		const secondPageResponse = await request.get(
			`/api/creators/${creatorSlug}?limit=10&cursor=${body.products.nextCursor}`,
		);

		expect(secondPageResponse.ok()).toBeTruthy();

		const secondPage = await secondPageResponse.json();
		expect(secondPage.products.items).toHaveLength(5);
		expect(secondPage.products.hasMore).toBe(false);
		expect(secondPage.products.nextCursor).toBeNull();

		// Cleanup
		for (const id of productIds) {
			await deleteTestProduct(request, session, id);
		}
	});

	test("returns creator with avatar URL", async ({ request }) => {
		const session = await signUpUser(request);

		// Set a unique slug for the user
		const creatorSlug = `test-creator-${Date.now()}`;
		await updateProfileSlug(request, session, creatorSlug);

		// Get creator page
		const response = await request.get(`/api/creators/${creatorSlug}`);

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body).toHaveProperty("avatarUrl");
		// New users might not have an avatar, so we just check the property exists
	});

	test("respects rate limiting", async ({ request }) => {
		const session = await signUpUser(request);

		// Set a unique slug for the user
		const creatorSlug = `test-creator-${Date.now()}`;
		await updateProfileSlug(request, session, creatorSlug);

		// Make exactly 65 requests to trigger rate limiting (limit is 60/min)
		const responses: APIResponse[] = [];
		for (let i = 0; i < 65; i++) {
			const response = await request.get(`/api/creators/${creatorSlug}`);
			responses.push(response);
		}

		// Most requests should succeed
		const successCount = responses.filter((r) => r.ok()).length;
		expect(successCount).toBeGreaterThanOrEqual(50);

		// Some requests should be rate limited (429)
		const rateLimitedCount = responses.filter((r) => r.status() === 429).length;
		expect(rateLimitedCount).toBeGreaterThan(0);

		// Total should equal 65
		expect(successCount + rateLimitedCount).toBe(65);
	});
});
