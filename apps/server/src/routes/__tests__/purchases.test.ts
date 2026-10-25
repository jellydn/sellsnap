import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import rateLimit from "@fastify/rate-limit";
import type { Prisma } from "@prisma/client";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("../../lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: vi.fn() } },
}));

vi.mock("../../lib/auth", () => ({
  getSessionFromRequest: async (request: FastifyRequest) => {
    const id = request.headers["x-test-user"];
    return id ? { user: { id } } : null;
  },
}));

vi.mock("../../lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL }) };
});

import { sendEmail } from "../../lib/email";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { purchaseRoutes } from "../purchases";
import { webhookRoutes } from "../webhooks";

// Run against a migrated, disposable PostgreSQL database, not the application's database.
describe.skipIf(!process.env.TEST_DATABASE_URL)("download token security", () => {
  let server: FastifyInstance;
  let directory: string;
  let productId: string;
  const creatorId = randomUUID();
  let logs = "";

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "sellsnap-download-"));
    const filePath = join(directory, "product.txt");
    await writeFile(filePath, "Purchased file contents");
    await prisma.user.create({
      data: { id: creatorId, name: "Seller", email: `${creatorId}@example.test` },
    });
    const product = await prisma.product.create({
      data: {
        title: "Purchased product",
        slug: randomUUID(),
        description: "Test product",
        price: 500,
        filePath,
        creatorId,
      },
    });
    productId = product.id;
  });

  beforeEach(async () => {
    await server?.close();
    logs = "";
    server = Fastify({
      logger: {
        stream: {
          write: (line: string) => {
            logs += line;
          },
        },
      },
    });
    await server.register(rateLimit, { max: 100, timeWindow: "1 minute" });
    await server.register(purchaseRoutes);
    await server.register(webhookRoutes);
    await server.ready();
  });

  afterAll(async () => {
    await server?.close();
    await prisma.user.delete({ where: { id: creatorId } });
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  });

  async function createPurchase(overrides: Partial<Prisma.PurchaseUncheckedCreateInput> = {}) {
    return prisma.purchase.create({
      data: {
        productId,
        customerEmail: "buyer@example.test",
        stripePaymentIntentId: randomUUID(),
        amount: 500,
        status: "completed",
        downloadToken: randomUUID(),
        downloadExpiresAt: new Date(Date.now() + 7_200_000),
        ...overrides,
      },
    });
  }

  it("issues a two-hour link through the webhook and emails the download policy", async () => {
    const sessionId = randomUUID();
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          metadata: { productId },
          customer_email: "buyer@example.test",
          payment_intent: "pi_test",
          amount_total: 500,
        },
      },
    } as unknown as Stripe.Event);
    const before = Date.now();
    const response = await server.inject({ method: "POST", url: "/api/webhooks/stripe" });
    expect(response.statusCode).toBe(200);
    const purchase = await prisma.purchase.findFirstOrThrow({
      where: { stripeSessionId: sessionId },
    });
    expect(purchase.downloadExpiresAt.getTime()).toBeGreaterThanOrEqual(before + 7_200_000);
    expect(purchase.downloadExpiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 7_200_000);
    expect(vi.mocked(sendEmail).mock.lastCall?.[2]).toContain(
      `/api/download/${purchase.downloadToken}`,
    );
    expect(vi.mocked(sendEmail).mock.lastCall?.[2]).toContain("expire in 2 hours");
    expect(vi.mocked(sendEmail).mock.lastCall?.[2]).toContain("up to 3 downloads");
  });

  it("streams three downloads, persists the limit across server instances, and never caches", async () => {
    const purchase = await createPurchase();
    const url = `/api/download/${purchase.downloadToken}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await server.inject({ url, remoteAddress: "192.0.2.1" });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe("Purchased file contents");
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
    }
    const otherServer = Fastify();
    await otherServer.register(purchaseRoutes);
    try {
      const response = await otherServer.inject({ url, remoteAddress: "192.0.2.1" });
      expect(response.statusCode).toBe(429);
    } finally {
      await otherServer.close();
    }
  });

  it("binds to the socket IP and rejects a different IP even with spoofed forwarding headers", async () => {
    const purchase = await createPurchase();
    const url = `/api/download/${purchase.downloadToken}`;
    expect((await server.inject({ url, remoteAddress: "192.0.2.10" })).statusCode).toBe(200);
    const denied = await server.inject({
      url,
      remoteAddress: "192.0.2.11",
      headers: { "x-forwarded-for": "192.0.2.10" },
    });
    expect(denied.statusCode).toBe(403);
    expect((await server.inject({ url, remoteAddress: "192.0.2.10" })).statusCode).toBe(200);
    expect(await prisma.purchase.findUnique({ where: { id: purchase.id } })).toMatchObject({
      downloadIp: "192.0.2.10",
      downloadAttempts: 2,
    });
  });

  it("allows only three concurrent download starts", async () => {
    const purchase = await createPurchase();
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        server.inject({
          url: `/api/download/${purchase.downloadToken}`,
          remoteAddress: "192.0.2.20",
        }),
      ),
    );
    expect(responses.filter((response) => response.statusCode === 200)).toHaveLength(3);
    expect(
      responses.filter((response) => response.body === "Purchased file contents"),
    ).toHaveLength(3);
    expect(await prisma.purchase.findUnique({ where: { id: purchase.id } })).toMatchObject({
      downloadAttempts: 3,
    });
  });

  it("lets only one IP win simultaneous first use", async () => {
    const purchase = await createPurchase();
    const responses = await Promise.all(
      ["192.0.2.30", "192.0.2.31"].map((remoteAddress) =>
        server.inject({ url: `/api/download/${purchase.downloadToken}`, remoteAddress }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 403]);
  });

  it.each([
    [{ downloadExpiresAt: new Date(0) }, 410],
    [{ downloadRevokedAt: new Date() }, 410],
    [{ status: "pending" }, 403],
    [{ status: "failed" }, 403],
  ])("denies unavailable purchases without consuming a download (%j)", async (overrides, status) => {
    const purchase = await createPurchase(overrides);
    expect((await server.inject(`/api/download/${purchase.downloadToken}`)).statusCode).toBe(
      status,
    );
    expect(await prisma.purchase.findUnique({ where: { id: purchase.id } })).toMatchObject({
      downloadAttempts: 0,
      downloadIp: null,
    });
  });

  it("denies a token at its exact expiry boundary", async () => {
    const now = new Date();
    const purchase = await createPurchase({ downloadExpiresAt: now });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    try {
      expect((await server.inject(`/api/download/${purchase.downloadToken}`)).statusCode).toBe(410);
    } finally {
      vi.useRealTimers();
    }
  });

  it("permits only the product's seller to revoke access", async () => {
    const purchase = await createPurchase();
    const url = `/api/purchases/${purchase.id}/revoke-download`;
    expect((await server.inject({ method: "PATCH", url })).statusCode).toBe(401);
    expect(
      (await server.inject({ method: "PATCH", url, headers: { "x-test-user": "other-seller" } }))
        .statusCode,
    ).toBe(404);
    expect((await server.inject(`/api/download/${purchase.downloadToken}`)).statusCode).toBe(200);
    expect(
      (await server.inject({ method: "PATCH", url, headers: { "x-test-user": creatorId } }))
        .statusCode,
    ).toBe(204);
    expect((await server.inject(`/api/download/${purchase.downloadToken}`)).statusCode).toBe(410);
  });

  it("logs allowed, denied, HEAD, and rate-limited attempts without bearer tokens", async () => {
    const purchase = await createPurchase();
    const url = `/api/download/${purchase.downloadToken}`;
    expect((await server.inject({ method: "HEAD", url })).statusCode).toBe(405);
    for (let attempt = 0; attempt < 11; attempt++) {
      await server.inject(url);
    }
    expect(logs).not.toContain(purchase.downloadToken);
    const attempts = logs
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((entry) => entry.msg === "Download attempt");
    expect(attempts).toHaveLength(12);
    expect(attempts.map((entry) => entry.statusCode)).toEqual([
      405,
      200,
      200,
      200,
      ...Array(8).fill(429),
    ]);
    expect(attempts.every((entry) => entry.tokenFingerprint && entry.ip)).toBe(true);
  });
});
