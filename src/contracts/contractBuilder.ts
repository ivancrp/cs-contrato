import {
  buildCheapCandidatePool,
  computeFloorCost,
  computePriceCap,
  extractTargetCollectionPool,
  hasTargetCollectionCandidates,
  isFeasibleContract,
} from '../algorithms/candidatePool';
import { greedyOptimize } from '../algorithms/heuristic';
import { optimizeAllTiers, optimizeContract } from '../algorithms/optimizer';
import { calculateContractScore, scoreToStars } from '../algorithms/scoring';
import type { CandidateListing, Combination, EvaluationContext } from '../algorithms/types';
import { findSkinById, findSkinByName, getCollections } from '../data/collections';
import { buildContractOutputs, getInputRarityForTarget } from '../math/probability';
import { calculateFloatMetrics, normalizeFloat } from '../math/float';
import { validateContractInputs, assertValidContractInputs } from '../math/contractRules';
import type {
  ContractInput,
  MarketListing,
  SkinItem,
  TargetSearchParams,
  TradeUpContract,
} from '../models/types';
import { priceService } from '../services/priceService';
import { marketService } from '../services/marketService';
import { buildCSFloatSearchUrl } from '../services/inspectService';
import { skinMetadataService } from '../services/skinMetadataService';
import { buildMarketHashName } from '../utils/format';
import { floatToWear, getWearTiersInRange, maxInputFloatForTargetOutput, requiredNormalizedWear, wearToMaxFloat } from '../math/wear';
import { yieldToMain } from '../utils/yieldToMain';
import { calculateContract, findCollectionsForTarget, findInputCandidates } from './tradeUpCalculator';

const TIER_LABELS: Record<string, string> = {
  budget: '$ Menor custo',
  one_target: '◎ 1 skin da coleção alvo',
  float_safe: '◎ Float ideal (econômico)',
  balanced: '$$ Equilibrado',
  premium: '$$$ Maior chance',
  target_60: '🎯 60% chance no alvo',
  ai_best: '★ Melhor Contrato IA',
  min_loss: '🛡 Menor Perda Possível',
};

const MAX_CANDIDATE_POOL = 60;
const MARKET_BATCH_SIZE = 8;

let cachedItemsById: Map<string, SkinItem> | null = null;

function getItemsById(): Map<string, SkinItem> {
  if (!cachedItemsById) {
    cachedItemsById = new Map(
      getCollections().flatMap((collection) => collection.items).map((item) => [item.id, item]),
    );
  }
  return cachedItemsById;
}

function getItemById(itemId: string): SkinItem | undefined {
  return getItemsById().get(itemId);
}

export function invalidateContractCaches(): void {
  cachedItemsById = null;
}

function trimCandidatePool(listings: CandidateListing[]): CandidateListing[] {
  if (listings.length <= MAX_CANDIDATE_POOL) return listings;

  const cap = computePriceCap(listings);
  const targetPool = extractTargetCollectionPool(listings);
  const otherPool = listings
    .filter((listing) => !listing.isTargetCollection && listing.price <= cap * 1.4)
    .sort((a, b) => a.price - b.price || a.floatFitScore - b.floatFitScore);

  const merged = [...targetPool, ...otherPool];
  return merged.slice(0, MAX_CANDIDATE_POOL);
}

/** Estima teto de orçamento a partir do menor custo viável de 10 skins. */
export function estimateAutoBudget(candidates: CandidateListing[]): number {
  const floorCost = computeFloorCost(candidates);
  if (floorCost <= 0) return 300;
  return Math.ceil(floorCost * 2.6);
}

export function resolveSearchDefaults(
  params: TargetSearchParams,
  candidates?: CandidateListing[],
): Required<Pick<TargetSearchParams, 'maxFloat' | 'budget' | 'mode'>> & TargetSearchParams {
  return {
    ...params,
    maxFloat: params.maxFloat ?? wearToMaxFloat(params.wear),
    budget: params.budget ?? (candidates ? estimateAutoBudget(candidates) : 500),
    mode: params.mode ?? 'balanced',
  };
}

