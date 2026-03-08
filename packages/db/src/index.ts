import { PrismaClient } from "@prisma/client";

// PrismaClient automatically reads DATABASE_URL from the environment
// See schema.prisma: datasource db { url = env("DATABASE_URL") }
export const prisma = new PrismaClient();
