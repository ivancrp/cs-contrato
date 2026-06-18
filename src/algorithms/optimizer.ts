import type { AlgorithmType, OptimizationMode, TradeUpContract } from '../models/types';
import { validateContractInputs } from '../math/contractRules';
import { getCollections } from '../data/collections';
import { getTargetChanceFromOutputs, planInputsForTargetChance } from '../math/targetChance';
import {
  buildBalancedCandidatePool,
  buildCheapCandidatePool,
  buildFloatFocusedPool,
  buildTargetHeavyPool,
  extractTargetCollectionPool,
  isFeasibleContract,
} from './candidatePool';
import { branchAndBoundOptimize } from './branchAndBound';
import { geneticOptimize } from './geneticAlgorithm';
import { CONTRACT_SIZE, generateTierSeeds, greedyOptimize } from './heuristic';
import { simulatedAnnealingOptimize } from './simulatedAnnealing';
import type { CandidateListing, Combination, EvaluationContext, OptimizationResult } from './types';

const BRANCH_BOUND_THRESHOLD = 25;
const SA_THRESHOLD = 100;

export interface TierOptimizationConfig {
  tierId: TradeUpContract['tier'];
  label: string;
  mode: OptimizationMode;
  budgetMultiplier: number;
  targetRatio: number;
  minTargetCount: number;
  maxTargetCount: number;
  poolType: 'cheap' | 'float' | 'full' | 'target_heavy';
  maxCostMultiplier: number;
  minEvRatio: number;
  minTargetChance?: number;
  targetCollectionId?: string;
}

export const TIER_CONFIGS: TierOptimizationConfig[] = [
  {
    tierId: 'budget',
    label: '$ Menor custo',
    mode: 'low_cost',
    budgetMultiplier: 1.45,
    targetRatio: 0.1,
    minTargetCount: 1,
    maxTargetCount: 3,
    poolType: 'cheap',
    maxCostMultiplier: 1.55,
    minEvRatio: 0.45,
  },
  {
    tierId: 'one_target',
    label: '◎ 1 skin da coleção alvo',
    mode: 'low_cost',
    budgetMultiplier: 1.35,
    targetRatio: 0.1,
    minTargetCount: 1,
    maxTargetCount: 1,
    poolType: 'cheap',
    maxCostMultiplier: 1.45,
    minEvRatio: 0.45,
  },
  {
    tierId: 'float_safe',
    label: '◎ Float ideal (econômico)',
    mode: 'balanced',
    budgetMultiplier: 1.65,
    targetRatio: 0.2,
    minTargetCount: 1,
    maxTargetCount: 4,
    poolType: 'float',
    maxCostMultiplier: 1.75,
    minEvRatio: 0.48,
  },
  {
    tierId: 'balanced',
    label: '$$ Equilibrado',
    mode: 'balanced',
    budgetMultiplier: 2.0,
    targetRatio: 0.4,
    minTargetCount: 1,
    maxTargetCount: 7,
    poolType: 'full',
    maxCostMultiplier: 2.2,
    minEvRatio: 0.42,
  },
  {
    tierId: 'premium',
    label: '$$$ Maior chance',
    mode: 'high_chance',
    budgetMultiplier: 2.6,
    targetRatio: 0.7,
    minTargetCount: 1,
    maxTargetCount: 10,
    poolType: 'full',
    maxCostMultiplier: 3.0,
    minEvRatio: 0.35,
  },
  {
    tierId: 'target_60',
    label: '🎯 60% chance no alvo',
    mode: 'high_chance',
    budgetMultiplier: 2.8,
    targetRatio: 0.6,
    minTargetCount: 6,
    maxTargetCount: 10,
    poolType: 'target_heavy',
    maxCostMultiplier: 3.2,
    minEvRatio: 0.3,
    minTargetChance: 0.6,
  },
];

export function selectAlgorithm(candidateCount: number): AlgorithmType {
  if (candidateCount <= BRANCH_BOUND_THRESHOLD) return 'branch_and_bound';
  if (candidateCount <= SA_THRESHOLD) return 'simulated_annealing';
  return 'genetic';
}