export function resolveTargetSkin(params: TargetSearchParams): SkinItem {
  const byId = params.targetSkinId ? findSkinById(params.targetSkinId) : undefined;
  const targetSkin = byId ?? findSkinByName(params.skinName, params.stattrak);
  if (!targetSkin) {
    throw new Error(`Skin não encontrada: ${params.skinName}`);
  }
  if (targetSkin.stattrak !== params.stattrak) {
    throw new Error(
      params.stattrak
        ? 'Esta skin não possui versão StatTrak.'
        : 'Selecione StatTrak para esta skin alvo.',
    );
  }
  return targetSkin;
}

/**
 * Busca listings do mercado em todos os wears compatíveis com o float máximo.
 */
async function fetchMarketListingsForItem(
  item: SkinItem,
  maxAllowed: number,
  marketplace: TargetSearchParams['marketplace'],
) {
  const wears = getWearTiersInRange(item.minFloat, maxAllowed);
  const allListings: MarketListing[] = [];
  const seenIds = new Set<string>();

  for (const wear of wears) {
    const hash = buildMarketHashName(item.name, item.stattrak, wear);
    const listings = await marketService.getBestListings(hash, marketplace, maxAllowed);

    for (const listing of listings) {
      if (listing.float < item.minFloat || listing.float > maxAllowed) continue;
      if (listing.price <= 0) continue;

      const prefersLive = marketplace === 'csfloat' || marketplace === 'all';
      if (prefersLive && listing.marketplace === 'csfloat' && !listing.purchaseUrl) {
        continue;
      }

      if (!listing.purchaseUrl) {
        const hasCatalogPrice = priceService.hasMarketPrice(item.name, item.stattrak, listing.wear);
        if (!hasCatalogPrice) continue;
      }

      if (seenIds.has(listing.id)) continue;
      seenIds.add(listing.id);
      allListings.push(listing);
    }
  }

  return allListings;
}

/**
 * Constrói pool de candidatos com listings verificados no mercado (preço + float).
 */
export async function buildCandidatePool(
  targetSkin: SkinItem,
  params: TargetSearchParams,
): Promise<CandidateListing[]> {
  const inputRarity = getInputRarityForTarget(targetSkin.rarity);
  if (!inputRarity) return [];

  await priceService.preload();
  await skinMetadataService.preload();

  const maxFloat = params.maxFloat ?? wearToMaxFloat(params.wear);
  const candidates = findInputCandidates(targetSkin, maxFloat);
  const targetCollectionIds = new Set(
    findCollectionsForTarget(targetSkin).map((c) => c.id),
  );

  const idealNorm = requiredNormalizedWear(maxFloat, targetSkin);
  const listings: CandidateListing[] = [];
  const seenListingKeys = new Set<string>();

  for (let index = 0; index < candidates.length; index += 1) {
    const item = candidates[index];
    const maxAllowed = maxInputFloatForTargetOutput(maxFloat, item, targetSkin);
    const marketListings = await fetchMarketListingsForItem(
      item,
      maxAllowed,
      params.marketplace,
    );

    for (const marketListing of marketListings) {
      const dedupeKey = `${item.id}-${marketListing.float.toFixed(4)}`;
      if (seenListingKeys.has(dedupeKey)) continue;
      seenListingKeys.add(dedupeKey);

      const normalized = normalizeFloat(marketListing.float, item);

      let purchaseUrl = marketListing.purchaseUrl;
      if (!purchaseUrl && marketListing.marketplace === 'csfloat') {
        const meta = skinMetadataService.getSync(item.name, item.stattrak);
        if (meta) {
          purchaseUrl = buildCSFloatSearchUrl({
            defIndex: meta.defIndex,
            paintIndex: meta.paintIndex,
            maxFloat: marketListing.float,
            stattrak: item.stattrak,
          });
        }
      }

      listings.push({
        listingId: marketListing.id,
        itemId: item.id,
        collectionId: item.collectionId,
        rarity: item.rarity,
        stattrak: item.stattrak,
        price: marketListing.price,
        float: marketListing.float,
        normalizedFloat: normalized,
        floatFitScore: Math.abs(normalized - idealNorm),
        isTargetCollection: targetCollectionIds.has(item.collectionId),
        marketVerified: Boolean(purchaseUrl && marketListing.purchaseUrl),
        marketplace: marketListing.marketplace,
        purchaseUrl,
      });
    }

    if ((index + 1) % MARKET_BATCH_SIZE === 0) {
      await yieldToMain();
    }
  }

  return trimCandidatePool(
    listings.sort((a, b) => {
      const priceDiff = a.price - b.price;
      if (Math.abs(priceDiff) > 1) return priceDiff;
      return a.floatFitScore - b.floatFitScore;
    }),
  );
}

