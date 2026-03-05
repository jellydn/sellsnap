import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import Fastify from "fastify";

const server = Fastify();
const prisma = new PrismaClient();

const auth = betterAuth({
  baseURL: process.env.FRONTEND_URL || "http://localhost:5173",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
});

function headersToHeaders(requestHeaders: Record<string, string | string[] | undefined>) {
  const headers = new Headers();
  Object.entries(requestHeaders).forEach(([key, value]) => {
    if (value) {
      headers.append(key, Array.isArray(value) ? value.join(", ") : value);
    }
  });
  return headers;
}

async function start() {
  await server.register(cors, {
    origin: true,
  });

  server.get("/api/health", async () => {
    return { status: "ok" };
  });

  server.get("/api/products", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session || !session.user) {
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
      },
      orderBy: { createdAt: "desc" },
    });

    return products.map((product) => ({
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      price: product.price,
      coverImageUrl: product.coverImageUrl,
      published: product.published,
      viewCount: product.viewCount,
      purchaseCount: product._count.purchases,
      createdAt: product.createdAt,
    }));
  });

  server.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);

        const headers = new Headers();
        Object.entries(request.headers).forEach(([key, value]) => {
          if (value) headers.append(key, value.toString());
        });

        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        });

        const response = await auth.handler(req);

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          reply.header(key, value);
        });
        reply.send(response.body ? await response.text() : null);
      } catch (error) {
        server.log.error(error);
        reply.status(500).send({
          error: "Internal authentication error",
          code: "AUTH_FAILURE",
        });
      }
    },
  });

  try {
    await server.listen({ port: 3000 });
    console.log("Server running at http://localhost:3000");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
