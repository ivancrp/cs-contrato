import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app-context.js';
import { searchTradeUpContracts } from '../services/trade-up-search-service.js';
import type { TradeUpSearchParams } from '../services/trade-up-helpers.js';

export async function registerTradeUpRoutes(
  app: FastifyInstance,
  getContext: () => Promise<AppContext>,
): Promise<void> {
  app.post('/trade-up/search', async (req, reply) => {
    const body = req.body as TradeUpSearchParams;

    if (!body.skinName && !body.targetSkinId) {
      return reply.status(400).send({ error: 'skinName ou targetSkinId é obrigatório' });
    }

    try {
      const ctx = await getContext();
      const result = await searchTradeUpContracts(ctx, {
        skinName: body.skinName ?? '',
        targetSkinId: body.targetSkinId,
        stattrak: body.stattrak ?? false,
        wear: body.wear ?? 'Field-Tested',
        maxFloat: body.maxFloat,
        budget: body.budget,
        marketplace: body.marketplace ?? 'csfloat',
      });
      return result;
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });
}
