import type { VercelRequest, VercelResponse } from '@vercel/node';

/** GET /api/health — resposta rápida para o banner (sem cold start do Fastify) */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ status: 'ok', version: '0.1.0' });
}
