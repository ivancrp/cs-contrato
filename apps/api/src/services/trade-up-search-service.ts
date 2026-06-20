import { defaultRuleRegistry } from '@ct/contracts';
import { buildTradeUpContract, floatToWear, getWearTiersForSkin, getWearTiersInRange } from '@ct/engine';
import { optimizeAllTiers, optimizeByObjectives, scoreToStars, type ObjectiveOptimizationResult, type TierOptimizationResult } from '@ct/optimizer';
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
import {
  applyVerifiedInputsToContract,
  verifyContractInputsOnCsfloat,
} from './csfloat-input-verifier.js';
import { rankFillerSkins, sortFillerCandidates } from './filler-selection.js';
import type { AppContext } from '../app-context.js';
import {
  buildIdealNorm,
  buildCatalogListing,
  buildMarketHashName,
  buildPoolPriceLookup,
  candidateToContractInput,
  contractCombinationSignature,
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

const MAX_SKINS_TO_QUERY = 64;
const MAX_POOL_SIZE = 150;
const MARKET_BATCH = 8;
const PRICE_SORT_EPSILON = 0.05;
const MIN_LIVE_FILLERS = 25;

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
  inputsVerified: number;
  inputsLive: number;
  unverifiedInputNames: string[];
  priceDeltaFromVerification: number;
}

function mergeCandidates(...pools: SearchCandidate[][]): SearchCandidate[] {
  const map = new Map<string, SearchCandidate>();
  const liveBySkinWear = new Set<string>();

  for (const pool of pools) {
    for (const candidate of pool) {
      if (candidate.marketplace === 'csfloat') {
        const wearKey = `${candidate.itemId}:${floatToWear(candidate.float)}`;
        liveBySkinWear.add(wearKey);
      }
    }
  }

  for (const pool of pools) {
    for (const candidate of pool) {
      const wearKey = `${candidate.itemId}:${floatToWear(candidate.float)}`;
      if (
        candidate.marketplace !== 'csfloat' &&
        liveBySkinWear.has(wearKey)
      ) {
        continue;
      }

      const key = `${candidate.itemId}:${candidate.float.toFixed(4)}`;
      const existing = map.get(key);
      if (!existing || candidate.marketplace === 'csfloat') {
        map.set(key, candidate);
      }
    }
  }
  return [...map.values()];
}

function trimPoolPreservingTarget(
  candidates: SearchCandidate[],
  skinsById: Map<string, SkinItem>,
): SearchCandidate[] {
  const targetPool = candidates.filter((c) => c.isTargetCollection);
  const others = sortFillerCandidates(
    candidates.filter((c) => !c.isTargetCollection),
    skinsById,
  );

  if (candidates.length <= MAX_POOL_SIZE) {
    return [...targetPool, ...others].sort((a, b) => {
      if (a.isTargetCollection !== b.isTargetCollection) return a.isTargetCollection ? -1 : 1;
      return a.price - b.price;
    });
  }

  const fillerLimit = Math.max(0, MAX_POOL_SIZE - targetPool.length);
  return [...targetPool, ...others.slice(0, fillerLimit)];
}

function trimPool(
  candidates: SearchCandidate[],
  skinsById: Map<string, SkinItem>,
): SearchCandidate[] {
  return trimPoolPreservingTarget(candidates, skinsById);
}

