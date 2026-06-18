import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance | null = null;

export async function getFastifyApp(): Promise<FastifyInstance> {
  if (!app) {
    const { buildApp } = await import('../../apps/api/dist/index.js');
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function proxyToFastify(
  req: VercelRequest,
  res: VercelResponse,
  fastifyPath: string,
) {
  const fastify = await getFastifyApp();
  const [pathname, query = ''] = fastifyPath.split('?');
  const url = query ? `${pathname}?${query}` : pathname;

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
}

export function resolvePathFromQuery(req: VercelRequest): string {
  const pathParam = req.query.path;
  if (!pathParam) return '/';
  const segments = Array.isArray(pathParam) ? pathParam.join('/') : String(pathParam);
  return `/${segments.replace(/^\/+/, '')}`;
}
