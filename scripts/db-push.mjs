import { config } from 'dotenv';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definido. Copie .env.example → .env e configure o Neon.');
  process.exit(1);
}

execSync('npx prisma db push --schema=prisma/schema.prisma', {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});
