import { expect, test } from "@playwright/test";
import { signUpUser, createTestProduct, deleteTestProduct } from "./helpers";

test.describe("API Analytics", () => {
  test("requires authentication to get analytics", async ({ request }) => {
    const response = await request.get("/api/analytics");
    expect(response.status()).toBe(401);
  });

  test("returns analytics data for authenticated user", async ({ request }) => {
    const session = await signUpUser(request);

    const response = await request.get("/api/analytics", {
      headers: {
        cookie: session.cookie,
      },
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty("products");
    expect(Array.isArray(body.products)).toBeTruthy();
    expect(body).toHaveProperty("totals");
    expect(body.totals).toHaveProperty("totalViews", 0);
    expect(body.totals).toHaveProperty("totalPurchases", 0);
    expect(body.totals).toHaveProperty("totalRevenue", 0);
  });

  test("includes products in analytics", async ({ request }) => {
    const session = await signUpUser(request);
    const product = await createTestProduct(request, session, {
      title: "Analytics Test Product",
    });

    const response = await request.get("/api/analytics", {
      headers: {
        cookie: session.cookie,
      },
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.products).toHaveLength(1);
    expect(body.products[0]).toHaveProperty("id", product.id);
    expect(body.products[0]).toHaveProperty("title", "Analytics Test Product");
    expect(body.products[0]).toHaveProperty("viewCount", 0);
    expect(body.products[0]).toHaveProperty("purchaseCount", 0);

    // Cleanup
    await deleteTestProduct(request, session, product.id);
  });

  test("aggregates totals across all products", async ({ request }) => {
    const session = await signUpUser(request);
    const productIds: string[] = [];

    // Create multiple products
    for (let i = 0; i < 3; i++) {
      const product = await createTestProduct(request, session);
      productIds.push(product.id);
    }

    const response = await request.get("/api/analytics", {
      headers: {
        cookie: session.cookie,
      },
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.products).toHaveLength(3);
    expect(body.totals.totalViews).toBe(0);
    expect(body.totals.totalPurchases).toBe(0);
    expect(body.totals.totalRevenue).toBe(0);

    // Cleanup
    for (const id of productIds) {
      await deleteTestProduct(request, session, id);
    }
  });

  test("returns empty arrays for new users", async ({ request }) => {
    const session = await signUpUser(request);

    const response = await request.get("/api/analytics", {
      headers: {
        cookie: session.cookie,
      },
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.products).toEqual([]);
    expect(body.totals).toEqual({
      totalViews: 0,
      totalPurchases: 0,
      totalRevenue: 0,
    });
  });

  test("respects session cookie for multi-user isolation", async ({ request }) => {
    const user1 = await signUpUser(request);
    const user2 = await signUpUser(request);

    // Create product for user1
    const product1 = await createTestProduct(request, user1);

    // User1's analytics should include their product
    const response1 = await request.get("/api/analytics", {
      headers: {
        cookie: user1.cookie,
      },
    });

    expect(response1.ok()).toBeTruthy();
    const body1 = await response1.json();
    expect(body1.products).toHaveLength(1);
    expect(body1.products[0].id).toBe(product1.id);

    // User2's analytics should be empty
    const response2 = await request.get("/api/analytics", {
      headers: {
        cookie: user2.cookie,
      },
    });

    expect(response2.ok()).toBeTruthy();
    const body2 = await response2.json();
    expect(body2.products).toHaveLength(0);

    // Cleanup
    await deleteTestProduct(request, user1, product1.id);
  });
});
