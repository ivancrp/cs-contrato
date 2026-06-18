import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    const { buildApp } = await import('../apps/api/dist/index.js');
    app = await buildApp();
    await app.ready();
  }
  return app;
}

/** Encaminha /api/* para o Fastify (@ct/api) via inject (serverless). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const fastify = await getApp();

    const rawUrl = req.url ?? '/';
    const [pathname, query = ''] = rawUrl.split('?');
    const fastifyPath = pathname.replace(/^\/api/, '') || '/';
    const url = query ? `${fastifyPath}?${query}` : fastifyPath;

    const response = await fastify.inject({
      method: (req.method ?? 'GET').toUpperCase() as 'GET',
      url,
      headers: req.headers as Record<string, string>,
      payload: req.body,
    });

    res.status(response.statusCode);
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined) {
        res.setHeader(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }
    res.send(response.body);
  } catch (err) {
    console.error('[api] handler error:', err);
    res.status(500).json({
      error: 'Erro interno da API',
      detail: process.env.NODE_ENV === 'development' ? String(err) : undefined,
    });
  }
}