export async function optimizeContract(ctx: EvaluationContext): Promise<{
  result: OptimizationResult | null;
  algorithm: AlgorithmType;
}> {
  const algorithm = selectAlgorithm(ctx.candidates.length);

  let result: OptimizationResult | null = null;

  switch (algorithm) {
    case 'branch_and_bound':
      result = branchAndBoundOptimize(ctx);
      break;
    case 'simulated_annealing':
      result = await simulatedAnnealingOptimize(ctx);
      break;
    case 'genetic':
      result = await geneticOptimize(ctx);
      break;
    default:
      result = greedyOptimize(ctx);
  }

  if (!result) {
    result = greedyOptimize(ctx);
  }

  return { result, algorithm: result ? algorithm : 'heuristic' };
}

function combinationSignature(combination: Combination): string {
  return [...combination].sort((a, b) => a - b).join(',');
}

function countTargetItems(combination: Combination, candidates: CandidateListing[]): number {
  return combination.filter((idx) => candidates[idx]?.isTargetCollection).length;
}

function countCollectionItems(
  combination: Combination,
  candidates: CandidateListing[],
  collectionId: string,
): number {
  return combination.filter((idx) => candidates[idx]?.collectionId === collectionId).length;
}

function resolveTierConfig(
  config: TierOptimizationConfig,
  baseCtx: EvaluationContext,
): TierOptimizationConfig | null {
  if (config.tierId !== 'target_60') return config;

  const plan = planInputsForTargetChance(
    baseCtx.targetSkin,
    getCollections(),
    config.minTargetChance ?? 0.6,
  );
  if (!plan) return null;

  return {
    ...config,
    targetCollectionId: plan.collectionId,
    minTargetCount: plan.inputCount,
    targetRatio: plan.inputCount / CONTRACT_SIZE,
    label: `🎯 ${Math.round(plan.expectedChance * 100)}% chance no alvo`,
  };
}

function applyTargetPenalty(
  score: number,
  combination: Combination,
  candidates: CandidateListing[],
  config: TierOptimizationConfig,
): number {
  if (!Number.isFinite(score)) return score;

  const targetCount = countTargetItems(combination, candidates);
  const hasTargetPool = candidates.some((candidate) => candidate.isTargetCollection);
  let penalty = 0;

  if (hasTargetPool && targetCount === 0) {
    return 0;
  }

  if (config.maxTargetCount === 1 && targetCount !== 1) {
    penalty += Math.abs(targetCount - 1) * 20;
  }

  const idealCount = Math.round(CONTRACT_SIZE * config.targetRatio);
  penalty += Math.abs(targetCount - idealCount) * 3;

  if (targetCount > config.maxTargetCount) {
    penalty += (targetCount - config.maxTargetCount) * 8;
  }

  const floatPenalty = combination.reduce((sum, idx) => {
    const candidate = candidates[idx];
    return sum + (candidate?.floatFitScore ?? 0);
  }, 0) / CONTRACT_SIZE;

  const costPenalty = combination.reduce((sum, idx) => {
    const candidate = candidates[idx];
    if (!candidate || ctxFloorCost(candidates) <= 0) return sum;
    return sum + Math.max(0, candidate.price / (ctxFloorCost(candidates) / 10) - 1.5);
  }, 0) / CONTRACT_SIZE;

  return Math.max(0, score - penalty - floatPenalty * 6 - costPenalty * 12);
}

function ctxFloorCost(candidates: CandidateListing[]): number {
  const sorted = [...candidates].sort((a, b) => a.price - b.price);
  return sorted.slice(0, 10).reduce((sum, candidate) => sum + candidate.price, 0);
}

function isValidOptimizationResult(
  result: OptimizationResult,
  ctx: EvaluationContext,
  config: TierOptimizationConfig,
): boolean {
  if (!Number.isFinite(result.score) || result.score === Number.NEGATIVE_INFINITY) return false;
  if (result.inputs.length !== 10) return false;

  const rarities = new Set(result.inputs.map((input) => input.item.rarity));
  if (rarities.size !== 1) return false;

  if (!isFeasibleContract(
    result,
    ctx.budget,
    ctx.floorCost,
    config.maxCostMultiplier,
    config.minEvRatio,
  )) {
    return false;
  }

  const targetCount = countTargetItems(result.combination, ctx.candidates);

  if (ctx.requiresTargetCollection && targetCount < config.minTargetCount) {
    return false;
  }

  if (ctx.requiresTargetCollection && targetCount < 1) {
    return false;
  }

  if (config.minTargetChance) {
    const targetChance = getTargetChanceFromOutputs(result.outputs, ctx.targetSkin.id);
    if (targetChance < config.minTargetChance - 1e-9) return false;
  }

  if (config.targetCollectionId) {
    const fromBestCollection = countCollectionItems(
      result.combination,
      ctx.candidates,
      config.targetCollectionId,
    );
    if (fromBestCollection < config.minTargetCount) return false;
  }

  return validateContractInputs(result.inputs, ctx.targetSkin).valid;
}