function selectPool(
  candidates: SearchCandidate[],
  skinsById: Map<string, SkinItem>,
  priceSource: 'live' | 'catalog',
): SearchCandidate[] {
  if (priceSource === 'live') {
    const liveCandidates = candidates.filter(
      (c) => c.marketplace === 'csfloat' || c.isTargetCollection,
    );
    const hasTargetLive = liveCandidates.some((c) => c.isTargetCollection);
    if (hasTargetLive && liveCandidates.length >= 10) {
      return trimPool(liveCandidates, skinsById);
    }
  }
  return trimPool(candidates, skinsById);
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
              limit: 12,
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
  skinsById: Map<string, SkinItem>,
): Promise<{ candidates: SearchCandidate[]; priceSource: 'live' | 'catalog' }> {
  const inputSkins = findInputCandidates(targetSkin, params.maxFloat, collections);
  if (inputSkins.length === 0) {
    throw new Error(
      'Nenhuma skin de entrada compatível encontrada no catálogo para esta skin alvo.',
    );
  }

  const catalogPrices = await loadBulkSteamPricesBrl();
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
  const rankedFillers = rankFillerSkins(fillerSkins, {
    targetSkin,
    targetMaxFloat: params.maxFloat,
    idealNorm,
    catalogPrices,
  });
  const fillerQueryLimit = Math.max(0, MAX_SKINS_TO_QUERY - targetSkins.length);
  const fillerQuery = rankedFillers.slice(0, fillerQueryLimit);

  const useLiveMarket =
    params.marketplace === 'csfloat' && Boolean(process.env.CSFLOAT_API_KEY);

  let listings: SearchCandidate[] = [];
  let priceSource: 'live' | 'catalog' = 'catalog';

  if (useLiveMarket) {
    const liveTargets = await fetchLiveListings(
      targetSkin,
      targetSkins,
      params,
      idealNorm,
      targetCollectionIds,
    );
    const liveFillers = await fetchLiveListings(
      targetSkin,
      fillerQuery,
      params,
      idealNorm,
      targetCollectionIds,
    );
    listings = mergeCandidates(liveTargets, liveFillers);

    if (liveTargets.length > 0 || liveFillers.length > 0) {
      priceSource = 'live';
    }

    const liveFillerSkins = new Set(liveFillers.map((c) => c.itemId));
    const fillersNeedingCatalog = fillerQuery.filter((s) => !liveFillerSkins.has(s.id));

    if (liveFillers.length < MIN_LIVE_FILLERS) {
      const fillerCatalog = await buildCatalogCandidates(
        targetSkin,
        fillersNeedingCatalog,
        params,
        idealNorm,
        targetCollectionIds,
      );
      listings = mergeCandidates(listings, fillerCatalog);
    }

    const targetsNeedingCatalog = targetSkins.filter(
      (s) => !liveTargets.some((c) => c.itemId === s.id),
    );
    if (targetsNeedingCatalog.length > 0) {
      const targetCatalogFallback = await buildCatalogCandidates(
        targetSkin,
        targetsNeedingCatalog,
        params,
        idealNorm,
        targetCollectionIds,
      );
      listings = mergeCandidates(listings, targetCatalogFallback);
    }
  } else {
    listings = mergeCandidates(
      await buildCatalogCandidates(targetSkin, targetSkins, params, idealNorm, targetCollectionIds),
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
        const itemA = skinsById.get(a.itemId);
        const itemB = skinsById.get(b.itemId);
        if (itemA && itemB) {
          return sortFillerCandidates([a, b], skinsById).indexOf(a) === 0 ? -1 : 1;
        }
        return a.price - b.price;
      }),
      skinsById,
    ),
    priceSource,
  };
}

type UnifiedTierResult = {
  tierId: string;
  label: string;
  inputs: import('@ct/types').ContractInput[];
  algorithm: string;
};

