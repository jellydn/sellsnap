import type { FastifyInstance } from "fastify";
import { auth, headersToHeaders } from "../lib/auth";

const AUTH_API_MAP: Record<string, string> = {
  "sign-up/email": "signUpEmail",
  "sign-in/email": "signInEmail",
  "sign-out": "signOut",
  "get-session": "getSession",
  "get-current-session": "getCurrentSession",
  session: "getSession",
};

export async function authRoutes(server: FastifyInstance): Promise<void> {
  server.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const path = request.url.replace(/^\/api\/auth\/?/, "");
        const headers = headersToHeaders(
          request.headers as Record<string, string | string[] | undefined>,
        );

        let body: Record<string, unknown> | undefined;
        if (request.body && typeof request.body === "object") {
          body = request.body as Record<string, unknown>;
        }

        const methodName = AUTH_API_MAP[path];
        if (!methodName) {
          return reply.status(404).send({ error: "Not found", path });
        }

        const authApi = auth.api as unknown as Record<
          string,
          (options: {
            body?: Record<string, unknown>;
            headers: Headers;
            query?: Record<string, unknown>;
            asResponse?: boolean;
          }) => Promise<unknown>
        >;

        const response = await authApi[methodName]({
          body,
          headers,
          asResponse: true,
        });

        const res = response as Response;
        reply.status(res.status);
        res.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "content-encoding") {
            reply.header(key, value);
          }
        });
        const responseBody = res.body ? await res.text() : "";
        return reply.send(responseBody);
      } catch (error) {
        request.server.log.error(error);
        return reply.status(500).send({
          error: "Internal authentication error",
          code: "AUTH_FAILURE",
        });
      }
    },
  });
}
