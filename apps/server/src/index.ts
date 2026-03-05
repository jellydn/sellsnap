import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ensureUploadDirs, IMAGES_DIR } from "./lib/upload";
import { analyticsRoutes } from "./routes/analytics";
import { authRoutes } from "./routes/auth";
import { checkoutRoutes } from "./routes/checkout";
import { creatorRoutes } from "./routes/creators";
import { healthRoutes } from "./routes/health";
import { productRoutes } from "./routes/products";
import { profileRoutes } from "./routes/profile";
import { purchaseRoutes } from "./routes/purchases";
import { webhookRoutes } from "./routes/webhooks";

ensureUploadDirs();

const server = Fastify();

async function start() {
  const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
  await server.register(cors, {
    origin: allowedOrigins || true,
    credentials: true,
  });

  await server.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await server.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      try {
        request.body = body;
        done(null, body as object);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  await server.register(await import("@fastify/static"), {
    root: IMAGES_DIR,
    prefix: "/uploads/images/",
    decorateReply: false,
  });

  await server.register(healthRoutes);
  await server.register(authRoutes);
  await server.register(productRoutes);
  await server.register(creatorRoutes);
  await server.register(checkoutRoutes);
  await server.register(webhookRoutes);
  await server.register(purchaseRoutes);
  await server.register(profileRoutes);
  await server.register(analyticsRoutes);

  try {
    await server.listen({ port: 3000 });
    console.log("Server running at http://localhost:3000");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
