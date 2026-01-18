import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  // Check if using Prisma Accelerate/Prisma Postgres URL
  if (connectionString.startsWith('prisma+postgres://')) {
    return new PrismaClient({
      accelerateUrl: connectionString,
    });
  }

  // For standard PostgreSQL URLs, use the pg adapter
  const pool = new pg.Pool({
    connectionString,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