async function buildContractsFromTiers(
  tierResults: UnifiedTierResult[],
  targetSkin: SkinItem,
  collections: Collection[],
  cache: CacheAdapter,
  options: {
    preferredMarketplace: TradeUpSearchParams['marketplace'];
    poolPriceLookup: (itemId: string, expectedFloat: number) => number;
    targetMaxFloat: number;
    verifyInputs: boolean;
  },
): Promise<EnrichedContract[]> {
  const rule = defaultRuleRegistry.getOrThrow('cs2_weapon_10');
  const aggregator = createDefaultPriceAggregator(cache);

  const contracts: EnrichedContract[] = [];

  function starsForTier(tierId: string, metrics: import('@ct/types').EVMetrics): number {
    switch (tierId) {
      case 'min_cost':
      case 'budget':
      case 'one_target':
        return scoreToStars(Math.min(Math.max(1 - metrics.totalCost / (metrics.totalCost + 200), 0), 1));
      case 'min_loss':
        return scoreToStars(1 - metrics.lossChance);
      case 'max_profit':
        return scoreToStars(Math.min(Math.max(metrics.roi / 40, 0), 1));
      case 'max_chance':
      case 'target_60':
        return scoreToStars(metrics.targetChance);
      case 'high_risk_profit':
        return scoreToStars(Math.min(Math.max(metrics.expectedProfit / (metrics.totalCost || 1), 0), 1));
      default:
        return scoreToStars(0.55);
    }
  }

  for (const tier of tierResults) {
    let inputs = tier.inputs;

    let verification = {
      verifiedCount: 0,
      liveCount: 0,
      unverifiedNames: [] as string[],
      priceDelta: 0,
      inputs: tier.inputs,
    };

    if (options.verifyInputs) {
      verification = await verifyContractInputsOnCsfloat(
        tier.inputs,
        targetSkin,
        options.targetMaxFloat,
      );
      inputs = verification.inputs;
    }

    const contract = await buildContractWithMarketPrices({
      inputs,
      targetSkin,
      rule,
      collections,
      priceAggregator: aggregator,
      preferredMarketplace: options.preferredMarketplace,
      poolPriceLookup: options.poolPriceLookup,
    });

    const finalContract = options.verifyInputs
      ? applyVerifiedInputsToContract(contract, verification, targetSkin.id)
      : contract;

    contracts.push({
      ...finalContract,
      tier: tier.tierId,
      tierLabel: tier.label,
      algorithmUsed: tier.algorithm,
      aiScore: starsForTier(tier.tierId, finalContract.evMetrics),
      inputsVerified: verification.verifiedCount,
      inputsLive: verification.liveCount,
      unverifiedInputNames: verification.unverifiedNames,
      priceDeltaFromVerification: verification.priceDelta,
    });
  }

  return contracts;
}

