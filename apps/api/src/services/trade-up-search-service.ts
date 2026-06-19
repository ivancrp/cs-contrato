import { defaultRuleRegistry } from '@ct/contracts';
import { buildTradeUpContract, floatToWear, getWearTiersForSkin, getWearTiersInRange } from '@ct/engine';
import { optimizeByObjectives, scoreToStars, type ObjectiveOptimizationResult } from '@ct/optimizer';
import type { CandidateListing } from '@ct/optimizer';
import { fetchCsfloatListings, loadBulkSteamPricesBrl, createDefaultPriceAggregator } from '@ct/pricing';
import type { CacheAdapter } from '@ct/common';
import type {
  Collection,
  SkinItem,
  TradeUpContract,
  WearTier,
} from '@ct/types';
import { buildContractWithMarketPrices } from './contract-service.js';
import type { AppContext } from '../app-context.js';
import {
  buildIdealNorm,
  buildCatalogListing,
  buildMarketHashName,
  candidateToContractInput,
  estimateAutoBudget,
  findCollectionsForTarget,
  findInputCandidates,
  maxAllowedInputFloat,
  resolveSearchParams,
  resolveTargetSkin,
  splitInputSkinsByTargetCollection,
  toSearchCandidate,
  type SearchCandidate,
  type TradeUpSearchParams,
} from './trade-up-helpers.js';

const MAX_SKINS_TO_QUERY = 32;
const MAX_POOL_SIZE = 80;
const MARKET_BATCH = 6;

export interface TradeUpSearchResponse {
  targetSkin: SkinItem;
  wear: WearTier;
  wearAutoAdjusted: boolean;
  validWears: WearTier[];
  collections: string[];
  collectionLabels: Record<string, string>;
  contracts: EnrichedContract[];
  candidates: SearchCandidate[];
  marketAvailability: {
    marketplace: TradeUpSearchParams['marketplace'];
    listingsFound: number;
    skinsWithListings: number;
    liveListings: number;
    priceSource: 'live' | 'catalog';
  };
}

export interface EnrichedContract extends TradeUpContract {
  tier: string;
  tierLabel: string;
  algorithmUsed: string;
  aiScore: number;
}

function mergeCandidates(...pools: SearchCandidate[][]): SearchCandidate[] {
  const map = new Map<string, SearchCandidate>();
  for (const pool of pools) {
    for (const candidate of pool) {
      const key = `${candidate.itemId}:${candidate.float.toFixed(4)}`;
      const existing = map.get(key);
      if (!existing || candidate.marketplace === 'csfloat') {
        map.set(key, candidate);
      }
    }
  }
  return [...map.values()];
}

function trimPoolPreservingTarget(candidates: SearchCandidate[]): SearchCandidate[] {
  const targetPool = candidates.filter((c) => c.isTargetCollection);
  const others = candidates
    .filter((c) => !c.isTargetCollection)
    .sort((a, b) => {
      const priceDiff = a.price - b.price;
      if (Math.abs(priceDiff) > 1) return priceDiff;
      return a.floatFitScore - b.floatFitScore;
    });

  if (candidates.length <= MAX_POOL_SIZE) {
    return [...targetPool, ...others].sort((a, b) => {
      if (a.isTargetCollection !== b.isTargetCollection) return a.isTargetCollection ? -1 : 1;
      return a.price - b.price;
    });
  }

  const fillerLimit = Math.max(0, MAX_POOL_SIZE - targetPool.length);
  return [...targetPool, ...others.slice(0, fillerLimit)];
}

function trimPool(candidates: SearchCandidate[]): SearchCandidate[] {
  return trimPoolPreservingTarget(candidates);
}

function selectPool(candidates: SearchCandidate[]): SearchCandidate[] {
  return trimPool(candidates);
}

function toOptimizerCandidates(
  pool: SearchCandidate[],
  skinsById: Map<string, SkinItem>,
): CandidateListing[] {
  return pool.map((c) => {
    const item = skinsById.get(c.itemId);
    if (!item) throw new Error(`Skin não encontrada: ${c.itemId}`);
    const input = candidateToContractInput(c, item, 'csfloat');
    return {
      listing: input.listing,
      item: input.item,
      isTargetCollection: c.isTargetCollection,
      floatFitScore: c.floatFitScore,
    };
  });
}

