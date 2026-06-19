import { getRarityByOffset } from '@ct/common';
import { isTradeUpEligibleInputCollection } from '@ct/contracts';
import { loadBulkSteamPricesBrl, fetchCsfloatListings } from '@ct/pricing';
import type { Collection, SkinItem, WearTier } from '@ct/types';
import type { AppContext } from '../app-context.js';
import { buildMarketHashName } from './trade-up-helpers.js';
import { generateInspectLinkForSkin } from './inspect-link-service.js';

export interface WearPriceMap {
  FN?: number;
  MW?: number;
  FT?: number;
  WW?: number;
  BS?: number;
}

export interface OpportunityItem {
  rank: number;
  targetSkinId: string;
  targetSkinName: string;
  weapon: string;
  rarity: SkinItem['rarity'];
  imageUrl?: string;
  tier: string;
  referenceWear: WearTier;
  referenceMarketHash: string;
  referencePrice: number;
  wearPrices: WearPriceMap;
  estimatedCost: number;
  /** Skin input mais barata usada no cálculo (10×). */
  costInputSkin?: string;
  costInputPrice?: number;
  collectionName?: string;
  /** @deprecated use estimatedCost */
  totalCost: number;
  expectedValue: number;
  expectedProfit: number;
  roi: number;
  targetChance: number;
  priceSource: string;
  priceSourceUrl: string;
  inspectLink?: string;
  scannedAt: string;
}

interface OpportunityCache {
  items: OpportunityItem[];
  scannedAt: string;
}

let memoryCache: OpportunityCache | null = null;
const CACHE_KEY = 'opportunities:top100:v4';

const WEAR_TIERS: WearTier[] = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred',
];

const WEAR_ABBR: Record<WearTier, keyof WearPriceMap> = {
  'Factory New': 'FN',
  'Minimal Wear': 'MW',
  'Field-Tested': 'FT',
  'Well-Worn': 'WW',
  'Battle-Scarred': 'BS',
};

const REFERENCE_WEAR: WearTier = 'Field-Tested';

const RARITY_SCORE: Record<SkinItem['rarity'], number> = {
  consumer: 1,
  industrial: 2,
  'mil-spec': 3,
  restricted: 4,
  classified: 5,
  covert: 6,
  extraordinary: 7,
};

