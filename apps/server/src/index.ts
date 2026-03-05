import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import Fastify from "fastify";
import Stripe from "stripe";

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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

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

  await server.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      try {
        request.body = body;
        done(null, body as object);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

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

    return products.map(
      (product: {
        id: string;
        title: string;
        slug: string;
        description: string;
        price: number;
        coverImageUrl: string | null;
        published: boolean;
        viewCount: number;
        createdAt: Date;
        _count: { purchases: number };
      }) => ({
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
      }),
    );
  });

  server.get("/api/products/by-slug/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            slug: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!product || !product.published) {
      return reply.status(404).send({ error: "Product not found" });
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } },
    });

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      price: product.price,
      coverImageUrl: product.coverImageUrl,
      previewContent: product.previewContent,
      viewCount: product.viewCount + 1,
      createdAt: product.createdAt,
      creator: {
        id: product.creator.id,
        name: product.creator.name,
        slug: product.creator.slug,
        avatarUrl: product.creator.avatarUrl,
      },
    };
  });

  server.get("/api/creators/:slug", async (request, reply) => {
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
  });

  server.post("/api/checkout/:productSlug", async (request, reply) => {
    const { productSlug } = request.params as { productSlug: string };
    const { customerEmail } = request.body as { customerEmail?: string };

    const product = await prisma.product.findUnique({
      where: { slug: productSlug, published: true },
    });

    if (!product) {
      return reply.status(404).send({ error: "Product not found" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.title,
              description: product.description || undefined,
            },
            unit_amount: product.price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/p/${product.slug}`,
      customer_email: customerEmail,
      metadata: {
        productId: product.id,
      },
    });

    return { url: session.url };
  });

  server.post("/api/webhooks/stripe", async (request, reply) => {
    const sig = request.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return reply.status(500).send({ error: "Webhook secret not configured" });
    }

    let event: Stripe.Event;

    try {
      const rawBody = request.body as string;
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return reply.status(400).send({ error: "Webhook signature verification failed" });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const productId = session.metadata?.productId;
      const customerEmail = session.customer_email;

      if (!productId || !customerEmail) {
        console.error("Missing metadata in webhook event");
        return reply.status(400).send({ error: "Missing metadata" });
      }

      const downloadToken = randomUUID();
      const downloadExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.purchase.create({
        data: {
          productId,
          customerEmail,
          customerName: session.customer_details?.name || null,
          stripePaymentIntentId: session.payment_intent as string,
          amount: session.amount_total || 0,
          status: "completed",
          downloadToken,
          downloadExpiresAt,
        },
      });

      console.log(`Purchase completed for product ${productId}, email: ${customerEmail}`);
    }

    return reply.status(200).send({ received: true });
  });

  server.get("/api/products/:id", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session || !session.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return reply.status(404).send({ error: "Product not found" });
    }

    if (product.creatorId !== session.user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      price: product.price,
      coverImageUrl: product.coverImageUrl,
      previewContent: product.previewContent,
      published: product.published,
      viewCount: product.viewCount,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  });

  server.put("/api/products/:id", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session || !session.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return reply.status(404).send({ error: "Product not found" });
    }

    if (existingProduct.creatorId !== session.user.id) {
      return reply.status(403).send({ error: "Forbidden" });
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
    const description = fields.description;
    const priceStr = fields.price;
    const slug = fields.slug;
    const previewContent = fields.previewContent;

    const updateData: {
      title?: string;
      description?: string;
      price?: number;
      slug?: string;
      previewContent?: string | null;
      coverImageUrl?: string | null;
      filePath?: string;
    } = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priceStr !== undefined) {
      const price = Math.round(parseFloat(priceStr) * 100);
      if (Number.isNaN(price) || price < 0) {
        return reply.status(400).send({ error: "Invalid price" });
      }
      updateData.price = price;
    }
    if (previewContent !== undefined) updateData.previewContent = previewContent || null;

    if (slug !== undefined && slug !== existingProduct.slug) {
      const existingWithSlug = await prisma.product.findUnique({
        where: { slug },
      });
      if (existingWithSlug) {
        return reply.status(400).send({ error: "Slug already exists" });
      }
      updateData.slug = slug;
    }

    let coverImageUrl: string | null = existingProduct.coverImageUrl;
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
    if (coverImage !== null || fields.coverImage !== undefined) {
      updateData.coverImageUrl = coverImageUrl;
    }

    let filePath = existingProduct.filePath;
    if (productFile) {
      const ext = extname(productFile.filename || ".pdf") || ".pdf";
      const productFileName = `${randomUUID()}${ext}`;
      const newFilePath = join(FILES_DIR, productFileName);
      const buffers: Buffer[] = [];
      for await (const chunk of productFile.file) {
        buffers.push(chunk);
      }
      writeFileSync(newFilePath, Buffer.concat(buffers));
      filePath = newFilePath;
    }
    if (productFile !== null || fields.productFile !== undefined) {
      updateData.filePath = filePath;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      price: product.price,
      coverImageUrl: product.coverImageUrl,
      previewContent: product.previewContent,
      published: product.published,
      viewCount: product.viewCount,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  });

  server.patch("/api/products/:id/publish", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session || !session.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return reply.status(404).send({ error: "Product not found" });
    }

    if (product.creatorId !== session.user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { published: !product.published },
    });

    return {
      id: updatedProduct.id,
      title: updatedProduct.title,
      slug: updatedProduct.slug,
      published: updatedProduct.published,
    };
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
    if (Number.isNaN(price) || price < 0) {
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
