import { createReadStream, existsSync } from "node:fs";
import { extname } from "node:path";
import { logger } from "@sellsnap/logger";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSessionFromRequest } from "../lib/auth";
import { PURCHASE_STATUS } from "../lib/constants";
import { prisma } from "../lib/prisma";

function sanitizeFilename(name: string): string {
  return name.replace(/["\n\r\t]/g, "").slice(0, 200);
}

function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first.trim();
  }
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
          `Download attempt on revoked token ${token} (purchase ${purchase.id}) from IP ${clientIp}`,
        );
        return reply.status(410).send({ error: "Download link has been revoked" });
      }

      // Check expiration
      if (purchase.downloadExpiresAt < new Date()) {
        logger.warn(
          `Download attempt on expired token ${token} (purchase ${purchase.id}) from IP ${clientIp}`,
        );
        return reply.status(410).send({ error: "Download link expired" });
      }

      // IP binding: bind on first download, enforce on subsequent
      if (purchase.boundIpAddress && purchase.boundIpAddress !== clientIp) {
        logger.warn(
          `IP mismatch for token ${token} (purchase ${purchase.id}): expected ${purchase.boundIpAddress}, got ${clientIp}`,
        );
        return reply.status(403).send({ error: "Download token is not valid for this IP address" });
      }

      if (!existsSync(purchase.product.filePath)) {
        return reply.status(404).send({ error: "File not found" });
      }

      // Record attempt and bind IP on first use (atomic update to prevent race condition)
      const result = await prisma.purchase.updateMany({
        where: {
          id: purchase.id,
          downloadAttempts: { lt: purchase.maxDownloadAttempts },
        },
        data: {
          downloadAttempts: { increment: 1 },
          boundIpAddress: purchase.boundIpAddress ?? clientIp,
        },
      });

      if (result.count === 0) {
        logger.warn(
          `Download attempt limit exceeded for token ${token} (purchase ${purchase.id}) from IP ${clientIp}`,
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

    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { revokedAt: new Date() },
    });

    logger.info(
      `Download token ${token} (purchase ${purchase.id}) revoked by user ${session.user.id}`,
    );

    return reply.status(200).send({ revoked: true });
  });

  // List all purchases for products owned by the creator
  server.get("/api/purchases", async (request, reply) => {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

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
    });

    return { purchases };
  });
}
