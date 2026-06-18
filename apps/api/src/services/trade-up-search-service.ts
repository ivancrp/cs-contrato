import { defaultRuleRegistry } from '@ct/contracts';
import { buildTradeUpContract } from '@ct/engine';
import { optimizeAllTiers, scoreToStars } from '@ct/optimizer';
import type { CandidateListing } from '@ct/optimizer';
import { fetchCsfloatListings, createDefaultPriceAggregator } from '@ct/pricing';
import type { CacheAdapter } from '@ct/common';
import type {
  Collection,
  SkinItem,
  TradeUpContract,
} from '@ct/types';
import { buildContractWithMarketPrices } from './contract-service.js';
import type { AppContext } from '../app-context.js';
import {
  buildIdealNorm,
  buildMarketHashName,
  candidateToContractInput,
  estimateAutoBudget,
  findCollectionsForTarget,
  findInputCandidates,
  getWearTiersInRange,
  resolveSearchParams,
  resolveTargetSkin,
  toSearchCandidate,
  type SearchCandidate,
  type TradeUpSearchParams,
} from './trade-up-helpers.js';

const MAX_SKINS_TO_QUERY = 32;
const MAX_POOL_SIZE = 60;
const MARKET_BATCH = 6;

export interface TradeUpSearchResponse {
  targetSkin: SkinItem;
  collections: string[];
  contracts: EnrichedContract[];
  candidates: SearchCandidate[];
  marketAvailability: {
    marketplace: TradeUpSearchParams['marketplace'];
    listingsFound: number;
    skinsWithListings: number;
    liveListings: number;
  };
}

export interface EnrichedContract extends TradeUpContract {
  tier: string;
  tierLabel: string;
  algorithmUsed: string;
  aiScore: number;
}

function trimPool(candidates: SearchCandidate[]): SearchCandidate[] {
  if (candidates.length <= MAX_POOL_SIZE) return candidates;
  const targetPool = candidates.filter((c) => c.isTargetCollection);
  const others = candidates
    .filter((c) => !c.isTargetCollection)
    .sort((a, b) => a.price - b.price);
  return [...targetPool, ...others].slice(0, MAX_POOL_SIZE);
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

function contractSignature(contract: TradeUpContract): string {
  return contract.inputs
    .map((input) => `${input.item.id}:${input.listing.float.toFixed(4)}`)
    .sort()
    .join('|');
}

async function buildCandidatePool(
  targetSkin: SkinItem,
  params: TradeUpSearchParams & { maxFloat: number },
  collections: Collection[],
): Promise<SearchCandidate[]> {
  const inputSkins = findInputCandidates(targetSkin, params.maxFloat, collections);
  const targetCollectionIds = new Set(
    findCollectionsForTarget(targetSkin, collections).map((c) => c.id),
  );
  const idealNorm = buildIdealNorm(targetSkin, params.maxFloat);
  const listings: SearchCandidate[] = [];
  const seen = new Set<string>();

  const skinsToQuery = inputSkins.slice(0, MAX_SKINS_TO_QUERY);

  for (let i = 0; i < skinsToQuery.length; i += MARKET_BATCH) {
    const batch = skinsToQuery.slice(i, i + MARKET_BATCH);
    await Promise.all(
      batch.map(async (item) => {
        const maxAllowed = Math.min(
          item.maxFloat,
          params.maxFloat,
        );
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

  if (listings.length === 0) {
    throw new Error(
      'Nenhuma skin de entrada disponível no mercado com float compatível. Tente outro wear ou marketplace.',
    );
  }

  return trimPool(
    listings.sort((a, b) => {
      const priceDiff = a.price - b.price;
      if (Math.abs(priceDiff) > 1) return priceDiff;
      return a.floatFitScore - b.floatFitScore;
    }),
  );
}

async function buildContractsFromTiers(
  tierResults: ReturnType<typeof optimizeAllTiers>,
  targetSkin: SkinItem,
  collections: Collection[],
  cache: CacheAdapter,
): Promise<EnrichedContract[]> {
  const rule = defaultRuleRegistry.getOrThrow('cs2_weapon_10');
  const aggregator = createDefaultPriceAggregator(cache);

  const contracts: EnrichedContract[] = [];

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
      aiScore: scoreToStars(tier.score),
    });
  }

  return contracts;
}

export async function searchTradeUpContracts(
  ctx: AppContext,
  params: TradeUpSearchParams,
): Promise<TradeUpSearchResponse> {
  const targetSkin = resolveTargetSkin(params, ctx.skins);
  const draft = resolveSearchParams(params);
  const candidates = await buildCandidatePool(
    targetSkin,
    draft,
    ctx.collections,
  );
  const resolved = resolveSearchParams(params, candidates);
  const budget = resolved.budget || estimateAutoBudget(candidates);
  const rule = defaultRuleRegistry.getOrThrow('cs2_weapon_10');

  const optimizerCandidates = toOptimizerCandidates(
    selectPool(candidates),
    ctx.skinsById,
  );

  const tierResults = optimizeAllTiers(
    {
      candidates: optimizerCandidates,
      inputCount: rule.inputCount,
      targetSkinId: targetSkin.id,
      strategy: 'max_ev',
      outputsForSelection: (inputs) => {
        try {
          return buildTradeUpContract({
            inputs,
            targetSkin,
            rule,
            collections: ctx.collections,
            priceLookup: () => 10,
          }).outputs;
        } catch {
          return [];
        }
      },
    },
    {
      targetSkin,
      collections: ctx.collections,
      baseBudget: budget,
      includeMinLoss: true,
    },
  );

  if (tierResults.length === 0) {
    throw new Error('Não foi possível gerar contratos válidos para esta skin alvo');
  }

  const contracts = await buildContractsFromTiers(
    tierResults,
    targetSkin,
    ctx.collections,
    ctx.cache,
  );

  const seen = new Set<string>();
  const uniqueContracts = contracts.filter((contract) => {
    const sig = contractSignature(contract);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });

  if (uniqueContracts.length === 0) {
    throw new Error('Não foi possível gerar contratos válidos para esta skin alvo');
  }

  const skinIds = new Set(candidates.map((c) => c.itemId));
  const liveListings = candidates.filter((c) => Boolean(c.purchaseUrl)).length;

  return {
    targetSkin,
    collections: [...new Set(uniqueContracts.flatMap((c) => c.collectionsUsed))],
    contracts: uniqueContracts,
    candidates,
    marketAvailability: {
      marketplace: params.marketplace,
      listingsFound: candidates.length,
      skinsWithListings: skinIds.size,
      liveListings,
    },
  };
}
