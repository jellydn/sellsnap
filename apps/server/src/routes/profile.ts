import type { FastifyInstance } from "fastify";
import { auth, headersToHeaders } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { saveImage, validateImageFile } from "../lib/upload";

export async function profileRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/profile", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      slug: user.slug,
      avatarUrl: user.avatarUrl,
    };
  });

  server.put("/api/profile", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
    });

    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const parts = request.parts();
    const fields: Record<string, string> = {};
    let avatar: Awaited<ReturnType<typeof parts.next>>["value"] | null = null;

    for await (const part of parts) {
      if (part.type === "file") {
        if (part.fieldname === "avatar") {
          avatar = part;
        }
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    const name = fields.name;
    const slug = fields.slug;

    if (!name && !slug && !avatar) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const updateData: { name?: string; slug?: string; avatarUrl?: string | null } = {};

    if (name) updateData.name = name;
    if (slug) {
      const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
      const RESERVED_SLUGS = new Set([
        "api",
        "sign-in",
        "sign-up",
        "dashboard",
        "admin",
        "settings",
        "purchase",
        "creator",
        "p",
      ]);

      if (!SLUG_REGEX.test(slug)) {
        return reply
          .status(400)
          .send({ error: "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only" });
      }
      if (RESERVED_SLUGS.has(slug)) {
        return reply.status(400).send({ error: "This slug is reserved" });
      }

      const existing = await prisma.user.findFirst({
        where: { slug, id: { not: session.user.id } },
      });
      if (existing) {
        return reply.status(400).send({ error: "Slug already taken" });
      }
      updateData.slug = slug;
    }

    if (avatar) {
      const validationError = validateImageFile(avatar.mimetype, avatar.filename);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }
      updateData.avatarUrl = await saveImage(avatar.file, avatar.filename);
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      slug: user.slug,
      avatarUrl: user.avatarUrl,
    };
  });
}
