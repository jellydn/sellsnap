import type { FastifyInstance } from "fastify";
import { auth, headersToHeaders } from "../lib/auth";

export async function authRoutes(server: FastifyInstance): Promise<void> {
  server.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const headers = headersToHeaders(
          request.headers as Record<string, string | string[] | undefined>,
        );

        let body: RequestInit["body"] | undefined;
        if (!request.body) {
          body = undefined;
        } else if (typeof request.body === "string") {
          body = request.body;
        } else if (typeof request.body === "object") {
          body = JSON.stringify(request.body);
        }

        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          ...(body ? { body } : {}),
        });

        const response = await auth.handler(req);

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          reply.header(key, value);
        });
        const responseBody = response.body ? await response.text() : "";
        reply.send(responseBody);
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
