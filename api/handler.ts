import type { VercelRequest, VercelResponse } from '@vercel/node';
import { proxyToFastify, resolvePathFromQuery } from './lib/proxy.js';

/**
 * Proxy da API backend.
 * Rewrite: /api/backend/:path* → /api/handler?path=:path*
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const fastifyPath = resolvePathFromQuery(req);
    await proxyToFastify(req, res, fastifyPath);
  } catch (err) {
    console.error('[api/handler]', err);
    res.status(500).json({
      error: 'Erro interno da API',
      detail: process.env.VERCEL_ENV === 'development' ? String(err) : undefined,
    });
  }
}
