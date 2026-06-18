import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Health leve para o frontend (sem carregar Fastify). */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'ok',
    version: process.env.npm_package_version ?? '0.1.0',
    service: 'cs-contrato-api',
  });
}
