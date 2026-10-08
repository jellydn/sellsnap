import { createReadStream, existsSync } from "node:fs";
import { extname } from "node:path";
import { logger } from "@sellsnap/logger";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSessionFromRequest } from "../lib/auth";
import { PURCHASE_STATUS } from "../lib/constants";
import { paginate, parseLimit } from "../lib/pagination";
import { prisma } from "../lib/prisma";

function sanitizeFilename(name: string): string {
  return name.replace(/["\n\r\t]/g, "").slice(0, 200);
}

function getClientIp(request: FastifyRequest): string {
  return request.ip ?? "unknown";
}

export async function fileRoutes(server: FastifyInstance): Promise<void> {
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
      const clientIp = getClientIp(request);

      const purchase = await prisma.purchase.findUnique({
        where: { downloadToken: token },
        include: {
          product: true,
        },
      });

      if (!purchase) {
        logger.warn(`Download attempt with invalid token from IP ${clientIp}`);
        return reply.status(404).send({ error: "Download not found" });
      }

      // Check token revocation
      if (purchase.revokedAt) {
        logger.warn(
          `Download attempt on revoked token ${token} (purchase ${purchase.id}, attempt ${purchase.downloadAttempts}) from IP ${clientIp}`,
        );
        return reply.status(410).send({ error: "Download link has been revoked" });
      }

      // Check expiration
      if (purchase.downloadExpiresAt < new Date()) {
        logger.warn(
          `Download attempt on expired token ${token} (purchase ${purchase.id}, attempt ${purchase.downloadAttempts}) from IP ${clientIp}`,
        );
        return reply.status(410).send({ error: "Download link expired" });
      }

      // IP binding: bind on first download, enforce on subsequent
      if (purchase.boundIpAddress && purchase.boundIpAddress !== clientIp) {
        logger.warn(
          `IP mismatch for token ${token} (purchase ${purchase.id}, attempt ${purchase.downloadAttempts}): expected ${purchase.boundIpAddress}, got ${clientIp}`,
        );
        return reply.status(403).send({ error: "Download token is not valid for this IP address" });
      }

      if (!existsSync(purchase.product.filePath)) {
        return reply.status(404).send({ error: "File not found" });
      }

      // Record attempt and bind IP on first use, atomically guarding against concurrent requests
      const result = await prisma.purchase.updateMany({
        where: {
          id: purchase.id,
          // Ensure we only increment from the exact attempt count we observed
          downloadAttempts: purchase.downloadAttempts,
          // Enforce IP binding atomically: either not yet bound or already bound to this IP
          OR: [{ boundIpAddress: null }, { boundIpAddress: clientIp }],
        },
        data: {
          downloadAttempts: { increment: 1 },
          boundIpAddress: purchase.boundIpAddress ?? clientIp,
        },
      });

      if (result.count === 0) {
        logger.warn(
          `Download attempt limit exceeded for token ${token} (purchase ${purchase.id}, attempt ${purchase.downloadAttempts}) from IP ${clientIp}`,
        );
        return reply.status(429).send({ error: "Download attempt limit exceeded" });
      }

      logger.info(
        `Download successful for token ${token} (purchase ${purchase.id}) from IP ${clientIp}`,
      );

      const fileName =
        sanitizeFilename(purchase.product.title) + extname(purchase.product.filePath);

      reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
      reply.header("Content-Type", "application/octet-stream");

      return reply.send(createReadStream(purchase.product.filePath));
    },
  );

  // Token revocation endpoint - accessible by the product creator
  server.post("/api/download/:token/revoke", async (request, reply) => {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { token } = request.params as { token: string };

    const purchase = await prisma.purchase.findUnique({
      where: { downloadToken: token },
      include: {
        product: {
          select: { creatorId: true },
        },
      },
    });

    if (!purchase) {
      return reply.status(404).send({ error: "Download not found" });
    }

    if (purchase.product.creatorId !== session.user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    if (purchase.revokedAt) {
      return reply.status(409).send({ error: "Token already revoked" });
    }

    const isExhausted = purchase.downloadAttempts >= purchase.maxDownloadAttempts;

    const result = await prisma.purchase.updateMany({
      where: { id: purchase.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      return reply.status(409).send({ error: "Token already revoked" });
    }

    if (isExhausted) {
      logger.warn(
        `Download token ${token} (purchase ${purchase.id}) revoked after download limit was exceeded`,
      );
    } else {
      logger.info(
        `Download token ${token} (purchase ${purchase.id}) revoked by user ${session.user.id}`,
      );
    }

    return reply.status(200).send({ revoked: true });
  });

  // List all purchases for products owned by the creator
  server.get("/api/purchases", async (request, reply) => {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { cursor, limit = 10 } = request.query as { cursor?: string; limit?: number };
    const take = parseLimit(limit, 100);

    const purchases = await prisma.purchase.findMany({
      where: {
        product: { creatorId: session.user.id },
        status: PURCHASE_STATUS.COMPLETED,
      },
      select: {
        id: true,
        customerEmail: true,
        customerName: true,
        amount: true,
        downloadAttempts: true,
        maxDownloadAttempts: true,
        downloadExpiresAt: true,
        revokedAt: true,
        createdAt: true,
        product: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
    });

    const { items, nextCursor, hasMore } = paginate(purchases, take);

    return { purchases: items, nextCursor, hasMore };
  });
}
