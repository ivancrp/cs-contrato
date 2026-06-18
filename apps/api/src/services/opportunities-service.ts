import { getRarityByOffset } from '@ct/common';
import { isTradeUpEligibleInputCollection } from '@ct/contracts';
import { createDefaultPriceAggregator } from '@ct/pricing';
import type { Collection, SkinItem } from '@ct/types';
import type { AppContext } from '../app-context.js';

export interface OpportunityItem {
  rank: number;
  targetSkinId: string;
  targetSkinName: string;
  weapon: string;
  rarity: SkinItem['rarity'];
  imageUrl?: string;
  tier: string;
  /** Preço de referência da skin alvo (output FT). */
  referencePrice: number;
  /** Custo estimado do contrato (10 inputs mais baratos). */
  estimatedCost: number;
  /** @deprecated use estimatedCost */
  totalCost: number;
  /** Valor esperado ponderado dos outputs possíveis. */
  expectedValue: number;
  expectedProfit: number;
  roi: number;
  targetChance: number;
  priceSource: string;
  scannedAt: string;
}

interface OpportunityCache {
  items: OpportunityItem[];
  scannedAt: string;
}

let memoryCache: OpportunityCache | null = null;
const CACHE_KEY = 'opportunities:top100:v2';

const RARITY_SCORE: Record<SkinItem['rarity'], number> = {
  consumer: 1,
  industrial: 2,
  'mil-spec': 3,
  restricted: 4,
  classified: 5,
  covert: 6,
  extraordinary: 7,
};

function findTargetCollections(targetSkin: SkinItem, collections: Collection[]): Collection[] {
  return collections.filter((col) => col.items.some((item) => item.id === targetSkin.id));
}

function getOutputPool(targetSkin: SkinItem, collections: Collection[]): SkinItem[] {
  const cols = findTargetCollections(targetSkin, collections);
  const pool: SkinItem[] = [];
  for (const col of cols) {
    for (const item of col.items) {
      if (item.rarity === targetSkin.rarity && item.stattrak === targetSkin.stattrak && !item.souvenir) {
        pool.push(item);
      }
    }
  }
  const seen = new Set<string>();
  return pool.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function getEligibleInputs(targetSkin: SkinItem, collections: Collection[]): SkinItem[] {
  const inputRarity = getRarityByOffset(targetSkin.rarity, -1);
  if (!inputRarity) return [];

  const targetCollectionIds = new Set(findTargetCollections(targetSkin, collections).map((c) => c.id));
  const inputs: SkinItem[] = [];
  const seen = new Set<string>();

  for (const col of collections) {
    for (const item of col.items) {
      if (item.rarity !== inputRarity) continue;
      if (item.stattrak !== targetSkin.stattrak) continue;
      if (item.souvenir) continue;
      if (!isTradeUpEligibleInputCollection(item.collectionId, targetCollectionIds)) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      inputs.push(item);
    }
  }

  return inputs;
}

function computeTargetChance(targetSkin: SkinItem, collections: Collection[]): number {
  const pool = getOutputPool(targetSkin, collections);
  if (pool.length === 0) return 0.05;
  const match = pool.find((s) => s.id === targetSkin.id);
  if (!match) return Math.min(1 / pool.length, 0.5);
  return Math.min(1 / pool.length, 0.5);
}

function computeExpectedValue(outputPool: SkinItem[], priceMap: Map<string, number>): number {
  if (outputPool.length === 0) return 0;
  let sum = 0;
  let counted = 0;
  for (const skin of outputPool) {
    const price = priceMap.get(skin.id);
    if (!price || price <= 0) continue;
    sum += price;
    counted += 1;
  }
  if (counted === 0) return 0;
  return sum / counted;
}

function computeEstimatedCost(inputs: SkinItem[], priceMap: Map<string, number>): number {
  const prices = inputs
    .map((skin) => priceMap.get(skin.id))
    .filter((price): price is number => !!price && price > 0)
    .sort((a, b) => a - b);

  if (prices.length < 10) return 0;

  return prices.slice(0, 10).reduce((sum, price) => sum + price, 0);
}

async function buildPriceMap(
  skins: SkinItem[],
  aggregator: ReturnType<typeof createDefaultPriceAggregator>,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const unique = [...new Map(skins.map((s) => [s.id, s])).values()];
  const batchSize = 10;

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (skin) => {
        const result = await aggregator.getPrice({
          marketHashName: `${skin.name} (Field-Tested)`,
          itemId: skin.id,
          wear: 'Field-Tested',
          stattrak: skin.stattrak,
        });
        if (result?.quote.price && result.quote.price > 0) {
          map.set(skin.id, result.quote.price);
        }
      }),
    );
  }

  return map;
}

