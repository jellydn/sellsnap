import type { FastifyInstance } from "fastify";
import { getSessionFromRequest } from "../lib/auth";
import { PURCHASE_STATUS } from "../lib/constants";
import { prisma } from "../lib/prisma";

export async function purchaseRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/purchases/by-session/:sessionId", async (request, reply) => {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { sessionId } = request.params as { sessionId: string };

    const purchase = await prisma.purchase.findFirst({
      where: {
        stripeSessionId: sessionId,
        customerEmail: session.user.email,
        status: PURCHASE_STATUS.COMPLETED,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!purchase) {
      return reply.status(404).send({ error: "Purchase not found" });
    }

    return {
      productTitle: purchase.product.title,
      purchased: true,
    };
  });
}