async function fetchLiveListings(
  targetSkin: SkinItem,
  inputSkins: SkinItem[],
  params: TradeUpSearchParams & { maxFloat: number },
  idealNorm: number,
  targetCollectionIds: Set<string>,
): Promise<SearchCandidate[]> {
  const listings: SearchCandidate[] = [];
  const seen = new Set<string>();
  const skinsToQuery = inputSkins.slice(0, MAX_SKINS_TO_QUERY);

  for (let i = 0; i < skinsToQuery.length; i += MARKET_BATCH) {
    const batch = skinsToQuery.slice(i, i + MARKET_BATCH);
    await Promise.all(
      batch.map(async (item) => {
        const maxAllowed = maxAllowedInputFloat(targetSkin, params.maxFloat, item);
        if (maxAllowed < item.minFloat) return;
        const wears = getWearTiersInRange(item.minFloat, maxAllowed);

        for (const wear of wears) {
          const hash = buildMarketHashName(item.name, item.stattrak, wear);
          try {
            const marketListings = await fetchCsfloatListings({
              marketHashName: hash,
              maxFloat: maxAllowed,
              minFloat: item.minFloat,
              limit: 8,
            });

            for (const listing of marketListings) {
              const key = `${item.id}-${listing.float.toFixed(4)}`;
              if (seen.has(key)) continue;
              seen.add(key);

              listings.push(
                toSearchCandidate(
                  listing,
                  item,
                  idealNorm,
                  targetCollectionIds.has(item.collectionId),
                ),
              );
            }
          } catch {
            /* ignora falha por skin/wear */
          }
        }
      }),
    );
  }

  return listings;
}

async function buildCatalogCandidates(
  targetSkin: SkinItem,
  inputSkins: SkinItem[],
  params: TradeUpSearchParams & { maxFloat: number },
  idealNorm: number,
  targetCollectionIds: Set<string>,
): Promise<SearchCandidate[]> {
  const priceMap = await loadBulkSteamPricesBrl();
  const listings: SearchCandidate[] = [];
  const seen = new Set<string>();

  for (const item of inputSkins.slice(0, MAX_SKINS_TO_QUERY)) {
    const maxAllowed = maxAllowedInputFloat(targetSkin, params.maxFloat, item);
    if (maxAllowed < item.minFloat) continue;
    const wears = getWearTiersInRange(item.minFloat, maxAllowed);

    for (const wear of wears) {
      const hash = buildMarketHashName(item.name, item.stattrak, wear);
      const price = priceMap.get(hash);
      if (!price || price <= 0) continue;

      const key = `${item.id}-${wear}`;
      if (seen.has(key)) continue;
      seen.add(key);

      listings.push(
        toSearchCandidate(
          buildCatalogListing(item, wear, price, maxAllowed),
          item,
          idealNorm,
          targetCollectionIds.has(item.collectionId),
        ),
      );
    }
  }

  return listings;
}

