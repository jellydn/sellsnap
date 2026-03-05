import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

export async function creatorRoutes(server: FastifyInstance): Promise<void> {
  server.get(
    "/api/creators/:slug",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };

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
      });

      return {
        id: creator.id,
        name: creator.name,
        slug: creator.slug,
        avatarUrl: creator.avatarUrl,
        products: products.map(
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
      };
    },
  );
}
