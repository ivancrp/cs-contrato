import { neon, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL;

  if (!url) {
    throw new Error(
      'DATABASE_URL não configurada. Defina no arquivo .env antes de usar o banco.',
    );
  }

  return url;
}

export const sql = neon(getDatabaseUrl());
