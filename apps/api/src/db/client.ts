import { createRequire } from 'node:module';
import type { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Cliente Prisma lazy — só instancia quando necessário (ex.: /catalog/sync).
 * Requer `npm run db:generate` antes do primeiro uso com banco.
 */
export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const { PrismaClient } = require('@prisma/client') as {
    PrismaClient: new (args?: { log?: ('error' | 'warn')[] }) => PrismaClient;
  };

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }

  return client;
}
