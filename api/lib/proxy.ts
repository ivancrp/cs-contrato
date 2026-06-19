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

/** Monta URL do Fastify preservando query params do request Vercel (exceto `path`). */
export function buildFastifyUrl(req: VercelRequest, fastifyPath: string): string {
  const pathname = fastifyPath.split('?')[0] || '/';
  const params = new URLSearchParams();

  const embeddedQuery = fastifyPath.includes('?') ? fastifyPath.slice(fastifyPath.indexOf('?') + 1) : '';
  if (embeddedQuery) {
    for (const [key, value] of new URLSearchParams(embeddedQuery)) {
      params.append(key, value);
    }
  }

  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (key === 'path' || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, String(entry));
    } else {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export async function proxyToFastify(
  req: VercelRequest,
  res: VercelResponse,
  fastifyPath: string,
) {
  const fastify = await getFastifyApp();
  const url = buildFastifyUrl(req, fastifyPath);

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
