import { createDefaultPriceAggregator } from '@ct/pricing';
import type { SkinItem } from '@ct/types';
import type { AppContext } from '../app-context.js';

export interface OpportunityItem {
  rank: number;
  targetSkinId: string;
  targetSkinName: string;
  weapon: string;
  rarity: SkinItem['rarity'];
  tier: string;
  roi: number;
  expectedProfit: number;
  totalCost: number;
  targetChance: number;
  priceSource: string;
  scannedAt: string;
}

interface OpportunityCache {
  items: OpportunityItem[];
  scannedAt: string;
}

let memoryCache: OpportunityCache | null = null;
const CACHE_KEY = 'opportunities:top100';

const RARITY_SCORE: Record<SkinItem['rarity'], number> = {
  consumer: 1,
  industrial: 2,
  'mil-spec': 3,
  restricted: 4,
  classified: 5,
  covert: 6,
  extraordinary: 7,
};

function estimateTargetChance(skin: SkinItem, collections: AppContext['collections']): number {
  const col = collections.find((c) => c.items.some((i) => i.id === skin.id));
  if (!col) return 0.05;
  const outputs = col.items.filter(
    (i) => i.rarity === skin.rarity && i.stattrak === skin.stattrak,
  );
  if (outputs.length === 0) return 0.05;
  return Math.min(1 / outputs.length, 0.5);
}

export async function scanTopOpportunities(
  ctx: AppContext,
  limit = 100,
): Promise<OpportunityCache> {
  const aggregator = createDefaultPriceAggregator(ctx.cache);
  const targets = ctx.skins
    .filter((s) => (s.rarity === 'covert' || s.rarity === 'classified') && !s.stattrak)
    .sort((a, b) => RARITY_SCORE[b.rarity] - RARITY_SCORE[a.rarity] || a.name.localeCompare(b.name))
    .slice(0, Math.min(120, limit * 2));

  const items: OpportunityItem[] = [];
  const scannedAt = new Date().toISOString();

  for (const skin of targets) {
    const priceResult = await aggregator.getPrice({
      marketHashName: `${skin.name} (Field-Tested)`,
      itemId: skin.id,
      wear: 'Field-Tested',
      stattrak: false,
    });

    const outputPrice = priceResult?.quote.price ?? 0;
    if (outputPrice <= 0) continue;

    const inputCost = outputPrice * (skin.rarity === 'covert' ? 0.12 : 0.08);
    const totalCost = inputCost * 10;
    const targetChance = estimateTargetChance(skin, ctx.collections);
    const expectedValue = outputPrice * targetChance + outputPrice * 0.3 * (1 - targetChance);
    const expectedProfit = expectedValue - totalCost;
    const roi = totalCost > 0 ? (expectedProfit / totalCost) * 100 : 0;

    items.push({
      rank: 0,
      targetSkinId: skin.id,
      targetSkinName: skin.name,
      weapon: skin.weapon,
      rarity: skin.rarity,
      tier: roi > 5 ? 'premium' : roi > 0 ? 'balanced' : 'budget',
      roi: Math.round(roi * 100) / 100,
      expectedProfit: Math.round(expectedProfit * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      targetChance: Math.round(targetChance * 1000) / 1000,
      priceSource: priceResult?.provider ?? 'unknown',
      scannedAt,
    });
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
    return {
      ...memoryCache,
      items: memoryCache.items.slice(0, limit),
      source: 'memory',
    };
  }

  const cached = await ctx.cache.get<OpportunityCache>(CACHE_KEY);
  if (cached?.items?.length) {
    memoryCache = cached;
    return { ...cached, items: cached.items.slice(0, limit), source: 'cache' };
  }

  const fresh = await scanTopOpportunities(ctx, limit);
  return { ...fresh, items: fresh.items.slice(0, limit), source: 'fresh' };
}

export function invalidateOpportunityCache(): void {
  memoryCache = null;
}
