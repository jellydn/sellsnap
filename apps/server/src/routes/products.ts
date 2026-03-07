import { randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import { logger } from "@sellsnap/logger";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getSessionFromRequest } from "../lib/auth";
import { PURCHASE_STATUS } from "../lib/constants";
import { paginate, parseLimit } from "../lib/pagination";
import { prisma } from "../lib/prisma";
import { saveFile, saveImage, validateImageFile, validateProductFile } from "../lib/upload";

// Helper to drain a readable stream
async function drainStream(stream: NodeJS.ReadableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on("data", () => {});
    stream.on("end", resolve);
    stream.on("error", reject);
  });
}

interface PrismaError {
  code: string;
}

function isPrismaError(error: unknown): error is PrismaError {
  return (
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
  );
}

function safeDeletePath(path: string, context: string): void {
  if (!path || !existsSync(path)) return;
  try {
    unlinkSync(path);
  } catch (error) {
    logger.warn({ error, path }, `Failed to delete ${context}`);
  }
}

function toProductResponse(product: {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  coverImageUrl: string | null;
  previewContent: string | null;
  published: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt?: Date;
}) {
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
    ...(product.updatedAt && { updatedAt: product.updatedAt }),
  };
}

const recentViews = new Map<string, number>();
const VIEW_COOLDOWN_MS = 60_000; // 1 minute per IP per product

const viewCountQueue = new Map<string, number>();
const VIEW_COUNT_FLUSH_INTERVAL = 10_000; // 10 seconds

async function flushViewCounts(): Promise<void> {
  if (viewCountQueue.size === 0) return;

  const updates = Array.from(viewCountQueue.entries());
  viewCountQueue.clear();

  try {
    await prisma.$transaction(
      updates.map(([productId, increment]) =>
        prisma.product.update({
          where: { id: productId },
          data: { viewCount: { increment } },
        }),
      ),
    );
  } catch (error) {
    // Re-queue failed updates for next flush
    for (const [productId, increment] of updates) {
      const current = viewCountQueue.get(productId) || 0;
      viewCountQueue.set(productId, current + increment);
    }
    logger.error({ error }, "Failed to flush view counts");
  }
}

setInterval(flushViewCounts, VIEW_COUNT_FLUSH_INTERVAL);

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentViews) {
    if (now - timestamp > VIEW_COOLDOWN_MS) {
      recentViews.delete(key);
    }
  }
}, 300_000);

// Helper: validate session and return 401 if unauthorized
async function requireAuth(
  request: Parameters<typeof getSessionFromRequest>[0],
  reply: FastifyReply,
) {
  const session = await getSessionFromRequest(request);
  if (!session?.user) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  return session;
}

// Helper: parse multipart form data
interface ParsedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

interface ParsedMultipartData {
  fields: Record<string, string>;
  coverImage: ParsedFile | null;
  productFile: ParsedFile | null;
}

async function parseMultipartData(request: FastifyRequest): Promise<ParsedMultipartData | null> {
  const fields: Record<string, string> = {};
  let coverImage: ParsedFile | null = null;
  let productFile: ParsedFile | null = null;

  try {
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === "file") {
        const file = part as MultipartFile;
        const buffer = await file.toBuffer();
        const fileData = { buffer, filename: file.filename, mimetype: file.mimetype };

        if (part.fieldname === "coverImage") {
          coverImage = fileData;
        } else if (part.fieldname === "productFile") {
          productFile = fileData;
        }
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }
    return { fields, coverImage, productFile };
  } catch {
    return null;
  }
}

