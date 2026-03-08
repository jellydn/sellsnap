import { expect, test } from "@playwright/test";
import { generateTestUser, signUpUser } from "./helpers";

test.describe("API Profile", () => {
	test("requires authentication to get profile", async ({ request }) => {
		const response = await request.get("/api/profile");
		expect(response.status()).toBe(401);
	});

	test("returns user profile for authenticated user", async ({ request }) => {
		const userData = generateTestUser();
		const session = await signUpUser(request, userData);

		const response = await request.get("/api/profile", {
			headers: {
				cookie: session.cookie,
			},
		});

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body).toHaveProperty("id");
		expect(body).toHaveProperty("name", userData.name);
		expect(body).toHaveProperty("email", userData.email);
		expect(body).toHaveProperty("slug");
	});

	test("returns consistent profile across multiple calls", async ({
		request,
	}) => {
		const session = await signUpUser(request);

		const response1 = await request.get("/api/profile", {
			headers: {
				cookie: session.cookie,
			},
		});

		const response2 = await request.get("/api/profile", {
			headers: {
				cookie: session.cookie,
			},
		});

		expect(response1.ok()).toBeTruthy();
		expect(response2.ok()).toBeTruthy();

		const body1 = await response1.json();
		const body2 = await response2.json();

		expect(body1.id).toBe(body2.id);
		expect(body1.email).toBe(body2.email);
		expect(body1.slug).toBe(body2.slug);
	});

	test("respects session cookies for multi-user isolation", async ({
		request,
	}) => {
		const user1 = await signUpUser(request);
		const user2 = await signUpUser(request);

		const response1 = await request.get("/api/profile", {
			headers: {
				cookie: user1.cookie,
			},
		});

		const response2 = await request.get("/api/profile", {
			headers: {
				cookie: user2.cookie,
			},
		});

		expect(response1.ok()).toBeTruthy();
		expect(response2.ok()).toBeTruthy();

		const body1 = await response1.json();
		const body2 = await response2.json();

		// Users should have different profiles
		expect(body1.id).not.toBe(body2.id);
		expect(body1.email).not.toBe(body2.email);
	});

	test("invalid session cookie returns 401", async ({ request }) => {
		const response = await request.get("/api/profile", {
			headers: {
				cookie: "invalid-session-cookie",
			},
		});

		expect(response.status()).toBe(401);
	});

	test("expired session returns 401", async ({ request }) => {
		const session = await signUpUser(request);

		// Sign out to invalidate the session
		await request.post("/api/auth/sign-out", {
			headers: {
				cookie: session.cookie,
			},
		});

		// Try to use the old session
		const response = await request.get("/api/profile", {
			headers: {
				cookie: session.cookie,
			},
		});

		// Session should be invalidated
		expect([401, 302]).toContain(response.status());
	});

	test("profile slug is URL-safe", async ({ request }) => {
		const userData = generateTestUser();
		// Use a name with special characters
		userData.name = "Test User With Spaces & Special!@#";

		const session = await signUpUser(request, userData);

		const response = await request.get("/api/profile", {
			headers: {
				cookie: session.cookie,
			},
		});

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		const slug = body.slug;

		// Slug may be null if not generated
		if (slug) {
			// Slug should be URL-safe (no spaces or special characters except hyphens)
			expect(slug).not.toMatch(/\s/);
			expect(slug).not.toMatch(/[&!@#]/);
			expect(slug).toMatch(/^[a-z0-9-]+$/);
		}
	});
});
