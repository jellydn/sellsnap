import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { logger } from "@sellsnap/logger";
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

const server = Fastify({
  logger: true,
});

async function start() {
  await server.register(helmet, {
    contentSecurityPolicy: false,
  });

  const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
  await server.register(cors, {
    origin: allowedOrigins || false,
    credentials: true,
  });

  await server.register(rateLimit, {
    max: process.env.NODE_ENV === "test" ? 1000 : 100,
    timeWindow: "1 minute",
  });

  await server.register(multipart, {
    limits: {
      fileSize: parseInt(process.env.MAX_UPLOAD_SIZE || "10485760", 10),
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
    const port = parseInt(process.env.PORT || "3000", 10);
    const host = process.env.HOST || "0.0.0.0";
    await server.listen({ port, host });
    logger.success(`Server running at http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