function mergeTierResults(
  tierResults: TierOptimizationResult[],
  objectiveResults: ObjectiveOptimizationResult[],
): UnifiedTierResult[] {
  const merged: UnifiedTierResult[] = [];
  const usedSignatures = new Set<string>();
  const tierPriority = [
    'budget',
    'one_target',
    'min_cost',
    'wear_target',
    'float_safe',
    'min_loss',
    'balanced',
    'max_profit',
    'max_chance',
    'premium',
    'target_60',
    'high_risk_profit',
  ];

  const addResult = (result: UnifiedTierResult) => {
    const signature = contractCombinationSignature(result.inputs);
    if (usedSignatures.has(signature)) return;
    usedSignatures.add(signature);
    merged.push(result);
  };

  const allResults: UnifiedTierResult[] = [
    ...tierResults.map((tier) => ({
      tierId: tier.tierId,
      label: tier.label,
      inputs: tier.inputs,
      algorithm: tier.algorithm,
    })),
    ...objectiveResults.map((tier) => ({
      tierId: tier.tierId,
      label: tier.label,
      inputs: tier.inputs,
      algorithm: tier.algorithm,
    })),
  ];

  for (const tierId of tierPriority) {
    for (const result of allResults) {
      if (result.tierId === tierId) addResult(result);
    }
  }

  for (const result of allResults) {
    addResult(result);
  }

  return merged;
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
    ctx.skinsById,
  );
  const resolved = resolveSearchParams(params, { targetSkin, candidates });
  const budget = resolved.budget || estimateAutoBudget(candidates);
  const rule = defaultRuleRegistry.getOrThrow('cs2_weapon_10');
  const priceMap = await loadBulkSteamPricesBrl();
  const poolPriceLookup = buildPoolPriceLookup(candidates, priceMap, ctx.skinsById);
  const preferLivePricing = priceSource === 'live';

  const catalogPriceLookup = (itemId: string, expectedFloat: number): number => {
    const poolPrice = poolPriceLookup(itemId, expectedFloat);
    if (poolPrice > 0) return poolPrice;

    const skin = ctx.skinsById.get(itemId);
    if (!skin) return 0;
    const wear = floatToWear(expectedFloat);
    const hash = buildMarketHashName(skin.name, skin.stattrak, wear);
    return priceMap.get(hash) ?? 0;
  };

  const optimizerCandidates = toOptimizerCandidates(
    selectPool(candidates, ctx.skinsById, priceSource),
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

  const optimizationOptions = {
    targetSkin,
    collections: ctx.collections,
    baseBudget: budget,
    targetMaxOutputFloat: resolved.maxFloat,
    includeWearTarget: true,
  };

  let tierResults = optimizeAllTiers(optimizationBase, {
    ...optimizationOptions,
    includeMinLoss: false,
  });

  let objectiveResults = optimizeByObjectives(optimizationBase, optimizationOptions);

  if (tierResults.length === 0 && objectiveResults.length === 0) {
    const relaxedOptions = {
      ...optimizationOptions,
      baseBudget: Math.ceil(budget * 2),
    };
    tierResults = optimizeAllTiers(optimizationBase, {
      ...relaxedOptions,
      includeMinLoss: false,
    });
    objectiveResults = optimizeByObjectives(optimizationBase, relaxedOptions);
  }

  if (tierResults.length === 0 && objectiveResults.length === 0) {
    objectiveResults = optimizeByObjectives(optimizationBase, {
      targetSkin,
      collections: ctx.collections,
      baseBudget: Math.ceil(budget * 2),
      includeWearTarget: false,
    });
  }

  const finalTierResults = mergeTierResults(tierResults, objectiveResults);

  if (finalTierResults.length === 0) {
    throw new Error('Não foi possível gerar contratos válidos para esta skin alvo');
  }

  const contracts = await buildContractsFromTiers(
    finalTierResults,
    targetSkin,
    ctx.collections,
    ctx.cache,
    {
      preferredMarketplace: preferLivePricing ? 'csfloat' : params.marketplace,
      poolPriceLookup,
      targetMaxFloat: resolved.maxFloat,
      verifyInputs: preferLivePricing,
    },
  );

  const viableContracts = contracts
    .filter((contract) => contract.evMetrics.targetChance > 0)
    .filter((contract) => !preferLivePricing || contract.inputsVerified >= 8)
    .sort((a, b) => {
      const costDiff = a.evMetrics.totalCost - b.evMetrics.totalCost;
      if (Math.abs(costDiff) > PRICE_SORT_EPSILON) return costDiff;
      return b.evMetrics.expectedProfit - a.evMetrics.expectedProfit;
    });

  let finalContracts = viableContracts;

  if (finalContracts.length === 0 && preferLivePricing) {
    finalContracts = contracts
      .filter((contract) => contract.evMetrics.targetChance > 0)
      .filter((contract) => contract.inputsVerified >= 5)
      .sort((a, b) => a.evMetrics.totalCost - b.evMetrics.totalCost);
  }

  if (finalContracts.length === 0) {
    throw new Error(
      'Nenhum contrato com inputs verificados no CSFloat. Verifique CSFLOAT_API_KEY ou tente outro wear.',
    );
  }

  const skinIds = new Set(candidates.map((c) => c.itemId));
  const liveListings = candidates.filter((c) => c.marketplace === 'csfloat').length;

  return {
    targetSkin,
    wear: resolved.wear,
    wearAutoAdjusted: resolved.wearAutoAdjusted,
    validWears: getWearTiersForSkin(targetSkin),
    collections: [...new Set(finalContracts.flatMap((c) => c.collectionsUsed))],
    collectionLabels: Object.fromEntries(ctx.collections.map((c) => [c.id, c.name])),
    contracts: finalContracts,
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
