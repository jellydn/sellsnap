import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { FastifyRequest } from "fastify";
import { prisma } from "./prisma";

const trustedOrigins = process.env.TRUSTED_ORIGINS?.split(",").map((o) => o.trim()) || [
  "http://localhost:5173",
  "http://localhost:4173",
];

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.API_URL || "http://localhost:3000",
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
}) as ReturnType<typeof betterAuth>;

export function headersToHeaders(
  requestHeaders: Record<string, string | string[] | undefined>,
): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(requestHeaders)) {
    if (value) {
      headers.append(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }
  return headers;
}

export async function getSessionFromRequest(request: FastifyRequest) {
  return auth.api.getSession({
    headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
  });
}
