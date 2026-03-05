import { createReadStream, existsSync } from "node:fs";
import { extname } from "node:path";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

function sanitizeFilename(name: string): string {
  return name.replace(/["\n\r\t]/g, "").slice(0, 200);
}

export async function purchaseRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/purchases/by-session/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    const purchase = await prisma.purchase.findFirst({
      where: {
        stripeSessionId: sessionId,
        status: "completed",
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
      downloadToken: purchase.downloadToken,
    };
  });

  server.get(
    "/api/download/:token",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      const purchase = await prisma.purchase.findUnique({
        where: { downloadToken: token },
        include: {
          product: true,
        },
      });

      if (!purchase) {
        return reply.status(404).send({ error: "Download not found" });
      }

      if (purchase.downloadExpiresAt < new Date()) {
        return reply.status(410).send({ error: "Download link expired" });
      }

      if (!existsSync(purchase.product.filePath)) {
        return reply.status(404).send({ error: "File not found" });
      }

      const fileName =
        sanitizeFilename(purchase.product.title) + extname(purchase.product.filePath);

      reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
      reply.header("Content-Type", "application/octet-stream");

      return reply.send(createReadStream(purchase.product.filePath));
    },
  );
}