function filterCandidatesForTier(
  candidates: CandidateListing[],
  config: TierOptimizationConfig,
): CandidateListing[] {
  switch (config.poolType) {
    case 'cheap':
      return buildCheapCandidatePool(candidates);
    case 'float':
      return buildFloatFocusedPool(candidates);
    case 'target_heavy':
      return config.targetCollectionId
        ? buildTargetHeavyPool(candidates, config.targetCollectionId)
        : buildBalancedCandidatePool(candidates);
    default:
      return buildBalancedCandidatePool(candidates);
  }
}

function wrapContextWithConstraints(
  baseCtx: EvaluationContext,
  config: TierOptimizationConfig,
): EvaluationContext {
  let budget = Math.round(baseCtx.floorCost * config.budgetMultiplier * 100) / 100;

  if (baseCtx.requiresTargetCollection) {
    const cheapestTarget = extractTargetCollectionPool(baseCtx.candidates)[0]?.price ?? 0;
    if (cheapestTarget > 0) {
      budget = Math.max(budget, cheapestTarget + baseCtx.floorCost * 0.85);
    }
  }

  return {
    ...baseCtx,
    budget,
    mode: config.mode,
    evaluate: (combination: Combination) => {
      const result = baseCtx.evaluate(combination);
      const adjustedScore = applyTargetPenalty(
        result.score,
        combination,
        baseCtx.candidates,
        config,
      );
      return { ...result, score: adjustedScore };
    },
  };
}

function pickBestAlternative(
  ctx: EvaluationContext,
  seeds: Combination[],
  excluded: Set<string>,
  config: TierOptimizationConfig,
): OptimizationResult | null {
  const evaluated = seeds
    .map((s) => {
      const ev = ctx.evaluate(s);
      return { combination: s, candidatePool: [...ctx.candidates], ...ev };
    })
    .filter(
      (r) =>
        isValidOptimizationResult(r, ctx, config) &&
        !excluded.has(combinationSignature(r.combination)),
    )
    .sort((a, b) => b.score - a.score);

  return evaluated[0] ?? null;
}

function buildCheapFallback(
  ctx: EvaluationContext,
  config: TierOptimizationConfig,
): OptimizationResult | null {
  const targetIndices = config.targetCollectionId
    ? ctx.candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => candidate.collectionId === config.targetCollectionId)
      .sort((a, b) => a.candidate.price - b.candidate.price || a.candidate.floatFitScore - b.candidate.floatFitScore)
      .map(({ index }) => index)
    : ctx.candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => candidate.isTargetCollection)
      .sort((a, b) => a.candidate.price - b.candidate.price || a.candidate.floatFitScore - b.candidate.floatFitScore)
      .map(({ index }) => index);

  const otherIndices = ctx.candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) =>
      config.targetCollectionId
        ? candidate.collectionId !== config.targetCollectionId
        : !candidate.isTargetCollection,
    )
    .sort((a, b) => a.candidate.price - b.candidate.price || a.candidate.floatFitScore - b.candidate.floatFitScore)
    .map(({ index }) => index);

  const targetCount = config.targetCollectionId
    ? config.minTargetCount
    : config.maxTargetCount === 1
      ? (targetIndices.length > 0 ? 1 : 0)
      : Math.max(config.minTargetCount, Math.round(CONTRACT_SIZE * config.targetRatio));

  if (targetCount > 0 && targetIndices.length === 0) return null;

  const combination: Combination = [];
  let cost = 0;

  for (let i = 0; i < targetCount; i++) {
    const idx = targetIndices[i % targetIndices.length];
    if (idx === undefined) break;
    combination.push(idx);
    cost += ctx.candidates[idx]?.price ?? 0;
  }

  for (let i = combination.length; i < CONTRACT_SIZE; i++) {
    const pick = otherIndices.find(
      (idx) => cost + (ctx.candidates[idx]?.price ?? 0) <= ctx.budget,
    ) ?? otherIndices[(i - targetCount) % (otherIndices.length || 1)];

    if (pick === undefined) break;
    combination.push(pick);
    cost += ctx.candidates[pick]?.price ?? 0;
  }

  if (combination.length !== CONTRACT_SIZE) return null;

  const result = ctx.evaluate(combination);
  const wrapped = { combination, candidatePool: [...ctx.candidates], ...result };
  return isValidOptimizationResult(wrapped, ctx, config) ? wrapped : null;
}

