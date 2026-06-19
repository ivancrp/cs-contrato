import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app-context.js';
import { getStatTrakComparisons } from '../services/stattrak-service.js';
import type { WearTier } from '@ct/types';

export async function registerStatTrakRoutes(
  app: FastifyInstance,
  getContext: () => Promise<AppContext>,
): Promise<void> {
  app.get('/stattrak/compare', async (req) => {
    const query = req.query as { limit?: string; wear?: string };
    const limit = Math.min(Number(query.limit ?? 100) || 100, 200);
    const wear = (query.wear as WearTier | undefined) ?? 'Field-Tested';
    const ctx = await getContext();
    const items = await getStatTrakComparisons(ctx, { limit, wear });

    return {
      items,
      total: items.length,
      wear,
      currency: 'BRL',
      note: 'StatTrak™ mais barato que normal — preços Steam SCM (ByMykel) em BRL',
    };
  });
}
