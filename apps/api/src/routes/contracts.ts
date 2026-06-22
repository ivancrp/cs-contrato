import type { FastifyInstance } from 'fastify';
import { defaultRuleRegistry } from '@ct/contracts';
import { createDefaultPriceAggregator } from '@ct/pricing';
import type { ContractInput } from '@ct/types';
import type { AppContext } from '../app-context.js';
import { buildContractWithMarketPrices } from '../services/contract-service.js';
import {
  loadSharedContract,
  saveSharedContract,
  type SharedContractPayload,
} from '../services/saved-contract-service.js';
import {
  normalizeCollectionsForTradeUp,
  withTradeUpStatTrak,
} from '../services/trade-up-helpers.js';

export async function registerContractRoutes(
  app: FastifyInstance,
  getContext: () => Promise<AppContext>,
): Promise<void> {
  app.post('/contracts/share', async (req, reply) => {
    const body = req.body as Omit<SharedContractPayload, 'version' | 'savedAt'>;
    if (!body?.targetSkin?.id || !body?.contract?.inputs?.length) {
      return reply.status(400).send({ error: 'Payload de contrato inválido' });
    }

    const ctx = await getContext();
    const { id } = await saveSharedContract(ctx.cache, body);
    return { id };
  });

  app.get('/contracts/share/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ctx = await getContext();
    const payload = await loadSharedContract(ctx.cache, id);
    if (!payload) {
      return reply.status(404).send({ error: 'Contrato compartilhado não encontrado ou expirado' });
    }
    return payload;
  });

  app.post('/contracts/build', async (req, reply) => {
    const body = req.body as {
      inputs: ContractInput[];
      targetSkinId: string;
      ruleId?: string;
      stattrak?: boolean;
    };

    const ctx = await getContext();
    const baseTarget = ctx.skinsById.get(body.targetSkinId);
    if (!baseTarget) return reply.status(404).send({ error: 'Skin alvo não encontrada' });

    const wantsStatTrak =
      body.stattrak ?? body.inputs.some((input) => input.item.stattrak) ?? baseTarget.stattrak;
    const targetSkin = withTradeUpStatTrak(baseTarget, wantsStatTrak) ?? baseTarget;
    const tradeUpCollections = normalizeCollectionsForTradeUp(
      ctx.collections,
      targetSkin.stattrak,
      !!targetSkin.souvenir,
    );

    const rule = defaultRuleRegistry.getOrThrow(body.ruleId ?? 'cs2_weapon_10');
    const aggregator = createDefaultPriceAggregator(ctx.cache);

    try {
      const contract = await buildContractWithMarketPrices({
        inputs: body.inputs,
        targetSkin,
        rule,
        collections: tradeUpCollections,
        priceAggregator: aggregator,
      });
      return contract;
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });
}
