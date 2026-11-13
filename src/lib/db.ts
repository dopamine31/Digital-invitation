import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL, max: 12 });
  return new PrismaClient({
    adapter,
    log: env().NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as typeof globalThis & { __rasaPrisma?: PrismaClient };

/** Client platform (tanpa scope tenant). Hanya untuk tabel platform & proses sistem. */
export const prisma: PrismaClient = globalForPrisma.__rasaPrisma ?? createClient();
if (env().NODE_ENV !== "production") globalForPrisma.__rasaPrisma = prisma;
