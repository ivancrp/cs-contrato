import { execSync } from 'node:child_process';

/** Frontend estático na Vercel não precisa gerar Prisma Client */
if (process.env.VERCEL) {
  console.log('[postinstall] Vercel: pulando prisma generate (deploy do frontend)');
  process.exit(0);
}

execSync('npm run db:generate -w @ct/api', { stdio: 'inherit' });