export async function productRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/products", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session?.user) return;

    const { cursor, limit = 10 } = request.query as { cursor?: string; limit?: number };
    const take = parseLimit(limit, 100);

    const products = await prisma.product.findMany({
      where: { creatorId: session.user.id },
      include: {
        _count: {
          select: {
            purchases: {
              where: { status: PURCHASE_STATUS.COMPLETED },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
    });

    const { items, nextCursor, hasMore } = paginate(products, take);

    return {
      items: items.map((product) => ({
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
      })),
      nextCursor,
      hasMore,
    };
  });

  server.get(
    "/api/products/by-slug/:slug",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
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

      const forwardedIp = (request.headers["x-forwarded-for"] as string)?.split(",")[0];
      const clientIp = forwardedIp || request.ip || "unknown";
      const viewKey = `${product.id}:${clientIp}`;
      const now = Date.now();

      const lastView = recentViews.get(viewKey);
      if (!lastView || now - lastView > VIEW_COOLDOWN_MS) {
        recentViews.set(viewKey, now);
        viewCountQueue.set(product.id, (viewCountQueue.get(product.id) || 0) + 1);
      }

      const pendingIncrement = viewCountQueue.get(product.id) || 0;

      return {
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        price: product.price,
        coverImageUrl: product.coverImageUrl,
        previewContent: product.previewContent,
        viewCount: product.viewCount + pendingIncrement,
        createdAt: product.createdAt,
        creator: {
          id: product.creator.id,
          name: product.creator.name,
          slug: product.creator.slug,
          avatarUrl: product.creator.avatarUrl,
        },
      };
    },
  );

  server.get("/api/products/:id", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session?.user) return;

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

    return toProductResponse(product);
  });

  server.post("/api/products", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session?.user) return;

    const multipartData = await parseMultipartData(request);
    if (!multipartData) {
      return reply.status(400).send({ error: "Invalid request format" });
    }

    const { fields, coverImage, productFile } = multipartData;

    const title = fields.title;
    const description = fields.description || "";
    const priceStr = fields.price;
    const previewContent = fields.previewContent || null;

    if (!title || !priceStr || !productFile) {
      return reply
        .status(400)
        .send({ error: "Missing required fields: title, price, productFile" });
    }

    const fileValidationError = validateProductFile(productFile.filename);
    if (fileValidationError) {
      return reply.status(400).send({ error: fileValidationError });
    }

    const price = Math.round(Number.parseFloat(priceStr) * 100);
    if (Number.isNaN(price) || price < 0) {
      return reply.status(400).send({ error: "Invalid price" });
    }

    if (coverImage) {
      const validationError = validateImageFile(coverImage.mimetype, coverImage.filename);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }
    }

    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);

    let slug = baseSlug;
    const existingWithBaseSlug = await prisma.product.findUnique({
      where: { slug: baseSlug },
    });

    if (existingWithBaseSlug) {
      const lastSimilar = await prisma.product.findFirst({
        where: { slug: { startsWith: `${baseSlug}-` } },
        orderBy: { slug: "desc" },
      });

      const slugSuffix = lastSimilar
        ? parseInt(lastSimilar.slug.match(/^.+-(\d+)$/)?.[1] || "0", 10) + 1
        : 1;

      slug = `${baseSlug}-${slugSuffix}`;
    }

    let coverImageUrl: string | null = null;
    if (coverImage) {
      coverImageUrl = await saveImage(coverImage.file, coverImage.filename);
    }

    const productFilePath = await saveFile(productFile.file, productFile.filename);

    try {
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

      return toProductResponse(product);
    } catch (error) {
      if (isPrismaError(error) && error.code === "P2002") {
        slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
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

        return toProductResponse(product);
      }
      throw error;
    }
  });

  server.put("/api/products/:id", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session?.user) return;

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

    const multipartData = await parseMultipartData(request);
    if (!multipartData) {
      return reply.status(400).send({ error: "Invalid request format" });
    }

    const { fields, coverImage, productFile } = multipartData;

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
      const price = Math.round(Number.parseFloat(priceStr) * 100);
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
      const validationError = validateImageFile(coverImage.mimetype, coverImage.filename);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }
      coverImageUrl = await saveImage(coverImage.file, coverImage.filename);
    } else if (fields.coverImage === "") {
      coverImageUrl = null;
    }
    if (coverImage !== null || fields.coverImage !== undefined) {
      updateData.coverImageUrl = coverImageUrl;
    }

    let filePath = existingProduct.filePath;
    if (productFile) {
      const fileValidationError = validateProductFile(productFile.filename);
      if (fileValidationError) {
        return reply.status(400).send({ error: fileValidationError });
      }
      filePath = await saveFile(productFile.file, productFile.filename);
    }
    if (productFile !== null || fields.productFile !== undefined) {
      updateData.filePath = filePath;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    return toProductResponse(product);
  });

  server.patch("/api/products/:id/publish", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session?.user) return;

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

  server.delete("/api/products/:id", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session?.user) return;

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

    safeDeletePath(product.filePath, "product file");
    if (product.coverImageUrl) {
      const imagePath = join(process.cwd(), product.coverImageUrl.replace(/^\//, ""));
      safeDeletePath(imagePath, "cover image");
    }

    await prisma.product.delete({ where: { id } });

    return reply.status(204).send();
  });
}
