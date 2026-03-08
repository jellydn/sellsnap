/**
 * E2E Test Helpers
 *
 * Reusable utilities for API testing with authentication and test data management.
 */

import type { APIRequestContext } from "@playwright/test";

// Note: baseURL will be provided by Playwright's request context
// We use relative paths which will resolve to the correct server
export const API_BASE = "/api";
export const AUTH_BASE = "/api/auth";
export const TEST_ORIGIN = "http://localhost:5173";

export interface TestUser {
	name: string;
	email: string;
	password: string;
}

export interface AuthSession {
	cookie: string;
	user: {
		id: string;
		name: string;
		email: string;
	};
}

/**
 * Generate a unique test email address
 */
export function generateTestEmail(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	return `test-e2e-${timestamp}-${random}@example.com`;
}

/**
 * Generate test user data
 */
export function generateTestUser(): TestUser {
	return {
		name: `E2E Test User ${Date.now()}`,
		email: generateTestEmail(),
		password: "TestPassword123!",
	};
}

/**
 * Sign up a new user and return the session
 */
export async function signUpUser(
	request: APIRequestContext,
	userData?: TestUser,
): Promise<AuthSession> {
	const user = userData ?? generateTestUser();

	const response = await request.post(`${AUTH_BASE}/sign-up/email`, {
		headers: {
			"Content-Type": "application/json",
			Origin: TEST_ORIGIN,
		},
		data: JSON.stringify({
			name: user.name,
			email: user.email,
			password: user.password,
		}),
	});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(`Sign up failed: ${response.status()} ${body}`);
	}

	const sessionCookie = response.headers()["set-cookie"];
	if (!sessionCookie) {
		throw new Error("No session cookie returned from sign up");
	}

	const body = await response.json();

	return {
		cookie: sessionCookie.split(";")[0],
		user: {
			id: body.user.id,
			name: body.user.name,
			email: body.user.email,
		},
	};
}

/**
 * Sign in an existing user and return the session
 */
export async function signInUser(
	request: APIRequestContext,
	email: string,
	password: string,
): Promise<AuthSession> {
	const response = await request.post(`${AUTH_BASE}/sign-in/email`, {
		headers: {
			"Content-Type": "application/json",
			Origin: TEST_ORIGIN,
		},
		data: JSON.stringify({ email, password }),
	});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(`Sign in failed: ${response.status()} ${body}`);
	}

	const sessionCookie = response.headers()["set-cookie"];
	if (!sessionCookie) {
		throw new Error("No session cookie returned from sign in");
	}

	const body = await response.json();

	return {
		cookie: sessionCookie.split(";")[0],
		user: {
			id: body.user.id,
			name: body.user.name,
			email: body.user.email,
		},
	};
}

/**
 * Sign out the current user
 */
export async function signOutUser(
	request: APIRequestContext,
	session: AuthSession,
): Promise<void> {
	await request.post(`${AUTH_BASE}/sign-out`, {
		headers: {
			cookie: session.cookie,
			Origin: TEST_ORIGIN,
		},
	});
}

/**
 * Create a test product with file upload
 */
export async function createTestProduct(
	request: APIRequestContext,
	session: AuthSession,
	productData?: {
		title?: string;
		description?: string;
		price?: number;
	},
): Promise<{
	id: string;
	title: string;
	slug: string;
	description: string;
	price: number;
	published: boolean;
}> {
	const timestamp = Date.now();
	const title = productData?.title ?? `E2E Test Product ${timestamp}`;
	const description = productData?.description ?? "Test product description";
	const price = String(productData?.price ?? 999); // $9.99
	const previewContent = "Test preview content";

	const response = await request.post(`${API_BASE}/products`, {
		headers: {
			cookie: session.cookie,
			Origin: TEST_ORIGIN,
		},
		multipart: {
			title,
			description,
			price,
			previewContent,
			productFile: {
				name: "test-file.txt",
				mimeType: "text/plain",
				buffer: Buffer.from("test file content for e2e testing"),
			} as any,
		},
	});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(`Create product failed: ${response.status()} ${body}`);
	}

	return response.json();
}

/**
 * Delete a test product
 */
export async function deleteTestProduct(
	request: APIRequestContext,
	session: AuthSession,
	productId: string,
): Promise<void> {
	await request.delete(`${API_BASE}/products/${productId}`, {
		headers: {
			cookie: session.cookie,
		},
	});
}

/**
 * Clean up test data by deleting all products created during tests
 * This is best effort - if deletion fails, we log but don't fail the test
 */
export async function cleanupTestProducts(
	request: APIRequestContext,
	session: AuthSession,
	productIds: string[],
): Promise<void> {
	for (const id of productIds) {
		try {
			await deleteTestProduct(request, session, id);
		} catch (error) {
			console.warn(`Failed to cleanup product ${id}:`, error);
		}
	}
}

/**
 * Update user profile to set a slug
 */
export async function updateProfileSlug(
	request: APIRequestContext,
	session: AuthSession,
	slug: string,
): Promise<void> {
	const response = await request.put(`${API_BASE}/profile`, {
		headers: {
			cookie: session.cookie,
			Origin: TEST_ORIGIN,
		},
		multipart: {
			slug,
		},
	});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(`Update profile slug failed: ${response.status()} ${body}`);
	}
}
