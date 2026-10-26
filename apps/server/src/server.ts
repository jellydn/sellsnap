import Fastify, { type FastifyInstance, type FastifyLoggerOptions } from "fastify";

export function createServer(loggerOptions: FastifyLoggerOptions = {}): FastifyInstance {
  const server = Fastify({
    trustProxy:
      process.env.TRUSTED_PROXIES?.split(",")
        .map((ip) => ip.trim())
        .filter(Boolean) ?? [],
    logger: {
      ...loggerOptions,
      serializers: {
        ...loggerOptions.serializers,
        req(request) {
          return {
            method: request.method,
            url: request.url.startsWith("/api/download/")
              ? "/api/download/[REDACTED]"
              : request.url,
            ip: request.ip,
          };
        },
      },
    },
  });

  // Fastify's default 404 handler logs the raw URL in its message as well as req.url.
  server.setNotFoundHandler((_request, reply) => reply.status(404).send({ error: "Not found" }));
  return server;
}
