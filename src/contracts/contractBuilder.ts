import { optimizeContract, optimizeThreeTiers } from '../algorithms/optimizer';
import { calculateContractScore, scoreToStars } from '../algorithms/scoring';
import type { CandidateListing, Combination, EvaluationContext } from '../algorithms/types';
import { COLLECTIONS, findSkinByName } from '../data/collections';
import { buildContractOutputs } from '../math/probability';
import { getInputRarityForTarget } from '../math/probability';
import { calculateFloatMetrics } from '../math/float';
import { validateContractInputs, assertValidContractInputs } from '../math/contractRules';
import type {
  ContractInput,
  MarketListing,
  SkinItem,
  TargetSearchParams,
  TradeUpContract,
} from '../models/types';
import { priceService } from '../services/priceService';
import { buildMarketHashName } from '../utils/format';
import { floatToWear } from '../math/wear';
import { calculateContract, findCollectionsForTarget, findInputCandidates } from './tradeUpCalculator';

const TIER_LABELS: Record<string, string> = {
  budget: '$ Baixo investimento',
  balanced: '$$ Investimento médio',
  premium: '$$$ Maior investimento',
  ai_best: '★ Melhor Contrato IA',
  min_loss: '🛡 Menor Perda Possível',
};

const FLOAT_SAMPLES = [0.01, 0.03, 0.05, 0.07, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35];

