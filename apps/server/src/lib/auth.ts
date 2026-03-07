import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { FastifyRequest } from "fastify";
import { prisma } from "./prisma";

export const auth = betterAuth({
  baseURL: process.env.FRONTEND_URL || "http://localhost:5173",
  trustedOrigins: ["http://localhost:5173", "http://localhost:4173"],
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
