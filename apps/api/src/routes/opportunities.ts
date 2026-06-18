import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app-context.js';
import {
  getOpportunities,
  invalidateOpportunityCache,
  scanTopOpportunities,
} from '../services/opportunities-service.js';

export async function registerOpportunitiesRoutes(
  app: FastifyInstance,
  getContext: () => Promise<AppContext>,
): Promise<void> {
  app.get('/opportunities', async (req) => {
    const query = req.query as { limit?: string };
    const limit = Math.min(Number(query.limit ?? 100), 100);
    const ctx = await getContext();
    const data = await getOpportunities(ctx, limit);
    return {
      items: data.items,
      total: data.items.length,
      scannedAt: data.scannedAt,
      source: data.source,
      note: 'Ranking heurístico — Fase 3 adicionará scanner de mercado contínuo',
    };
  });

  app.post('/opportunities/scan', async (req, reply) => {
    const adminKey = process.env.API_ADMIN_KEY;
    if (adminKey) {
      const header = req.headers['x-api-key'];
      if (header !== adminKey) {
        return reply.status(401).send({ error: 'Não autorizado' });
      }
    }

    const body = (req.body ?? {}) as { limit?: number };
    const limit = Math.min(body.limit ?? 100, 100);
    try {
      const ctx = await getContext();
      invalidateOpportunityCache();
      const data = await scanTopOpportunities(ctx, limit);
      const { evaluateAlerts } = await import('./alerts.js');
      const triggered = await evaluateAlerts(ctx.cache, data.items);
      return { ok: true, total: data.items.length, scannedAt: data.scannedAt, alertsTriggered: triggered.length };
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}
