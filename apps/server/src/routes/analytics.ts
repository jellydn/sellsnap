import type { FastifyInstance } from "fastify";
import { auth, headersToHeaders } from "../lib/auth";
import { prisma } from "../lib/prisma";

export async function analyticsRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/analytics", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const products = await prisma.product.findMany({
      where: { creatorId: session.user.id },
      include: {
        _count: {
          select: {
            purchases: {
              where: { status: "completed" },
            },
          },
        },
        purchases: {
          where: { status: "completed" },
          select: { amount: true },
        },
      },
    });

    let totalViews = 0;
    let totalPurchases = 0;
    let totalRevenue = 0;

    const productStats = products.map(
      (product: {
        id: string;
        title: string;
        viewCount: number;
        _count: { purchases: number };
        purchases: { amount: number }[];
      }) => {
        const purchaseCount = product._count.purchases;
        const revenue = product.purchases.reduce(
          (sum: number, p: { amount: number }) => sum + p.amount,
          0,
        );

        totalViews += product.viewCount;
        totalPurchases += purchaseCount;
        totalRevenue += revenue;

        return {
          id: product.id,
          title: product.title,
          viewCount: product.viewCount,
          purchaseCount,
          revenue,
        };
      },
    );

    return {
      products: productStats,
      totals: {
        totalViews,
        totalPurchases,
        totalRevenue,
      },
    };
  });
}
