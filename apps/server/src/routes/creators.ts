import type { FastifyInstance } from "fastify";
import { paginate, parseLimit } from "../lib/pagination";
import { prisma } from "../lib/prisma";

export async function creatorRoutes(server: FastifyInstance): Promise<void> {
  server.get(
    "/api/creators/:slug",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { cursor, limit = 10 } = request.query as { cursor?: string; limit?: number };
      const take = parseLimit(limit, 50);

      const creator = await prisma.user.findUnique({
        where: { slug },
      });

      if (!creator) {
        return reply.status(404).send({ error: "Creator not found" });
      }

      const products = await prisma.product.findMany({
        where: {
          creatorId: creator.id,
          published: true,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          coverImageUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
      });

      const { items, nextCursor, hasMore } = paginate(products, take);

      return {
        id: creator.id,
        name: creator.name,
        slug: creator.slug,
        avatarUrl: creator.avatarUrl,
        products: {
          items,
          nextCursor,
          hasMore,
        },
      };
    },
  );
}
