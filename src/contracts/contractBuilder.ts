import { optimizeContract, optimizeThreeTiers } from '../algorithms/optimizer';
import { calculateContractScore, scoreToStars } from '../algorithms/scoring';
import type { CandidateListing, Combination, EvaluationContext } from '../algorithms/types';
import { findSkinById, findSkinByName, getCollections } from '../data/collections';
import { buildContractOutputs, getInputRarityForTarget } from '../math/probability';
import { calculateFloatMetrics } from '../math/float';
import { validateContractInputs, assertValidContractInputs } from '../math/contractRules';
import type {
  ContractInput,
  MarketListing,
  OptimizationMode,
  SkinItem,
  TargetSearchParams,
  TradeUpContract,
} from '../models/types';
import { priceService } from '../services/priceService';
import { buildMarketHashName } from '../utils/format';
import { floatToWear, wearToMaxFloat } from '../math/wear';
import { calculateContract, findCollectionsForTarget, findInputCandidates } from './tradeUpCalculator';

const TIER_LABELS: Record<string, string> = {
  budget: '$ Baixo investimento',
  balanced: '$$ Investimento médio',
  premium: '$$$ Maior investimento',
  ai_best: '★ Melhor Contrato IA',
  min_loss: '🛡 Menor Perda Possível',
};

const MODE_TO_TIER: Record<OptimizationMode, TradeUpContract['tier']> = {
  low_cost: 'budget',
  balanced: 'balanced',
  high_chance: 'premium',
  min_loss: 'min_loss',
};

const FLOAT_SAMPLES = [0.01, 0.05, 0.07, 0.1, 0.15, 0.25];
const MAX_CANDIDATE_POOL = 60;

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

  const targetPool = listings.filter((listing) => listing.isTargetCollection);
  const otherPool = listings.filter((listing) => !listing.isTargetCollection);
  const merged = [...targetPool];

  for (const listing of otherPool) {
    if (merged.length >= MAX_CANDIDATE_POOL) break;
    merged.push(listing);
  }

  return merged.length >= 10 ? merged : listings.slice(0, MAX_CANDIDATE_POOL);
}

/** Estima orçamento automático a partir do pool de preços. */
export function estimateAutoBudget(candidates: CandidateListing[]): number {
  if (candidates.length < 10) return 500;

  const sorted = [...candidates].sort((a, b) => a.price - b.price);
  const floorCost = sorted.slice(0, 10).reduce((sum, candidate) => sum + candidate.price, 0);

  const targetCandidates = sorted.filter((candidate) => candidate.isTargetCollection);
  const premiumPool = targetCandidates.length >= 10 ? targetCandidates : sorted;
  const premiumCost = [...premiumPool]
    .sort((a, b) => b.price - a.price)
    .slice(0, 10)
    .reduce((sum, candidate) => sum + candidate.price, 0);

  const estimated = Math.max(premiumCost, floorCost * 2.5) * 1.1;
  const capped = Math.min(estimated, floorCost * 6);
  return Math.ceil(Math.max(capped, floorCost));
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
 * Constrói pool de candidatos com preços reais do Steam Market.
 */
export async function buildCandidatePool(
  targetSkin: SkinItem,
  params: TargetSearchParams,
): Promise<CandidateListing[]> {
  const inputRarity = getInputRarityForTarget(targetSkin.rarity);
  if (!inputRarity) return [];

  await priceService.preload();

  const maxFloat = params.maxFloat ?? wearToMaxFloat(params.wear);
  const candidates = findInputCandidates(targetSkin, maxFloat);
  const targetCollectionIds = new Set(
    findCollectionsForTarget(targetSkin).map((c) => c.id),
  );

  const listings: CandidateListing[] = [];

  for (const item of candidates) {
    const floats = FLOAT_SAMPLES.filter(
      (f) => f <= maxFloat && f >= item.minFloat,
    );

    for (const f of floats) {
      const price = priceService.getPriceForFloatSync(
        item.name,
        item.stattrak,
        f,
        params.marketplace,
      );

      if (price <= 0) continue;

      listings.push({
        listingId: `${item.id}-${f}-${params.marketplace}`,
        itemId: item.id,
        collectionId: item.collectionId,
        rarity: item.rarity,
        stattrak: item.stattrak,
        price,
        float: f,
        isTargetCollection: targetCollectionIds.has(item.collectionId),
      });
    }
  }

  return trimCandidatePool(listings.sort((a, b) => a.price - b.price));
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
      marketplace: marketplace === 'all' ? 'csfloat' : marketplace,
      price: candidate.price,
      currency: 'BRL',
      float: candidate.float,
      wear,
      stattrak: item.stattrak,
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

  const ctx: EvaluationContext = {
    candidates,
    targetSkin,
    budget: resolvedParams.budget,
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
    throw new Error('Nenhum candidato de entrada encontrado');
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
  const tierResults = await optimizeThreeTiers(ctx.baseCtx);

  return Promise.all(
    tierResults.map((tr) =>
      contractFromOptimizationResult(
        tr.result,
        tr.algorithm,
        MODE_TO_TIER[tr.mode],
        TIER_LABELS[MODE_TO_TIER[tr.mode]],
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
  const evalCtx: EvaluationContext = { ...ctx.baseCtx, mode: 'min_loss' };
  const { result, algorithm } = await optimizeContract(evalCtx);

  if (!result || result.score === Number.NEGATIVE_INFINITY) {
    throw new Error('Não foi possível encontrar um contrato válido');
  }

  return contractFromOptimizationResult(
    result,
    algorithm,
    'min_loss',
    TIER_LABELS.min_loss,
    ctx,
  );
}
