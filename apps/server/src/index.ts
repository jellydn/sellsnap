import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import Fastify from "fastify";

const UPLOADS_DIR = join(process.cwd(), "uploads");
const IMAGES_DIR = join(UPLOADS_DIR, "images");
const FILES_DIR = join(UPLOADS_DIR, "files");

function ensureUploadDirs() {
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });
  if (!existsSync(FILES_DIR)) mkdirSync(FILES_DIR, { recursive: true });
}
ensureUploadDirs();

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

  await server.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024,
    },
  });

  await server.register(await import("@fastify/static"), {
    root: IMAGES_DIR,
    prefix: "/uploads/images/",
    decorateReply: false,
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

  server.post("/api/products", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session || !session.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const parts = request.parts();
    const fields: Record<string, string> = {};
    let coverImage: Awaited<ReturnType<typeof parts.next>>["value"] | null = null;
    let productFile: Awaited<ReturnType<typeof parts.next>>["value"] | null = null;

    for await (const part of parts) {
      if (part.type === "file") {
        if (part.fieldname === "coverImage") {
          coverImage = part;
        } else if (part.fieldname === "productFile") {
          productFile = part;
        }
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    const title = fields.title;
    const description = fields.description || "";
    const priceStr = fields.price;
    const previewContent = fields.previewContent || null;

    if (!title || !priceStr || !productFile) {
      return reply
        .status(400)
        .send({ error: "Missing required fields: title, price, productFile" });
    }

    const price = Math.round(parseFloat(priceStr) * 100);
    if (isNaN(price) || price < 0) {
      return reply.status(400).send({ error: "Invalid price" });
    }

    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);

    let slug = baseSlug;
    let slugSuffix = 0;
    while (await prisma.product.findUnique({ where: { slug } })) {
      slugSuffix++;
      slug = `${baseSlug}-${slugSuffix}`;
    }

    let coverImageUrl: string | null = null;
    if (coverImage) {
      const ext = extname(coverImage.filename || ".jpg") || ".jpg";
      const coverImageName = `${randomUUID()}${ext}`;
      const coverImagePath = join(IMAGES_DIR, coverImageName);
      const buffers: Buffer[] = [];
      for await (const chunk of coverImage.file) {
        buffers.push(chunk);
      }
      writeFileSync(coverImagePath, Buffer.concat(buffers));
      coverImageUrl = `/uploads/images/${coverImageName}`;
    }

    const productExt = extname(productFile.filename || ".pdf") || ".pdf";
    const productFileName = `${randomUUID()}${productExt}`;
    const productFilePath = join(FILES_DIR, productFileName);
    const productBuffers: Buffer[] = [];
    for await (const chunk of productFile.file) {
      productBuffers.push(chunk);
    }
    writeFileSync(productFilePath, Buffer.concat(productBuffers));

    const product = await prisma.product.create({
      data: {
        title,
        slug,
        description,
        price,
        coverImageUrl,
        filePath: productFilePath,
        previewContent,
        published: false,
        viewCount: 0,
        creatorId: session.user.id,
      },
    });

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      price: product.price,
      coverImageUrl: product.coverImageUrl,
      filePath: product.filePath,
      previewContent: product.previewContent,
      published: product.published,
      viewCount: product.viewCount,
      createdAt: product.createdAt,
    };
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
