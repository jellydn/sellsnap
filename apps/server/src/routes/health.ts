import type { FastifyInstance } from "fastify";

export async function healthRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/health", async () => {
    return { status: "ok" };
  });

  server.get("/health.json", async () => {
    return { status: "ok" };
  });
}
