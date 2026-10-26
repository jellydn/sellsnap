import { randomUUID } from "node:crypto";
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
});