export function resolveTargetSkin(params: TargetSearchParams): SkinItem {
  const targetSkin = findSkinByName(params.skinName, params.stattrak);
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

  const candidates = findInputCandidates(targetSkin, params.maxFloat);
  const targetCollectionIds = new Set(
    findCollectionsForTarget(targetSkin).map((c) => c.id),
  );

  const listings: CandidateListing[] = [];

  for (const item of candidates) {
    const floats = FLOAT_SAMPLES.filter(
      (f) => f <= params.maxFloat && f >= item.minFloat,
    );

    for (const f of floats) {
      let price = await priceService.getPriceForFloat(
        item.name,
        item.stattrak,
        f,
        params.marketplace,
      );

      if (price <= 0) {
        price = priceService.getFallbackPrice(item.rarity, f, item.stattrak);
      }

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

  return listings.sort((a, b) => a.price - b.price);
}

/**
 * Converte combinação de índices em ContractInput[].
 */
export function combinationToInputs(
  combination: Combination,
  candidates: CandidateListing[],
  marketplace: TargetSearchParams['marketplace'],
): ContractInput[] {
  const itemMap = new Map(
    COLLECTIONS.flatMap((c) => c.items).map((i) => [i.id, i]),
  );

  return combination.map((idx) => {
    const candidate = candidates[idx];
    if (!candidate) {
      throw new Error(`Candidato inválido no índice ${idx}.`);
    }
    const item = itemMap.get(candidate.itemId);
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

async function createPriceLookup(marketplace: TargetSearchParams['marketplace']) {
  await priceService.preload();

  return async (itemId: string, expectedFloat: number): Promise<number> => {
    const item = COLLECTIONS.flatMap((c) => c.items).find((i) => i.id === itemId);
    if (!item) return 0;

    const price = await priceService.getOutputPrice(
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
  const priceLookup = await createPriceLookup(params.marketplace);
  const priceCache = new Map<string, number>();

  const syncPriceLookup = (itemId: string, expectedFloat: number): number => {
    const key = `${itemId}-${expectedFloat.toFixed(4)}`;
    if (!priceCache.has(key)) {
      const item = COLLECTIONS.flatMap((c) => c.items).find((i) => i.id === itemId);
      if (!item) {
        priceCache.set(key, 0);
      } else {
        priceCache.set(
          key,
          priceService.getFallbackPrice(item.rarity, expectedFloat, item.stattrak),
        );
      }
    }
    return priceCache.get(key) ?? 0;
  };

  for (const candidate of candidates.slice(0, 40)) {
    const item = COLLECTIONS.flatMap((c) => c.items).find((i) => i.id === candidate.itemId);
    if (item) {
      const key = `${item.id}-${candidate.float.toFixed(4)}`;
      const price = await priceLookup(item.id, candidate.float);
      priceCache.set(key, price);
    }
  }

  const outputItems = COLLECTIONS.flatMap((c) => c.items).filter(
    (i) => i.rarity === targetSkin.rarity && i.stattrak === targetSkin.stattrak,
  );
  for (const item of outputItems) {
    const key = `${item.id}-${params.maxFloat.toFixed(4)}`;
    if (!priceCache.has(key)) {
      priceCache.set(key, await priceLookup(item.id, params.maxFloat));
    }
  }

  const ctx: EvaluationContext = {
    candidates,
    targetSkin,
    budget: params.budget,
    mode: params.mode,
    evaluate: (combination: Combination) => {
      const inputs = combinationToInputs(combination, ctx.candidates, params.marketplace);
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
        COLLECTIONS,
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
          maxFloat: params.maxFloat,
          budget: params.budget,
        },
        params.mode,
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

/**
 * Gera os 3 contratos sugeridos ($, $$, $$$).
 */
export async function buildThreeContracts(
  params: TargetSearchParams,
): Promise<TradeUpContract[]> {
  const targetSkin = resolveTargetSkin(params);

  const candidates = await buildCandidatePool(targetSkin, params);
  if (candidates.length === 0) throw new Error('Nenhum candidato de entrada encontrado');

  const baseCtx = await createEvaluationContext(targetSkin, candidates, params);
  const tierResults = optimizeThreeTiers(baseCtx);
  const priceLookup = await createPriceLookup(params.marketplace);

  const tiers: TradeUpContract['tier'][] = ['budget', 'balanced', 'premium'];

  return Promise.all(
    tierResults.map(async (tr, i) => {
      const inputs = combinationToInputs(
        tr.result.combination,
        tr.result.candidatePool,
        params.marketplace,
      );
      assertValidContractInputs(inputs, targetSkin);

      const aiScore = scoreToStars(tr.result.score);
      const contract = await calculateContract(
        inputs,
        targetSkin,
        params.marketplace,
        tiers[i] ?? 'balanced',
        TIER_LABELS[tiers[i] ?? 'balanced'],
        tr.algorithm,
        aiScore,
        priceLookup,
      );
      return contract;
    }),
  );
}

/**
 * Encontra o melhor contrato possível (botão IA).
 */
export async function findBestContract(
  params: TargetSearchParams,
): Promise<TradeUpContract> {
  const targetSkin = resolveTargetSkin(params);

  const candidates = await buildCandidatePool(targetSkin, params);
  const ctx = await createEvaluationContext(targetSkin, candidates, {
    ...params,
    mode: 'high_chance',
  });

  const { result, algorithm } = optimizeContract(ctx);
  if (!result || result.score === Number.NEGATIVE_INFINITY) {
    throw new Error('Não foi possível encontrar um contrato válido');
  }

  const inputs = combinationToInputs(result.combination, result.candidatePool, params.marketplace);
  assertValidContractInputs(inputs, targetSkin);

  const aiScore = scoreToStars(result.score);
  const priceLookup = await createPriceLookup(params.marketplace);

  return calculateContract(
    inputs,
    targetSkin,
    params.marketplace,
    'ai_best',
    TIER_LABELS.ai_best,
    algorithm,
    aiScore,
    priceLookup,
  );
}

/**
 * Modo menor perda possível.
 */
export async function buildMinLossContract(
  params: TargetSearchParams,
): Promise<TradeUpContract> {
  const targetSkin = resolveTargetSkin(params);

  const candidates = await buildCandidatePool(targetSkin, params);
  const ctx = await createEvaluationContext(targetSkin, candidates, {
    ...params,
    mode: 'min_loss',
  });

  const { result, algorithm } = optimizeContract(ctx);
  if (!result || result.score === Number.NEGATIVE_INFINITY) {
    throw new Error('Não foi possível encontrar um contrato válido');
  }

  const inputs = combinationToInputs(result.combination, result.candidatePool, params.marketplace);
  assertValidContractInputs(inputs, targetSkin);

  const aiScore = scoreToStars(result.score);
  const priceLookup = await createPriceLookup(params.marketplace);

  return calculateContract(
    inputs,
    targetSkin,
    params.marketplace,
    'min_loss',
    TIER_LABELS.min_loss,
    algorithm,
    aiScore,
    priceLookup,
  );
}
