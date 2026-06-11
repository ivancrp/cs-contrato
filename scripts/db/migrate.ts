import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { neon, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

config();

neonConfig.webSocketConstructor = ws;

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const url =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL;

  if (!url) {
    throw new Error('DATABASE_URL não encontrada no .env');
  }

  const sql = neon(url);
  const migrationPath = join(__dirname, '../../db/migrations/001_create_skins.sql');
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const migration2Path = join(__dirname, '../../db/migrations/002_fix_skins_unique_index.sql');
  const migration2Sql = readFileSync(migration2Path, 'utf8');

  const statements = [migrationSql, migration2Sql]
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }

  const tables = await sql<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('collections', 'skins')
    ORDER BY tablename
  `;

  console.log('Migration concluída.');
  console.log('Tabelas:', tables.map((t) => t.tablename).join(', '));
}

migrate().catch((error) => {
  console.error('Erro na migration:', error);
  process.exit(1);
});
