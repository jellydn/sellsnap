import type { FastifyInstance } from "fastify";
import { auth, headersToHeaders } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { validateImageFile, withUpload } from "../lib/upload";

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

  server.put(
    "/api/profile",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const session = await auth.api.getSession({
        headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
      });

      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      return withUpload(session.user.id, async (upload) => {
        const parts = request.parts({ limits: { files: 1, fields: 2, parts: 3 } });
        const fields: Record<string, string> = {};
        let avatar: { buffer: Buffer; filename: string; mimetype: string } | null = null;

        for await (const part of parts) {
          if (part.type === "file") {
            const buffer = await part.toBuffer();
            if (part.fieldname === "avatar") {
              avatar = { buffer, filename: part.filename, mimetype: part.mimetype };
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
            return reply.status(400).send({
              error: "Slug must be 3-40 characters, lowercase alphanumeric and hyphens only",
            });
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
          const previousUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { avatarUrl: true },
          });
          updateData.avatarUrl = await upload.saveImage(
            avatar.buffer,
            avatar.filename,
            previousUser?.avatarUrl,
          );
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
    },
  );
}
