import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';

describe('API integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health retorna status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string; version: string };
    expect(body.status).toBe('ok');
    expect(body.version).toBeTruthy();
  });

  it('GET /catalog retorna coleções', async () => {
    const res = await app.inject({ method: 'GET', url: '/catalog' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { collections: unknown[]; totalSkins: number; source: string };
    expect(body.totalSkins).toBeGreaterThan(0);
    expect(body.collections.length).toBeGreaterThan(0);
    expect(['prisma', 'cache', 'parser']).toContain(body.source);
  });

  it('GET /contracts/rules lista regras CS2', async () => {
    const res = await app.inject({ method: 'GET', url: '/contracts/rules' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { rules: Array<{ id: string; inputCount: number }> };
    expect(body.rules.some((r) => r.id === 'cs2_weapon_10')).toBe(true);
  });

  it('GET /search?q=ak retorna skins', async () => {
    const res = await app.inject({ method: 'GET', url: '/search?q=ak&limit=5' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { results: unknown[] };
    expect(body.results.length).toBeGreaterThan(0);
  });

  it('GET /opportunities retorna lista ranqueada', async () => {
    const res = await app.inject({ method: 'GET', url: '/opportunities?limit=10' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('POST /trade-up/search valida payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/trade-up/search',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
