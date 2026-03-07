import { expect, test } from "@playwright/test";
import {
	cleanupTestProducts,
	createTestProduct,
	deleteTestProduct,
	signUpUser,
} from "./helpers";

test.describe("API Products", () => {
	test("requires authentication to get products", async ({ request }) => {
		const response = await request.get("/api/products");
		expect(response.status()).toBe(401);
	});

	test("gets empty products list for new user", async ({ request }) => {
		const session = await signUpUser(request);

		const response = await request.get("/api/products", {
			headers: {
				cookie: session.cookie,
			},
		});

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body).toHaveProperty("items");
		expect(Array.isArray(body.items)).toBeTruthy();
		expect(body.items).toHaveLength(0);
		expect(body).toHaveProperty("nextCursor", null);
		expect(body).toHaveProperty("hasMore", false);
	});

	test("creates product with valid data", async ({ request }) => {
		const session = await signUpUser(request);
		const timestamp = Date.now();

		const response = await request.post("/api/products", {
			headers: {
				cookie: session.cookie,
			},
			multipart: {
				title: `Test Product ${timestamp}`,
				description: "Test description",
				price: "999",
				previewContent: "Test preview",
				productFile: {
					name: "test-file.txt",
					mimeType: "text/plain",
					buffer: Buffer.from("test file content"),
				} as any,
			},
		});

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body).toHaveProperty("id");
		expect(body).toHaveProperty("title", `Test Product ${timestamp}`);
		expect(body).toHaveProperty("slug");
		expect(body).toHaveProperty("description", "Test description");
		expect(body).toHaveProperty("price", 99900);
		expect(body).toHaveProperty("published", false);

		// Cleanup
		await deleteTestProduct(request, session, body.id);
	});

	test("creates product and returns it in products list", async ({
		request,
	}) => {
		const session = await signUpUser(request);
		const product = await createTestProduct(request, session, {
			title: "List Test Product",
		});

		const response = await request.get("/api/products", {
			headers: {
				cookie: session.cookie,
			},
		});

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body.items).toHaveLength(1);
		expect(body.items[0]).toHaveProperty("id", product.id);
		expect(body.items[0]).toHaveProperty("title", "List Test Product");

		// Cleanup
		await deleteTestProduct(request, session, product.id);
	});

	test("gets single product by id", async ({ request }) => {
		const session = await signUpUser(request);
		const product = await createTestProduct(request, session);

		const response = await request.get(`/api/products/${product.id}`, {
			headers: {
				cookie: session.cookie,
			},
		});

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body).toHaveProperty("id", product.id);
		expect(body).toHaveProperty("title", product.title);

		// Cleanup
		await deleteTestProduct(request, session, product.id);
	});

	test("returns 404 for non-existent product", async ({ request }) => {
		const session = await signUpUser(request);

		const response = await request.get(`/api/products/non-existent-id`, {
			headers: {
				cookie: session.cookie,
			},
		});

		expect(response.status()).toBe(404);
	});

	test("forbids accessing another user's product", async ({ request }) => {
		const user1 = await signUpUser(request);
		const product = await createTestProduct(request, user1);

		const user2 = await signUpUser(request);

		const response = await request.get(`/api/products/${product.id}`, {
			headers: {
				cookie: user2.cookie,
			},
		});

		expect(response.status()).toBe(403);

		// Cleanup
		await deleteTestProduct(request, user1, product.id);
	});

	test("updates product", async ({ request }) => {
		const session = await signUpUser(request);
		const product = await createTestProduct(request, session);

		const updatedResponse = await request.put(`/api/products/${product.id}`, {
			headers: {
				cookie: session.cookie,
			},
			multipart: {
				title: "Updated Title",
			},
		});

		expect(updatedResponse.ok()).toBeTruthy();

		// Cleanup
		await deleteTestProduct(request, session, product.id);
	});

	test("toggles product publish status", async ({ request }) => {
		const session = await signUpUser(request);
		const product = await createTestProduct(request, session);

		expect(product.published).toBe(false);

		const publishResponse = await request.patch(
			`/api/products/${product.id}/publish`,
			{
				headers: {
					cookie: session.cookie,
				},
			},
		);

		expect(publishResponse.ok()).toBeTruthy();

		const body = await publishResponse.json();
		expect(body).toHaveProperty("published", true);

		// Cleanup
		await deleteTestProduct(request, session, product.id);
	});

	test("deletes product", async ({ request }) => {
		const session = await signUpUser(request);
		const product = await createTestProduct(request, session);

		const deleteResponse = await request.delete(`/api/products/${product.id}`, {
			headers: {
				cookie: session.cookie,
			},
		});

		expect(deleteResponse.status()).toBe(204);

		// Verify product is deleted
		const getResponse = await request.get(`/api/products/${product.id}`, {
			headers: {
				cookie: session.cookie,
			},
		});

		expect(getResponse.status()).toBe(404);
	});

	test("paginates products with limit", async ({ request }) => {
		const session = await signUpUser(request);
		const productIds: string[] = [];

		// Create 15 products
		for (let i = 0; i < 15; i++) {
			const product = await createTestProduct(request, session, {
				title: `Product ${i}`,
			});
			productIds.push(product.id);
		}

		// Get first page with limit 10
		const response = await request.get("/api/products?limit=10", {
			headers: {
				cookie: session.cookie,
			},
		});

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body.items).toHaveLength(10);
		expect(body.hasMore).toBe(true);
		expect(body.nextCursor).toBeTruthy();

		// Get second page using cursor
		const secondPageResponse = await request.get(
			`/api/products?limit=10&cursor=${body.nextCursor}`,
			{
				headers: {
					cookie: session.cookie,
				},
			},
		);

		expect(secondPageResponse.ok()).toBeTruthy();

		const secondPage = await secondPageResponse.json();
		expect(secondPage.items).toHaveLength(5);
		expect(secondPage.hasMore).toBe(false);
		expect(secondPage.nextCursor).toBeNull();

		// Cleanup
		await cleanupTestProducts(request, session, productIds);
	});

	test("returns 400 for missing required fields when creating product", async ({
		request,
	}) => {
		const session = await signUpUser(request);

		const response = await request.post("/api/products", {
			headers: {
				cookie: session.cookie,
			},
			multipart: {},
		});

		expect(response.status()).toBe(400);

		const body = await response.json();
		expect(body).toHaveProperty("error");
		expect(body.error).toContain("Missing required fields");
	});

	test("returns 400 for invalid price", async ({ request }) => {
		const session = await signUpUser(request);

		const response = await request.post("/api/products", {
			headers: {
				cookie: session.cookie,
			},
			multipart: {
				title: "Test Product",
				description: "Test description",
				price: "invalid",
				previewContent: "Test preview",
				productFile: {
					name: "test-file.txt",
					mimeType: "text/plain",
					buffer: Buffer.from("test file content"),
				} as any,
			},
		});

		expect(response.status()).toBe(400);

		const body = await response.json();
		expect(body).toHaveProperty("error");
	});
});
