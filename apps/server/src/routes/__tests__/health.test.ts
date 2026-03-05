import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { healthRoutes } from "../health";

describe("health routes", () => {
  it("GET /api/health returns ok", async () => {
    const app = Fastify();
    await app.register(healthRoutes);

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
