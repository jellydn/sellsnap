import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { extname } from "node:path";
import type { FastifyError, FastifyInstance } from "fastify";
import { getSessionFromRequest } from "../lib/auth";
import { MAX_DOWNLOAD_ATTEMPTS, PURCHASE_STATUS } from "../lib/constants";
import { prisma } from "../lib/prisma";

function sanitizeFilename(name: string): string {
  return name.replace(/["\n\r\t]/g, "").slice(0, 200);
}

export async function purchaseRoutes(server: FastifyInstance): Promise<void> {
  server.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ error: "Request rejected" });
    }
    // Database error messages can contain query arguments, including the bearer token.
    request.log.error({ errorType: error.name }, "Purchase request failed");
    return reply.status(500).send({ error: "Internal server error" });
  });

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

  server.patch("/api/purchases/:id/revoke-download", async (request, reply) => {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };
    const revoked = await prisma.purchase.updateMany({
      where: { id, product: { creatorId: session.user.id } },
      data: { downloadRevokedAt: new Date() },
    });

    if (revoked.count === 0) {
      return reply.status(404).send({ error: "Purchase not found" });
    }

    request.log.info({ purchaseId: id, creatorId: session.user.id }, "Download token revoked");
    return reply.status(204).send();
  });

  server.get(
    "/api/download/:token",
    {
      onRequest: async (request, reply) => {
        reply.header("Cache-Control", "no-store");
        reply.header("Referrer-Policy", "no-referrer");
        if (request.method === "HEAD") {
          return reply.status(405).header("Allow", "GET").send();
        }
      },
      onResponse: async (request, reply) => {
        const { token } = request.params as { token: string };
        request.log.info(
          {
            tokenFingerprint: createHash("sha256").update(token).digest("hex"),
            ip: request.ip,
            statusCode: reply.statusCode,
          },
          "Download attempt",
        );
      },
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

      if (purchase.status !== PURCHASE_STATUS.COMPLETED) {
        return reply.status(403).send({ error: "Download unavailable" });
      }

      if (purchase.downloadRevokedAt || purchase.downloadExpiresAt <= new Date()) {
        return reply.status(410).send({ error: "Download link expired or revoked" });
      }

      if (purchase.downloadIp && purchase.downloadIp !== request.ip) {
        return reply.status(403).send({ error: "Download link is bound to another IP address" });
      }

      if (purchase.downloadAttempts >= MAX_DOWNLOAD_ATTEMPTS) {
        return reply.status(429).send({ error: "Download limit reached" });
      }

      if (!existsSync(purchase.product.filePath)) {
        return reply.status(404).send({ error: "File not found" });
      }

      // Claim access atomically so concurrent requests cannot bypass binding or the limit.
      const claimed = await prisma.purchase.updateMany({
        where: {
          id: purchase.id,
          status: PURCHASE_STATUS.COMPLETED,
          downloadExpiresAt: { gt: new Date() },
          downloadRevokedAt: null,
          downloadAttempts: { lt: MAX_DOWNLOAD_ATTEMPTS },
          OR: [{ downloadIp: null }, { downloadIp: request.ip }],
        },
        data: {
          downloadAttempts: { increment: 1 },
          downloadIp: request.ip,
        },
      });

      if (claimed.count === 0) {
        return reply.status(403).send({ error: "Download no longer available" });
      }

      const fileName =
        sanitizeFilename(purchase.product.title) + extname(purchase.product.filePath);

      reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
      reply.header("Content-Type", "application/octet-stream");

      return reply.send(createReadStream(purchase.product.filePath));
    },
  );
}
