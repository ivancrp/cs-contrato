import { createCacheAdapter } from '@ct/common';
import { refreshTradeUpCollectionEligibility } from '@ct/contracts';
import { defaultRuleRegistry } from '@ct/contracts';
import { buildTradeUpContract } from '@ct/engine';
import { buildContractWithMarketPrices } from './services/contract-service.js';
import { loadCatalog } from './services/catalog-service.js';
import { createDefaultPriceAggregator } from '@ct/pricing';
import { optimize } from '@ct/optimizer';
import { registerTradeUpRoutes } from './routes/trade-up.js';
import { registerRiskRoutes } from './routes/risk.js';
import { registerSimulationRoutes } from './routes/simulate.js';
import type {
  ContractInput,
  OptimizationStrategy,
} from '@ct/types';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import type { AppContext } from './app-context.js';

let context: AppContext | null = null;

export function invalidateAppContext(): void {
  context = null;
}

async function getContext(): Promise<AppContext> {
  if (context) return context;

  await refreshTradeUpCollectionEligibility();

  const cache = await createCacheAdapter();
  const catalog = await loadCatalog(cache);

  context = {
    cache,
    collections: catalog.collections,
    skins: catalog.skins,
    catalogSource: catalog.source,
    skinsById: new Map(catalog.skins.map((s) => [s.id, s])),
  };

  return context;
}

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get('/health', async () => {
    const ctx = await getContext();
    return {
      status: 'ok',
      version: '0.1.0',
      catalogSource: ctx.catalogSource,
      redis: Boolean(process.env.REDIS_URL),
      database: Boolean(process.env.DATABASE_URL),
    };
  });

  app.post('/catalog/sync', async (_req, reply) => {
    if (!process.env.DATABASE_URL) {
      return reply.status(503).send({ error: 'DATABASE_URL não configurado' });
    }
    try {
      const { CatalogRepository } = await import('./repositories/catalog-repository.js');
      const repo = new CatalogRepository();
      const result = await repo.syncFromParser();
      invalidateAppContext();
      return { ok: true, ...result };
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.get('/catalog', async () => {
    const ctx = await getContext();
    return {
      collections: ctx.collections,
      totalSkins: ctx.skins.length,
      source: ctx.catalogSource,
    };
  });

  app.get('/skins', async (req) => {
    const ctx = await getContext();
    const query = req.query as { q?: string; limit?: string };
    const limit = Number(query.limit ?? 50);
    let results = ctx.skins;

    if (query.q) {
      const q = query.q.toLowerCase();
      results = results.filter(
        (s) => s.name.toLowerCase().includes(q) || s.weapon.toLowerCase().includes(q),
      );
    }

    return { total: results.length, items: results.slice(0, limit) };
  });

  app.get('/skins/:id', async (req, reply) => {
    const ctx = await getContext();
    const { id } = req.params as { id: string };
    const skin = ctx.skinsById.get(id);
    if (!skin) return reply.status(404).send({ error: 'Skin não encontrada' });
    return skin;
  });

  app.get('/boxes', async () => {
    const cache = (await getContext()).cache;
    const crates = await cache.get<unknown[]>('crates');
    return { items: crates ?? [], note: 'Drop rates com source metadata — nunca estimativas como oficiais' };
  });

  app.get('/contracts/rules', async () => {
    return { rules: defaultRuleRegistry.list() };
  });

  app.post('/contracts/build', async (req, reply) => {
    const body = req.body as {
      inputs: ContractInput[];
      targetSkinId: string;
      ruleId?: string;
    };

    const ctx = await getContext();
    const targetSkin = ctx.skinsById.get(body.targetSkinId);
    if (!targetSkin) return reply.status(404).send({ error: 'Skin alvo não encontrada' });

    const rule = defaultRuleRegistry.getOrThrow(body.ruleId ?? 'cs2_weapon_10');
    const aggregator = createDefaultPriceAggregator(ctx.cache);

    try {
      const contract = await buildContractWithMarketPrices({
        inputs: body.inputs,
        targetSkin,
        rule,
        collections: ctx.collections,
        priceAggregator: aggregator,
      });
      return contract;
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  await registerSimulationRoutes(app);
  await registerRiskRoutes(app);
  await registerTradeUpRoutes(app, getContext);

  app.get('/search', async (req) => {
    const query = req.query as { q: string; type?: string };
    const ctx = await getContext();
    const q = (query.q ?? '').toLowerCase();

    const skins = ctx.skins.filter(
      (s) => s.name.toLowerCase().includes(q) || s.weapon.toLowerCase().includes(q),
    );

    return { query: query.q, type: query.type ?? 'skin', results: skins.slice(0, 100) };
  });

  app.get('/prices', async (req, reply) => {
    const query = req.query as { name: string; wear?: string; float?: string };
    if (!query.name) return reply.status(400).send({ error: 'name é obrigatório' });

    const ctx = await getContext();
    const aggregator = createDefaultPriceAggregator(ctx.cache);
    const result = await aggregator.getPrice({
      marketHashName: query.name,
      wear: query.wear as ContractInput['listing']['wear'],
      float: query.float ? Number(query.float) : undefined,
    });

    if (!result) return reply.status(404).send({ error: 'Preço não encontrado' });
    return result;
  });

  app.post('/optimizer', async (req, reply) => {
    const body = req.body as {
      targetSkinId: string;
      ruleId?: string;
      strategy?: OptimizationStrategy;
      budget?: number;
      candidates: { listing: ContractInput['listing']; itemId: string }[];
    };

    const ctx = await getContext();
    const targetSkin = ctx.skinsById.get(body.targetSkinId);
    if (!targetSkin) return reply.status(404).send({ error: 'Skin alvo não encontrada' });

    const rule = defaultRuleRegistry.getOrThrow(body.ruleId ?? 'cs2_weapon_10');

    const candidates = body.candidates
      .map((c) => {
        const item = ctx.skinsById.get(c.itemId);
        if (!item) return null;
        return { listing: c.listing, item };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const result = optimize({
      candidates,
      inputCount: rule.inputCount,
      targetSkinId: body.targetSkinId,
      strategy: body.strategy ?? 'max_ev',
      budget: body.budget,
      outputsForSelection: (inputs) => {
        try {
          const contract = buildTradeUpContract({
            inputs,
            targetSkin,
            rule,
            collections: ctx.collections,
            priceLookup: () => 10,
          });
          return contract.outputs;
        } catch {
          return [];
        }
      },
    });

    return result;
  });

  app.get('/opportunities', async () => {
    return {
      items: [],
      note: 'Fase 3 — ranking TOP 100 será implementado com scanner de mercado',
    };
  });

  return app;
}

async function main() {
  const app = await buildApp();
  const port = Number(process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? '0.0.0.0';
  await app.listen({ port, host });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}
