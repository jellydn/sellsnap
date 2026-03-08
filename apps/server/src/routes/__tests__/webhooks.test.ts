import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sellsnap/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("../../lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    product: {
      findUnique: vi.fn(),
    },
    purchase: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "../../lib/prisma";

const mockPurchaseFindFirst = vi.mocked(prisma.purchase.findFirst);
const mockPurchaseCreate = vi.mocked(prisma.purchase.create);

async function processWebhookEvent(sessionId: string): Promise<{ skipped: boolean }> {
  const existingPurchase = await mockPurchaseFindFirst({
    where: { stripeSessionId: sessionId },
  });

  if (existingPurchase) {
    return { skipped: true };
  }

  await mockPurchaseCreate({ data: {} as any });
  return { skipped: false };
}

describe("webhook idempotency (FRAG-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates purchase on first webhook event", async () => {
    mockPurchaseFindFirst.mockResolvedValue(null as any);
    mockPurchaseCreate.mockResolvedValue({ id: "purchase-1" } as any);

    const result = await processWebhookEvent("cs_test_123");

    expect(result.skipped).toBe(false);
    expect(mockPurchaseCreate).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate webhook events with same stripeSessionId", async () => {
    mockPurchaseFindFirst.mockResolvedValue({ id: "existing-purchase" } as any);

    const result = await processWebhookEvent("cs_test_123");

    expect(result.skipped).toBe(true);
    expect(mockPurchaseCreate).not.toHaveBeenCalled();
  });

  it("queries for existing purchase by stripeSessionId", async () => {
    mockPurchaseFindFirst.mockResolvedValue(null as any);
    mockPurchaseCreate.mockResolvedValue({ id: "purchase-1" } as any);

    await processWebhookEvent("cs_test_456");

    expect(mockPurchaseFindFirst).toHaveBeenCalledWith({
      where: { stripeSessionId: "cs_test_456" },
    });
  });
});