/**
 * Converte combinação de índices em ContractInput[].
 */
export function combinationToInputs(
  combination: Combination,
  candidates: CandidateListing[],
  marketplace: TargetSearchParams['marketplace'],
): ContractInput[] {
  return combination.map((idx) => {
    const candidate = candidates[idx];
    if (!candidate) {
      throw new Error(`Candidato inválido no índice ${idx}.`);
    }
    const item = getItemById(candidate.itemId);
    if (!item) {
      throw new Error(`Skin não encontrada: ${candidate.itemId}.`);
    }
    if (item.rarity !== candidate.rarity) {
      throw new Error(`Raridade inconsistente para ${item.name}.`);
    }
    if (item.stattrak !== candidate.stattrak) {
      throw new Error(`Versão StatTrak inconsistente para ${item.name}.`);
    }
    const wear = floatToWear(candidate.float);
    const listing: MarketListing = {
      id: candidate.listingId,
      itemId: candidate.itemId,
      marketHashName: buildMarketHashName(item.name, item.stattrak, wear),
      marketplace: candidate.marketplace ?? (marketplace === 'all' ? 'csfloat' : marketplace),
      price: candidate.price,
      currency: 'BRL',
      float: candidate.float,
      wear,
      stattrak: item.stattrak,
      purchaseUrl: candidate.purchaseUrl,
    };
    return { listing, item };
  });
}

function createSyncPriceLookup(marketplace: TargetSearchParams['marketplace']) {
  return (itemId: string, expectedFloat: number): number => {
    const item = getItemById(itemId);
    if (!item) return 0;

    const price = priceService.getOutputPriceSync(
      item.name,
      item.stattrak,
      expectedFloat,
      marketplace,
    );

    if (price > 0) return price;
    return priceService.getFallbackPrice(item.rarity, expectedFloat, item.stattrak);
  };
}

/**
 * Cria contexto de avaliação para otimizadores.
 */