export async function optimizeAllTiers(
  baseCtx: EvaluationContext,
): Promise<{ result: OptimizationResult; algorithm: AlgorithmType; tierId: TradeUpContract['tier']; label: string }[]> {
  try {
    const { optimizeAllTiersViaPackage } = await import('./legacy-optimizer-bridge.js');
    const itemsById = new Map(
      getCollections().flatMap((c) => c.items).map((item) => [item.id, item]),
    );
    const fromPackage = optimizeAllTiersViaPackage(baseCtx, {
      collections: getCollections(),
      itemsById,
    });
    if (fromPackage.length > 0) {
      return fromPackage.map((entry) => ({
        ...entry,
        tierId: entry.tierId as TradeUpContract['tier'],
        algorithm: entry.algorithm as AlgorithmType,
      }));
    }
  } catch {
    /* fallback para otimizador legado abaixo */
  }

  const results: { result: OptimizationResult; algorithm: AlgorithmType; tierId: TradeUpContract['tier']; label: string }[] = [];
  const usedSignatures = new Set<string>();
  const originalCandidates = baseCtx.candidates;

  for (const rawConfig of TIER_CONFIGS) {
    const config = resolveTierConfig(rawConfig, baseCtx);
    if (!config) continue;

    const tierCandidates = filterCandidatesForTier(originalCandidates, config);
    if (tierCandidates.length < 10) continue;

    const collectionCandidates = config.targetCollectionId
      ? tierCandidates.filter((candidate) => candidate.collectionId === config.targetCollectionId)
      : tierCandidates.filter((candidate) => candidate.isTargetCollection);
    if (config.targetCollectionId && collectionCandidates.length < config.minTargetCount) continue;

    baseCtx.candidates = tierCandidates;
    const ctx = wrapContextWithConstraints(baseCtx, config);

    const seeds = generateTierSeeds(ctx, config.targetRatio, {
      targetCollectionId: config.targetCollectionId,
      minTargetInputs: config.minTargetCount,
    });
    const seedEvals = seeds
      .map((s) => {
        const ev = ctx.evaluate(s);
        return { combination: s, candidatePool: [...tierCandidates], ...ev };
      })
      .filter((r) => isValidOptimizationResult(r, ctx, config))
      .sort((a, b) => b.score - a.score);

    let best = seedEvals[0] ?? null;
    let algorithm: AlgorithmType = 'heuristic';

    const optimized = await optimizeContract(ctx);
    if (
      optimized.result &&
      isValidOptimizationResult({ ...optimized.result, candidatePool: [...tierCandidates] }, ctx, config) &&
      (!best || optimized.result.score > best.score)
    ) {
      best = { ...optimized.result, candidatePool: [...tierCandidates] };
      algorithm = optimized.algorithm;
    }

    if (best && usedSignatures.has(combinationSignature(best.combination))) {
      const alt = pickBestAlternative(ctx, seeds, usedSignatures, config);
      if (alt && alt.score > (best?.score ?? 0)) best = alt;
    }

    if (!best || !isValidOptimizationResult(best, ctx, config)) {
      const fallback = pickBestAlternative(ctx, seeds, usedSignatures, config)
        ?? buildCheapFallback(ctx, config);
      if (fallback && isValidOptimizationResult(fallback, ctx, config)) best = fallback;
    }

    if (
      best &&
      ctx.requiresTargetCollection &&
      countTargetItems(best.combination, tierCandidates) < config.minTargetCount
    ) {
      const withTarget = buildCheapFallback(ctx, config);
      if (withTarget && isValidOptimizationResult(withTarget, ctx, config)) {
        best = withTarget;
        algorithm = 'heuristic';
      }
    }

    if (best && isValidOptimizationResult(best, ctx, config)) {
      usedSignatures.add(combinationSignature(best.combination));
      results.push({
        result: {
          combination: best.combination,
          candidatePool: best.candidatePool,
          inputs: best.inputs,
          outputs: best.outputs,
          totalCost: best.totalCost,
          expectedFloat: best.expectedFloat,
          score: best.score,
        },
        algorithm,
        tierId: config.tierId,
        label: config.label,
      });
    }
  }

  baseCtx.candidates = originalCandidates;

  return results;
}

/** @deprecated Use optimizeAllTiers */
export const optimizeThreeTiers = optimizeAllTiers;
