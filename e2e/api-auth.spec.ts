import { expect, test } from "@playwright/test";
import {
	API_BASE,
	AUTH_BASE,
	generateTestUser,
	signInUser,
	signOutUser,
	signUpUser,
} from "./helpers";

test.describe("API Authentication", () => {
	test("sign up with valid credentials creates user and returns session", async ({
		request,
	}) => {
		const userData = generateTestUser();

		const response = await request.post(`${AUTH_BASE}/sign-up/email`, {
			headers: {
				"Content-Type": "application/json",
			},
			data: JSON.stringify(userData),
		});

		expect(response.ok()).toBeTruthy();
		expect(response.headers()["set-cookie"]).toBeDefined();

		const body = await response.json();
		expect(body).toHaveProperty("user");
		expect(body.user).toHaveProperty("id");
		expect(body.user).toHaveProperty("name", userData.name);
		expect(body.user).toHaveProperty("email", userData.email);
	});

	test("sign up with duplicate email returns error", async ({ request }) => {
		const userData = generateTestUser();

		// First sign up should succeed
		const firstResponse = await request.post(`${AUTH_BASE}/sign-up/email`, {
			headers: {
				"Content-Type": "application/json",
			},
			data: JSON.stringify(userData),
		});
		expect(firstResponse.ok()).toBeTruthy();

		// Second sign up with same email should fail
		const secondResponse = await request.post(`${AUTH_BASE}/sign-up/email`, {
			headers: {
				"Content-Type": "application/json",
			},
			data: JSON.stringify(userData),
		});
		expect(secondResponse.status()).toBe(422);

		const body = await secondResponse.json();
		expect(body).toHaveProperty("code");
	});

	test("sign in with valid credentials returns session", async ({
		request,
	}) => {
		// First sign up a user
		const userData = generateTestUser();
		await signUpUser(request, userData);

		// Then sign in with the same credentials
		const session = await signInUser(
			request,
			userData.email,
			userData.password,
		);

		expect(session.cookie).toContain("better-auth.session_token");
		expect(session.user.email).toBe(userData.email);
	});

	test("sign in with invalid credentials returns error", async ({
		request,
	}) => {
		const response = await request.post(`${AUTH_BASE}/sign-in/email`, {
			headers: {
				"Content-Type": "application/json",
			},
			data: JSON.stringify({
				email: "nonexistent@example.com",
				password: "wrong-password",
			}),
		});

		expect(response.status()).toBe(401);

		const body = await response.json();
		expect(body).toHaveProperty("code");
	});

	test("sign in with wrong password returns error", async ({ request }) => {
		// First sign up a user
		const userData = generateTestUser();
		await signUpUser(request, userData);

		// Then sign in with wrong password
		const response = await request.post(`${AUTH_BASE}/sign-in/email`, {
			headers: {
				"Content-Type": "application/json",
			},
			data: JSON.stringify({
				email: userData.email,
				password: "wrong-password",
			}),
		});

		expect(response.status()).toBe(401);

		const body = await response.json();
		expect(body).toHaveProperty("code");
	});

	test("sign out clears session", async ({ request }) => {
		// Sign up and sign in
		const session = await signUpUser(request);

		// Sign out
		await signOutUser(request, session);

		// Try to access protected endpoint - should fail
		const response = await request.get("/api/profile", {
			headers: {
				cookie: session.cookie,
			},
		});

		// Session should be cleared, so this should be unauthorized
		// Note: The actual behavior depends on how the server handles sign-out
		// It might return 401 or redirect, we'll check for 401
		expect([401, 302]).toContain(response.status());
	});

	test("get session returns current user when authenticated", async ({
		request,
	}) => {
		const session = await signUpUser(request);

		const response = await request.get(`${AUTH_BASE}/get-session`, {
			headers: {
				cookie: session.cookie,
			},
		});

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body).toHaveProperty("user");
		expect(body.user).toHaveProperty("id", session.user.id);
		expect(body.user).toHaveProperty("email", session.user.email);
	});

	test("get session returns null when not authenticated", async ({
		request,
	}) => {
		const response = await request.get(`${AUTH_BASE}/get-session`);

		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body).toBeDefined();
		if (body) {
			expect(body.user).toBeNull();
		}
	});
});
