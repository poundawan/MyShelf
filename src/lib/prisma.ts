import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Petit pool par instance : chaque fonction serverless ouvre le sien, et le
// budget de connexions côté Supabase (pooler) est partagé entre toutes les
// instances actives — mieux vaut plusieurs petits pools qu'un seul gros.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10_000,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