async function buildCandidatePool(
  targetSkin: SkinItem,
  params: TradeUpSearchParams & { maxFloat: number },
  collections: Collection[],
): Promise<{ candidates: SearchCandidate[]; priceSource: 'live' | 'catalog' }> {
  const inputSkins = findInputCandidates(targetSkin, params.maxFloat, collections);
  if (inputSkins.length === 0) {
    throw new Error(
      'Nenhuma skin de entrada compatível encontrada no catálogo para esta skin alvo.',
    );
  }

  const targetCollectionIds = new Set(
    findCollectionsForTarget(targetSkin, collections).map((c) => c.id),
  );
  const { targetSkins, fillerSkins } = splitInputSkinsByTargetCollection(
    targetSkin,
    inputSkins,
    collections,
  );

  if (targetSkins.length === 0) {
    throw new Error(
      'Não há skins de entrada da coleção da skin alvo disponíveis no catálogo.',
    );
  }

  const idealNorm = buildIdealNorm(targetSkin, params.maxFloat);
  const fillerQueryLimit = Math.max(0, MAX_SKINS_TO_QUERY - targetSkins.length);
  const fillerQuery = fillerSkins.slice(0, fillerQueryLimit);
  const skinsToQuery = [...targetSkins, ...fillerQuery];

  const useLiveMarket =
    params.marketplace === 'csfloat' && Boolean(process.env.CSFLOAT_API_KEY);

  let listings: SearchCandidate[] = [];
  let priceSource: 'live' | 'catalog' = 'catalog';

  const targetCatalog = await buildCatalogCandidates(
    targetSkin,
    targetSkins,
    params,
    idealNorm,
    targetCollectionIds,
  );
  listings = mergeCandidates(targetCatalog);

  if (useLiveMarket) {
    const live = await fetchLiveListings(
      targetSkin,
      skinsToQuery,
      params,
      idealNorm,
      targetCollectionIds,
    );
    listings = mergeCandidates(listings, live);
    if (live.length > 0) priceSource = 'live';

    const fillerCatalog = await buildCatalogCandidates(
      targetSkin,
      fillerQuery,
      params,
      idealNorm,
      targetCollectionIds,
    );
    listings = mergeCandidates(listings, fillerCatalog);
  } else {
    listings = mergeCandidates(
      listings,
      await buildCatalogCandidates(targetSkin, fillerQuery, params, idealNorm, targetCollectionIds),
    );
  }

  if (!listings.some((c) => c.isTargetCollection)) {
    const targetColName =
      collections.find((c) => targetCollectionIds.has(c.id))?.name ?? 'da skin alvo';
    throw new Error(
      `Não há preços/listings para skins da coleção ${targetColName}. Tente outro wear ou marketplace.`,
    );
  }

  if (listings.length === 0) {
    throw new Error(
      'Nenhuma skin de entrada com preço disponível. Tente outro wear ou StatTrak.',
    );
  }

  return {
    candidates: trimPoolPreservingTarget(
      listings.sort((a, b) => {
        if (a.isTargetCollection !== b.isTargetCollection) return a.isTargetCollection ? -1 : 1;
        const priceDiff = a.price - b.price;
        if (Math.abs(priceDiff) > 1) return priceDiff;
        return a.floatFitScore - b.floatFitScore;
      }),
    ),
    priceSource,
  };
}

async function buildContractsFromTiers(
  tierResults: ObjectiveOptimizationResult[],
  targetSkin: SkinItem,
  collections: Collection[],
  cache: CacheAdapter,
): Promise<EnrichedContract[]> {
  const rule = defaultRuleRegistry.getOrThrow('cs2_weapon_10');
  const aggregator = createDefaultPriceAggregator(cache);

  const contracts: EnrichedContract[] = [];

  function starsForObjective(tier: ObjectiveOptimizationResult): number {
    const m = tier.metrics;
    switch (tier.tierId) {
      case 'min_loss':
        return scoreToStars(1 - m.lossChance);
      case 'max_profit':
        return scoreToStars(Math.min(Math.max(m.roi / 40, 0), 1));
      case 'max_chance':
        return scoreToStars(m.targetChance);
      case 'high_risk_profit':
        return scoreToStars(Math.min(Math.max(m.expectedProfit / (m.totalCost || 1), 0), 1));
      default:
        return scoreToStars(0.55);
    }
  }

  for (const tier of tierResults) {
    const contract = await buildContractWithMarketPrices({
      inputs: tier.inputs,
      targetSkin,
      rule,
      collections,
      priceAggregator: aggregator,
    });

    contracts.push({
      ...contract,
      tier: tier.tierId,
      tierLabel: tier.label,
      algorithmUsed: tier.algorithm,
      aiScore: starsForObjective(tier),
    });
  }

  return contracts;
}