export async function createEvaluationContext(
  targetSkin: SkinItem,
  candidates: CandidateListing[],
  params: TargetSearchParams,
): Promise<EvaluationContext> {
  const resolvedParams = resolveSearchDefaults(params, candidates);
  const maxFloat = resolvedParams.maxFloat;
  const priceLookup = createSyncPriceLookup(resolvedParams.marketplace);
  const priceCache = new Map<string, number>();

  const syncPriceLookup = (itemId: string, expectedFloat: number): number => {
    const key = `${itemId}-${expectedFloat.toFixed(4)}`;
    if (!priceCache.has(key)) {
      priceCache.set(key, priceLookup(itemId, expectedFloat));
    }
    return priceCache.get(key) ?? 0;
  };

  for (const candidate of candidates) {
    const item = getItemById(candidate.itemId);
    if (item) {
      const key = `${item.id}-${candidate.float.toFixed(4)}`;
      priceCache.set(key, priceLookup(item.id, candidate.float));
    }
  }

  const outputItems = getCollections().flatMap((c) => c.items).filter(
    (i) => i.rarity === targetSkin.rarity && i.stattrak === targetSkin.stattrak,
  );
  for (const item of outputItems) {
    const key = `${item.id}-${maxFloat.toFixed(4)}`;
    priceCache.set(key, priceLookup(item.id, maxFloat));
  }

  const floorCost = computeFloorCost(candidates);
  const requiresTargetCollection = hasTargetCollectionCandidates(candidates);

  const ctx: EvaluationContext = {
    candidates,
    targetSkin,
    budget: resolvedParams.budget,
    floorCost,
    requiresTargetCollection,
    mode: resolvedParams.mode,
    evaluate: (combination: Combination) => {
      const inputs = combinationToInputs(combination, ctx.candidates, resolvedParams.marketplace);
      const validation = validateContractInputs(inputs, targetSkin);
      if (!validation.valid) {
        return {
          inputs,
          outputs: [],
          totalCost: Number.POSITIVE_INFINITY,
          expectedFloat: 1,
          score: Number.NEGATIVE_INFINITY,
        };
      }

      const totalCost = inputs.reduce((s, i) => s + i.listing.price, 0);
      const floatMetrics = calculateFloatMetrics(inputs, targetSkin);

      const lookup = (itemId: string, expectedFloat: number) => {
        const key = `${itemId}-${expectedFloat.toFixed(4)}`;
        return priceCache.get(key) ?? syncPriceLookup(itemId, expectedFloat);
      };

      const outputs = buildContractOutputs(
        inputs,
        getCollections(),
        targetSkin.rarity,
        targetSkin.stattrak,
        targetSkin.id,
        lookup,
      );

      const score = calculateContractScore(
        {
          outputs,
          totalCost,
          targetSkinId: targetSkin.id,
          expectedFloat: floatMetrics.expectedOutputFloat,
          maxFloat,
          budget: resolvedParams.budget,
        },
        ctx.mode,
      );

      return {
        inputs,
        outputs,
        totalCost,
        expectedFloat: floatMetrics.expectedOutputFloat,
        score,
      };
    },
  };

  return ctx;
}

export function summarizeMarketAvailability(
  candidates: CandidateListing[],
  marketplace: TargetSearchParams['marketplace'],
) {
  const skinIds = new Set(candidates.map((candidate) => candidate.itemId));
  const liveListings = candidates.filter((candidate) => Boolean(candidate.purchaseUrl)).length;

  return {
    marketplace,
    listingsFound: candidates.length,
    skinsWithListings: skinIds.size,
    liveListings,
  };
}

export interface ContractSearchContext {
  targetSkin: SkinItem;
  resolvedParams: ReturnType<typeof resolveSearchDefaults>;
  candidates: CandidateListing[];
  baseCtx: EvaluationContext;
  priceLookup: ReturnType<typeof createSyncPriceLookup>;
}

/** Prepara pool e contexto de otimização uma única vez por busca. */
export async function prepareContractSearch(
  params: TargetSearchParams,
): Promise<ContractSearchContext> {
  invalidateContractCaches();
  await priceService.preload();

  const targetSkin = resolveTargetSkin(params);
  const draftParams = resolveSearchDefaults(params);
  const candidates = await buildCandidatePool(targetSkin, draftParams);
  if (candidates.length === 0) {
    throw new Error(
      'Nenhuma skin de entrada disponível no mercado com float compatível para este desgate. Tente outro wear ou marketplace.',
    );
  }

  const resolvedParams = resolveSearchDefaults(draftParams, candidates);
  const baseCtx = await createEvaluationContext(targetSkin, candidates, resolvedParams);

  return {
    targetSkin,
    resolvedParams,
    candidates,
    baseCtx,
    priceLookup: createSyncPriceLookup(resolvedParams.marketplace),
  };
}