function steamMarketUrl(marketHashName: string): string {
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketHashName)}`;
}

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

function catalogPrice(
  catalog: Map<string, number>,
  skin: SkinItem,
  wear: WearTier = REFERENCE_WEAR,
): number | undefined {
  const hash = buildMarketHashName(skin.name, skin.stattrak, wear);
  const price = catalog.get(hash);
  return price && price > 0 ? price : undefined;
}

function computeExpectedValue(
  outputPool: SkinItem[],
  catalog: Map<string, number>,
): number {
  if (outputPool.length === 0) return 0;
  let sum = 0;
  let counted = 0;
  for (const skin of outputPool) {
    const price = catalogPrice(catalog, skin, REFERENCE_WEAR);
    if (!price) continue;
    sum += price;
    counted += 1;
  }
  if (counted === 0) return 0;
  return sum / counted;
}

/** Custo = 10× input classified mais barato da coleção da skin alvo. */
function computeEstimatedCost(
  targetSkin: SkinItem,
  collections: Collection[],
  inputs: SkinItem[],
  catalog: Map<string, number>,
): { cost: number; costInputSkin?: string; costInputPrice?: number; collectionName?: string } {
  const targetCols = findTargetCollections(targetSkin, collections);
  const targetColIds = new Set(targetCols.map((c) => c.id));
  const pool = inputs.filter((i) => targetColIds.has(i.collectionId));

  let cheapestPrice = Infinity;
  let cheapestSkin: SkinItem | undefined;

  for (const skin of pool) {
    const price = catalogPrice(catalog, skin, REFERENCE_WEAR);
    if (price && price > 0 && price < cheapestPrice) {
      cheapestPrice = price;
      cheapestSkin = skin;
    }
  }

  if (!cheapestSkin || !Number.isFinite(cheapestPrice)) {
    return { cost: 0 };
  }

  const collectionName =
    targetCols.find((c) => c.id === cheapestSkin!.collectionId)?.name ?? targetCols[0]?.name;

  return {
    cost: Math.round(cheapestPrice * 10 * 100) / 100,
    costInputSkin: cheapestSkin.name,
    costInputPrice: Math.round(cheapestPrice * 100) / 100,
    collectionName: collectionName !== cheapestSkin.collectionId ? collectionName : undefined,
  };
}

function buildWearPrices(targetSkin: SkinItem, catalog: Map<string, number>): WearPriceMap {
  const wearPrices: WearPriceMap = {};
  for (const wear of WEAR_TIERS) {
    const price = catalogPrice(catalog, targetSkin, wear);
    if (price) wearPrices[WEAR_ABBR[wear]] = Math.round(price * 100) / 100;
  }
  return wearPrices;
}

function evaluateTarget(
  targetSkin: SkinItem,
  ctx: AppContext,
  catalog: Map<string, number>,
  scannedAt: string,
): OpportunityItem | null {
  const referenceMarketHash = buildMarketHashName(targetSkin.name, targetSkin.stattrak, REFERENCE_WEAR);
  const referencePrice = catalog.get(referenceMarketHash) ?? 0;
  if (referencePrice <= 0) return null;

  const outputPool = getOutputPool(targetSkin, ctx.collections);
  const inputs = getEligibleInputs(targetSkin, ctx.collections);
  const costMeta = computeEstimatedCost(targetSkin, ctx.collections, inputs, catalog);
  if (costMeta.cost <= 0) return null;

  const expectedValue = computeExpectedValue(outputPool, catalog);
  if (expectedValue <= 0) return null;

  const targetChance = computeTargetChance(targetSkin, ctx.collections);
  const estimatedCost = costMeta.cost;
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
    referenceWear: REFERENCE_WEAR,
    referenceMarketHash,
    referencePrice: Math.round(referencePrice * 100) / 100,
    wearPrices: buildWearPrices(targetSkin, catalog),
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    costInputSkin: costMeta.costInputSkin,
    costInputPrice: costMeta.costInputPrice,
    collectionName: costMeta.collectionName,
    totalCost: Math.round(estimatedCost * 100) / 100,
    expectedValue: Math.round(expectedValue * 100) / 100,
    expectedProfit: Math.round(expectedProfit * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    targetChance: Math.round(targetChance * 1000) / 1000,
    priceSource: 'steam_scm',
    priceSourceUrl: steamMarketUrl(referenceMarketHash),
    scannedAt,
  };
}

async function attachInspectLinks(items: OpportunityItem[], ctx: AppContext): Promise<OpportunityItem[]> {
  const batchSize = 4;
  const enriched = items.map((item) => {
    const skin = ctx.skinsById.get(item.targetSkinId);
    const generated =
      skin && !item.inspectLink
        ? generateInspectLinkForSkin(skin, item.referenceWear ?? REFERENCE_WEAR)
        : null;
    return generated ? { ...item, inspectLink: generated } : { ...item };
  });

  for (let i = 0; i < enriched.length; i += batchSize) {
    const batch = enriched.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (item) => {
        if (!process.env.CSFLOAT_API_KEY) return;
        try {
          const listings = await fetchCsfloatListings({
            marketHashName: item.referenceMarketHash,
            limit: 1,
          });
          const listing = listings[0];
          if (listing?.inspectLink) item.inspectLink = listing.inspectLink;
        } catch {
          // CSFloat opcional — preview gen já preenche inspectLink
        }
      }),
    );
  }

  return enriched;
}

export async function scanTopOpportunities(
  ctx: AppContext,
  limit = 100,
): Promise<OpportunityCache> {
  const catalog = await loadBulkSteamPricesBrl();
  const targets = ctx.skins
    .filter((s) => (s.rarity === 'covert' || s.rarity === 'classified') && !s.stattrak)
    .sort((a, b) => RARITY_SCORE[b.rarity] - RARITY_SCORE[a.rarity] || a.name.localeCompare(b.name))
    .slice(0, Math.min(60, limit));

  const scannedAt = new Date().toISOString();
  const items: OpportunityItem[] = [];

  for (const skin of targets) {
    const item = evaluateTarget(skin, ctx, catalog, scannedAt);
    if (item) items.push(item);
  }

  items.sort((a, b) => b.roi - a.roi || b.expectedProfit - a.expectedProfit);
  const ranked = items.slice(0, limit).map((item, index) => ({ ...item, rank: index + 1 }));
  const withInspect = await attachInspectLinks(ranked.slice(0, Math.min(limit, 12)), ctx);

  const merged = ranked.map((item) => {
    const found = withInspect.find((w) => w.targetSkinId === item.targetSkinId);
    return found ?? item;
  });

  memoryCache = { items: merged, scannedAt };
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

    const referenceWear = item.referenceWear ?? REFERENCE_WEAR;
    const inspectLink =
      item.inspectLink ?? generateInspectLinkForSkin(skin, referenceWear) ?? undefined;

    return {
      ...item,
      imageUrl: item.imageUrl ?? skin.imageUrl,
      rarity: item.rarity ?? skin.rarity,
      weapon: item.weapon || skin.weapon,
      referenceMarketHash:
        item.referenceMarketHash ??
        buildMarketHashName(skin.name, skin.stattrak, referenceWear),
      priceSourceUrl:
        item.priceSourceUrl ??
        steamMarketUrl(buildMarketHashName(skin.name, skin.stattrak, referenceWear)),
      inspectLink,
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