export async function searchTradeUpContracts(
  ctx: AppContext,
  params: TradeUpSearchParams,
): Promise<TradeUpSearchResponse> {
  const targetSkin = resolveTargetSkin(params, ctx.skins);
  const draft = resolveSearchParams(params, { targetSkin });
  const { candidates, priceSource } = await buildCandidatePool(
    targetSkin,
    draft,
    ctx.collections,
  );
  const resolved = resolveSearchParams(params, { targetSkin, candidates });
  const budget = resolved.budget || estimateAutoBudget(candidates);
  const rule = defaultRuleRegistry.getOrThrow('cs2_weapon_10');
  const priceMap = await loadBulkSteamPricesBrl();

  const catalogPriceLookup = (itemId: string, expectedFloat: number): number => {
    const skin = ctx.skinsById.get(itemId);
    if (!skin) return 0;
    const wear = floatToWear(expectedFloat);
    const hash = buildMarketHashName(skin.name, skin.stattrak, wear);
    const direct = priceMap.get(hash);
    if (direct && direct > 0) return direct;
    const ftHash = buildMarketHashName(skin.name, skin.stattrak, 'Field-Tested');
    return priceMap.get(ftHash) ?? 0;
  };

  const optimizerCandidates = toOptimizerCandidates(
    selectPool(candidates),
    ctx.skinsById,
  );

  const outputsForSelection = (inputs: import('@ct/types').ContractInput[]) => {
    try {
      return buildTradeUpContract({
        inputs,
        targetSkin,
        rule,
        collections: ctx.collections,
        priceLookup: catalogPriceLookup,
      }).outputs;
    } catch {
      return [];
    }
  };

  const optimizationBase = {
    candidates: optimizerCandidates,
    inputCount: rule.inputCount,
    targetSkinId: targetSkin.id,
    strategy: 'max_ev' as const,
    outputsForSelection,
  };

  let finalTierResults = optimizeByObjectives(optimizationBase, {
    targetSkin,
    collections: ctx.collections,
    baseBudget: budget,
    targetMaxOutputFloat: resolved.maxFloat,
    includeWearTarget: true,
  });

  if (finalTierResults.length === 0) {
    finalTierResults = optimizeByObjectives(optimizationBase, {
      targetSkin,
      collections: ctx.collections,
      baseBudget: Math.ceil(budget * 2),
      targetMaxOutputFloat: resolved.maxFloat,
      includeWearTarget: true,
    });
  }

  if (finalTierResults.length === 0) {
    finalTierResults = optimizeByObjectives(optimizationBase, {
      targetSkin,
      collections: ctx.collections,
      baseBudget: Math.ceil(budget * 2),
      includeWearTarget: false,
    });
  }

  if (finalTierResults.length === 0) {
    throw new Error('Não foi possível gerar contratos válidos para esta skin alvo');
  }

  const contracts = await buildContractsFromTiers(
    finalTierResults,
    targetSkin,
    ctx.collections,
    ctx.cache,
  );

  const seenTiers = new Set<string>();
  const uniqueContracts = contracts.filter((contract) => {
    if (seenTiers.has(contract.tier)) return false;
    seenTiers.add(contract.tier);
    return true;
  });

  const viableContracts = uniqueContracts.filter(
    (contract) => contract.evMetrics.targetChance > 0,
  );

  if (viableContracts.length === 0) {
    throw new Error(
      'Nenhum contrato com chance de obter a skin alvo. Verifique se há inputs da coleção correta disponíveis.',
    );
  }

  const skinIds = new Set(candidates.map((c) => c.itemId));
  const liveListings = candidates.filter((c) => c.marketplace === 'csfloat').length;

  return {
    targetSkin,
    wear: resolved.wear,
    wearAutoAdjusted: resolved.wearAutoAdjusted,
    validWears: getWearTiersForSkin(targetSkin),
    collections: [...new Set(viableContracts.flatMap((c) => c.collectionsUsed))],
    collectionLabels: Object.fromEntries(ctx.collections.map((c) => [c.id, c.name])),
    contracts: viableContracts,
    candidates,
    marketAvailability: {
      marketplace: params.marketplace,
      listingsFound: candidates.length,
      skinsWithListings: skinIds.size,
      liveListings,
      priceSource,
    },
  };
}