async function contractFromOptimizationResult(
  result: import('../algorithms/types').OptimizationResult,
  algorithm: import('../models/types').AlgorithmType,
  tier: TradeUpContract['tier'],
  tierLabel: string,
  prepared: ContractSearchContext,
): Promise<TradeUpContract> {
  const inputs = combinationToInputs(
    result.combination,
    result.candidatePool,
    prepared.resolvedParams.marketplace,
  );
  assertValidContractInputs(inputs, prepared.targetSkin);

  if (prepared.baseCtx.requiresTargetCollection) {
    const targetCollectionIds = new Set(
      findCollectionsForTarget(prepared.targetSkin).map((collection) => collection.id),
    );
    const hasTarget = inputs.some((input) => targetCollectionIds.has(input.item.collectionId));
    if (!hasTarget) {
      throw new Error(`Contrato ${tierLabel} sem skin da coleção alvo`);
    }
  }

  return calculateContract(
    inputs,
    prepared.targetSkin,
    prepared.resolvedParams.marketplace,
    tier,
    tierLabel,
    algorithm,
    scoreToStars(result.score),
    prepared.priceLookup,
  );
}

/**
 * Gera os 3 contratos sugeridos ($, $$, $$$).
 */
export async function buildThreeContracts(
  params: TargetSearchParams,
  prepared?: ContractSearchContext,
): Promise<TradeUpContract[]> {
  const ctx = prepared ?? await prepareContractSearch(params);
  const tierResults = await optimizeAllTiers(ctx.baseCtx);

  return Promise.all(
    tierResults.map((tr) =>
      contractFromOptimizationResult(
        tr.result,
        tr.algorithm,
        tr.tierId,
        tr.label,
        ctx,
      ),
    ),
  );
}

/**
 * Encontra o melhor contrato possível (botão IA).
 */
export async function findBestContract(
  params: TargetSearchParams,
  prepared?: ContractSearchContext,
): Promise<TradeUpContract> {
  const ctx = prepared ?? await prepareContractSearch(params);
  const evalCtx: EvaluationContext = { ...ctx.baseCtx, mode: 'high_chance' };
  const { result, algorithm } = await optimizeContract(evalCtx);

  if (!result || result.score === Number.NEGATIVE_INFINITY) {
    throw new Error('Não foi possível encontrar um contrato válido');
  }

  return contractFromOptimizationResult(
    result,
    algorithm,
    'ai_best',
    TIER_LABELS.ai_best,
    ctx,
  );
}

/**
 * Modo menor perda possível.
 */
export async function buildMinLossContract(
  params: TargetSearchParams,
  prepared?: ContractSearchContext,
): Promise<TradeUpContract> {
  const ctx = prepared ?? await prepareContractSearch(params);
  const cheapPool = buildCheapCandidatePool(ctx.candidates);
  const floorCost = computeFloorCost(ctx.candidates);

  const evalCtx: EvaluationContext = {
    ...ctx.baseCtx,
    candidates: cheapPool,
    budget: Math.ceil(floorCost * 1.5),
    floorCost,
    mode: 'min_loss',
  };

  const greedy = greedyOptimize(evalCtx);
  let result = greedy ? { ...greedy, candidatePool: [...cheapPool] } : null;
  let algorithm: TradeUpContract['algorithmUsed'] = 'heuristic';

  if (!result || !isFeasibleContract(result, evalCtx.budget, floorCost, 1.55, 0.45)) {
    const optimized = await optimizeContract(evalCtx);
    algorithm = optimized.algorithm;
    if (optimized.result) {
      result = { ...optimized.result, candidatePool: [...cheapPool] };
    }
  }

  if (
    !result ||
    result.score === Number.NEGATIVE_INFINITY ||
    !isFeasibleContract(result, evalCtx.budget, floorCost, 1.55, 0.45)
  ) {
    throw new Error('Não foi possível encontrar um contrato viável de menor perda');
  }

  return contractFromOptimizationResult(
    result,
    algorithm,
    'min_loss',
    TIER_LABELS.min_loss,
    ctx,
  );
}
