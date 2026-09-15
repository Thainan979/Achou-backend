import { PrismaClient } from "@prisma/client";

// Evita criar uma conexão nova a cada requisição em ambiente serverless
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
