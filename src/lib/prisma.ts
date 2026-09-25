import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "@/generated/prisma/client";

// Ensure Node.js environments (GitHub Actions, CLI scripts, Server Components)
// use the robust 'ws' WebSocket constructor for Neon serverless database connections
if (typeof WebSocket === "undefined" || !neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be configured.");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({ adapter });
}

// In development, ensure any cached global instance has the latest generated models
const existingPrisma = globalForPrisma.prisma;
export const prisma =
  existingPrisma && "micromSheetActiveSnapshot" in existingPrisma
    ? existingPrisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
