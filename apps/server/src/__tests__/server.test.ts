import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../server";

afterEach(() => vi.unstubAllEnvs());

describe("server security defaults", () => {
  it.each([
    ["", "127.0.0.1", "127.0.0.1"],
    ["127.0.0.1", "127.0.0.1", "192.0.2.10"],
    ["127.0.0.1", "192.0.2.11", "192.0.2.11"],
  ])("uses only explicitly trusted forwarding headers (%s, %s)", async (trusted, peer, expected) => {
    vi.stubEnv("TRUSTED_PROXIES", trusted);
    const server = createServer({ level: "silent" });
    server.get("/ip", (request) => ({ ip: request.ip }));
    try {
      const response = await server.inject({
        url: "/ip",
        remoteAddress: peer,
        headers: { "x-forwarded-for": "192.0.2.10" },
      });
      expect(response.json()).toEqual({ ip: expected });
    } finally {
      await server.close();
    }
  });

  it("redacts download URLs in unmatched paths and methods without disabling request logs", async () => {
    let logs = "";
    const server = createServer({
      stream: {
        write: (line: string) => {
          logs += line;
        },
      },
    });
    const token = randomUUID();
    server.get("/health", () => ({ status: "ok" }));
    try {
      for (const url of [`/api/download/${token}`, `/api/download/${token}/invalid`]) {
        expect((await server.inject({ method: "POST", url })).statusCode).toBe(404);
      }
      expect((await server.inject("/health")).statusCode).toBe(200);
      expect(logs).not.toContain(token);
      expect(logs).toContain("/api/download/[REDACTED]");
      expect(logs).toContain("/health");
      expect(logs).toContain("request completed");
    } finally {
      await server.close();
    }
  });

  it("serves the production SPA fallback without replacing API or upload 404 responses", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const directory = await mkdtemp(join(tmpdir(), "sellsnap-spa-"));
    const html = "<!doctype html><title>SellSnap production fixture</title>";
    const server = createServer({ level: "silent" });
    try {
      await writeFile(join(directory, "index.html"), html);
      await server.register(fastifyStatic, { root: directory, wildcard: false });
      for (const url of ["/", "/purchase/success"]) {
        const response = await server.inject(url);
        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toContain("text/html");
        expect(response.body).toBe(html);
      }
      for (const url of ["/api/download/unknown", "/uploads/missing"]) {
        const response = await server.inject(url);
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({ error: "Not found" });
      }
    } finally {
      await server.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
