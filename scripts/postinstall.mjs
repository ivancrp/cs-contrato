import { execSync } from 'node:child_process';

/** Frontend Next.js na Vercel — prisma generate roda no vercel-build (build:packages) */
if (process.env.VERCEL) {
  console.log('[postinstall] Vercel: pulando prisma generate (vercel-build gera o client)');
  process.exit(0);
}

execSync('npm run db:generate -w @ct/api', { stdio: 'inherit' });