function evaluateTarget(
  targetSkin: SkinItem,
  ctx: AppContext,
  priceMap: Map<string, number>,
  scannedAt: string,
): OpportunityItem | null {
  const referencePrice = priceMap.get(targetSkin.id) ?? 0;
  if (referencePrice <= 0) return null;

  const outputPool = getOutputPool(targetSkin, ctx.collections);
  const inputs = getEligibleInputs(targetSkin, ctx.collections);
  const estimatedCost = computeEstimatedCost(inputs, priceMap);
  if (estimatedCost <= 0) return null;

  const expectedValue = computeExpectedValue(outputPool, priceMap);
  if (expectedValue <= 0) return null;

  const targetChance = computeTargetChance(targetSkin, ctx.collections);
  const expectedProfit = expectedValue - estimatedCost;
  const roi = estimatedCost > 0 ? (expectedProfit / estimatedCost) * 100 : 0;

  return {
    rank: 0,
    targetSkinId: targetSkin.id,
    targetSkinName: targetSkin.name,
    weapon: targetSkin.weapon,
    rarity: targetSkin.rarity,
    imageUrl: targetSkin.imageUrl,
    tier: roi > 5 ? 'premium' : roi > 0 ? 'balanced' : 'budget',
    referencePrice: Math.round(referencePrice * 100) / 100,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    totalCost: Math.round(estimatedCost * 100) / 100,
    expectedValue: Math.round(expectedValue * 100) / 100,
    expectedProfit: Math.round(expectedProfit * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    targetChance: Math.round(targetChance * 1000) / 1000,
    priceSource: 'aggregator',
    scannedAt,
  };
}

export async function scanTopOpportunities(
  ctx: AppContext,
  limit = 100,
): Promise<OpportunityCache> {
  const aggregator = createDefaultPriceAggregator(ctx.cache);
  const targets = ctx.skins
    .filter((s) => (s.rarity === 'covert' || s.rarity === 'classified') && !s.stattrak)
    .sort((a, b) => RARITY_SCORE[b.rarity] - RARITY_SCORE[a.rarity] || a.name.localeCompare(b.name))
    .slice(0, Math.min(60, limit));

  const skinsToPrice = new Map<string, SkinItem>();
  for (const target of targets) {
    skinsToPrice.set(target.id, target);
    for (const skin of getOutputPool(target, ctx.collections)) skinsToPrice.set(skin.id, skin);
    for (const skin of getEligibleInputs(target, ctx.collections)) skinsToPrice.set(skin.id, skin);
  }

  const priceMap = await buildPriceMap([...skinsToPrice.values()], aggregator);
  const scannedAt = new Date().toISOString();
  const items: OpportunityItem[] = [];

  for (const skin of targets) {
    const item = evaluateTarget(skin, ctx, priceMap, scannedAt);
    if (item) items.push(item);
  }

  items.sort((a, b) => b.roi - a.roi || b.expectedProfit - a.expectedProfit);
  const ranked = items.slice(0, limit).map((item, index) => ({ ...item, rank: index + 1 }));

  memoryCache = { items: ranked, scannedAt };
  await ctx.cache.set(CACHE_KEY, memoryCache, Number(process.env.CACHE_TTL_OPPORTUNITIES ?? 3600));

  return memoryCache;
}

export async function getOpportunities(
  ctx: AppContext,
  limit = 100,
): Promise<OpportunityCache & { source: 'memory' | 'cache' | 'fresh' }> {
  if (memoryCache?.items.length) {
    return withEnrichedItems(ctx, memoryCache, limit, 'memory');
  }

  const cached = await ctx.cache.get<OpportunityCache>(CACHE_KEY);
  if (cached?.items?.length) {
    memoryCache = cached;
    return withEnrichedItems(ctx, cached, limit, 'cache');
  }

  const fresh = await scanTopOpportunities(ctx, limit);
  return withEnrichedItems(ctx, fresh, limit, 'fresh');
}

export function invalidateOpportunityCache(): void {
  memoryCache = null;
}

function enrichWithCatalog(ctx: AppContext, items: OpportunityItem[]): OpportunityItem[] {
  return items.map((item) => {
    const skin = ctx.skinsById.get(item.targetSkinId);
    if (!skin) return item;
    return {
      ...item,
      imageUrl: item.imageUrl ?? skin.imageUrl,
      rarity: item.rarity ?? skin.rarity,
      weapon: item.weapon || skin.weapon,
    };
  });
}

function withEnrichedItems(
  ctx: AppContext,
  cache: OpportunityCache,
  limit: number,
  source: 'memory' | 'cache' | 'fresh',
): OpportunityCache & { source: typeof source } {
  const items = enrichWithCatalog(ctx, cache.items.slice(0, limit));
  return { ...cache, items, source };
}
