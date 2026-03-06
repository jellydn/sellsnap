import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

export async function creatorRoutes(server: FastifyInstance): Promise<void> {
  server.get(
    "/api/creators/:slug",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { cursor, limit = 10 } = request.query as { cursor?: string; limit?: number };
      const take = Math.min(Math.max(1, limit || 10), 50);

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

      const hasMore = products.length > take;
      const items = hasMore ? products.slice(0, -1) : products;
      const nextCursor = hasMore ? items[items.length - 1]?.id : null;

      return {
        id: creator.id,
        name: creator.name,
        slug: creator.slug,
        avatarUrl: creator.avatarUrl,
        products: {
          items: items.map(
            (p: {
              id: string;
              title: string;
              slug: string;
              price: number;
              coverImageUrl: string | null;
              createdAt: Date;
            }) => ({
              id: p.id,
              title: p.title,
              slug: p.slug,
              price: p.price,
              coverImageUrl: p.coverImageUrl,
              createdAt: p.createdAt,
            }),
          ),
          nextCursor,
          hasMore,
        },
      };
    },
  );
}
