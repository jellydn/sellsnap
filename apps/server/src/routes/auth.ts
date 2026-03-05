import type { FastifyInstance } from "fastify";
import { auth } from "../lib/auth";

export async function authRoutes(server: FastifyInstance): Promise<void> {
  server.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);

        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (value) headers.append(key, value.toString());
        }

        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          ...(request.body ? { body: request.body as string } : {}),
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
}
