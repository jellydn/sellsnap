import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { auth, headersToHeaders } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { saveFile, saveImage, validateImageFile } from "../lib/upload";

export async function productRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/products", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session?.user) {
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

      const updatedProduct = await prisma.product.update({
        where: { id: product.id },
        data: { viewCount: { increment: 1 } },
      });

      return {
        id: updatedProduct.id,
        title: updatedProduct.title,
        slug: updatedProduct.slug,
        description: updatedProduct.description,
        price: updatedProduct.price,
        coverImageUrl: updatedProduct.coverImageUrl,
        previewContent: updatedProduct.previewContent,
        viewCount: updatedProduct.viewCount,
        createdAt: updatedProduct.createdAt,
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
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session?.user) {
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

  server.post("/api/products", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session?.user) {
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
    let slugSuffix = 0;
    while (await prisma.product.findUnique({ where: { slug } })) {
      slugSuffix++;
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
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
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
        };
      }
      throw error;
    }
  });

  server.put("/api/products/:id", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session?.user) {
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
    }
    if (coverImage !== null || fields.coverImage !== undefined) {
      updateData.coverImageUrl = coverImageUrl;
    }

    let filePath = existingProduct.filePath;
    if (productFile) {
      filePath = await saveFile(productFile.file, productFile.filename);
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

    if (!session?.user) {
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
}
