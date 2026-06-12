import type { AlgorithmType, OptimizationMode } from '../models/types';
import { validateContractInputs } from '../math/contractRules';
import { branchAndBoundOptimize } from './branchAndBound';
import { geneticOptimize } from './geneticAlgorithm';
import { generateTierSeeds, greedyOptimize } from './heuristic';
import { simulatedAnnealingOptimize } from './simulatedAnnealing';
import type { CandidateListing, Combination, EvaluationContext, OptimizationResult } from './types';

const BRANCH_BOUND_THRESHOLD = 25;
const SA_THRESHOLD = 100;

export interface TierOptimizationConfig {
  mode: OptimizationMode;
  budgetRatio: number;
  targetRatio: number;
  minTargetCount: number;
  maxTargetCount: number;
}

export const TIER_CONFIGS: TierOptimizationConfig[] = [
  { mode: 'low_cost', budgetRatio: 0.65, targetRatio: 0.4, minTargetCount: 4, maxTargetCount: 6 },
  { mode: 'balanced', budgetRatio: 0.8, targetRatio: 0.7, minTargetCount: 5, maxTargetCount: 8 },
  { mode: 'high_chance', budgetRatio: 1.0, targetRatio: 1.0, minTargetCount: 10, maxTargetCount: 10 },
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

function applyTargetPenalty(
  score: number,
  combination: Combination,
  candidates: CandidateListing[],
  minTarget: number,
  maxTarget: number,
): number {
  if (!Number.isFinite(score)) return score;

  const targetCount = countTargetItems(combination, candidates);
  let penalty = 0;
  if (targetCount < minTarget) penalty += (minTarget - targetCount) * 18;
  if (targetCount > maxTarget) penalty += (targetCount - maxTarget) * 14;
  return Math.max(0, score - penalty);
}

function isValidOptimizationResult(
  result: OptimizationResult,
  ctx: EvaluationContext,
  config?: TierOptimizationConfig,
): boolean {
  if (!Number.isFinite(result.totalCost) || result.totalCost > ctx.budget) return false;
  if (!Number.isFinite(result.score) || result.score === Number.NEGATIVE_INFINITY) return false;
  if (result.inputs.length !== 10) return false;

  const rarities = new Set(result.inputs.map((input) => input.item.rarity));
  if (rarities.size !== 1) return false;

  if (config?.mode === 'low_cost') {
    const targetCount = countTargetItems(result.combination, ctx.candidates);
    const hasTargetPool = ctx.candidates.some((candidate) => candidate.isTargetCollection);
    if (hasTargetPool && targetCount === 0) return false;
  }

  return validateContractInputs(result.inputs, ctx.targetSkin).valid;
}

function buildLowCostCandidatePool(candidates: CandidateListing[]): CandidateListing[] {
  const targetPool = candidates.filter((candidate) => candidate.isTargetCollection);
  const otherPool = candidates
    .filter((candidate) => !candidate.isTargetCollection)
    .sort((a, b) => a.price - b.price);

  const sliceSize = Math.max(30, Math.ceil(candidates.length * 0.55));
  const merged = [...targetPool];
  for (const candidate of otherPool) {
    if (merged.length >= sliceSize) break;
    merged.push(candidate);
  }

  return merged.length >= 10 ? merged : candidates;
}

function wrapContextWithConstraints(
  baseCtx: EvaluationContext,
  config: TierOptimizationConfig,
): EvaluationContext {
  const budget = Math.round(baseCtx.budget * config.budgetRatio * 100) / 100;

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
        config.minTargetCount,
        config.maxTargetCount,
      );
      return { ...result, score: adjustedScore };
    },
  };
}

function filterCandidatesForTier(
  candidates: CandidateListing[],
  config: TierOptimizationConfig,
): CandidateListing[] {
  if (config.mode === 'low_cost') {
    return buildLowCostCandidatePool(candidates);
  }
  if (config.mode === 'high_chance') {
    const targetOnly = candidates.filter((c) => c.isTargetCollection);
    return targetOnly.length >= 10 ? targetOnly : candidates;
  }
  return candidates;
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

function buildLowCostFallback(
  ctx: EvaluationContext,
  config: TierOptimizationConfig,
): OptimizationResult | null {
  const targetIndices = ctx.candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.isTargetCollection)
    .sort((a, b) => a.candidate.price - b.candidate.price)
    .map(({ index }) => index);

  const otherIndices = ctx.candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => !candidate.isTargetCollection)
    .sort((a, b) => a.candidate.price - b.candidate.price)
    .map(({ index }) => index);

  if (targetIndices.length === 0) return null;

  for (let targetCount = config.minTargetCount; targetCount >= 1; targetCount--) {
    const combination: Combination = [];
    let cost = 0;

    for (let i = 0; i < targetCount; i++) {
      const idx = targetIndices[i % targetIndices.length];
      if (idx === undefined) break;
      combination.push(idx);
      cost += ctx.candidates[idx]?.price ?? 0;
    }

    for (let i = targetCount; i < 10; i++) {
      const pick =
        otherIndices.find((idx) => cost + (ctx.candidates[idx]?.price ?? 0) <= ctx.budget) ??
        otherIndices[(i - targetCount) % (otherIndices.length || 1)] ??
        targetIndices[0];

      if (pick === undefined) break;
      combination.push(pick);
      cost += ctx.candidates[pick]?.price ?? 0;
    }

    if (combination.length !== 10) continue;

    const result = ctx.evaluate(combination);
    const wrapped = { combination, candidatePool: [...ctx.candidates], ...result };
    if (isValidOptimizationResult(wrapped, ctx, config)) return wrapped;
  }

  return null;
}

export async function optimizeThreeTiers(
  baseCtx: EvaluationContext,
): Promise<{ result: OptimizationResult; algorithm: AlgorithmType; mode: OptimizationMode }[]> {
  const results: { result: OptimizationResult; algorithm: AlgorithmType; mode: OptimizationMode }[] = [];
  const usedSignatures = new Set<string>();
  const originalCandidates = baseCtx.candidates;

  for (const config of TIER_CONFIGS) {
    const tierCandidates = filterCandidatesForTier(originalCandidates, config);
    baseCtx.candidates = tierCandidates;
    const ctx = wrapContextWithConstraints(baseCtx, config);

    const seeds = generateTierSeeds(ctx, config.targetRatio);
    const seedEvals = seeds
      .map((s) => {
        const ev = ctx.evaluate(s);
        return { combination: s, candidatePool: [...tierCandidates], ...ev };
      })
      .filter((r) => isValidOptimizationResult(r, ctx, config));

    const { result, algorithm } = await optimizeContract(ctx);
    let best =
      result &&
      isValidOptimizationResult({ ...result, candidatePool: [...tierCandidates] }, ctx, config) &&
      result.score >= (seedEvals[0]?.score ?? -1)
        ? { ...result, candidatePool: [...tierCandidates] }
        : [...seedEvals].sort((a, b) => b.score - a.score)[0];

    if (best && usedSignatures.has(combinationSignature(best.combination))) {
      const alt = pickBestAlternative(ctx, seeds, usedSignatures, config);
      if (alt && alt.score > 0) best = alt;
    }

    if (!best || !isValidOptimizationResult(best, ctx, config)) {
      const fallback = pickBestAlternative(ctx, seeds, usedSignatures, config);
      if (fallback && isValidOptimizationResult(fallback, ctx, config)) best = fallback;
    }

    if ((!best || !isValidOptimizationResult(best, ctx, config)) && config.mode === 'low_cost') {
      const lowCostFallback = buildLowCostFallback(ctx, config);
      if (
        lowCostFallback &&
        isValidOptimizationResult(lowCostFallback, ctx, config) &&
        !usedSignatures.has(combinationSignature(lowCostFallback.combination))
      ) {
        best = lowCostFallback;
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
        mode: config.mode,
      });
    }
  }

  baseCtx.candidates = originalCandidates;

  return results;
}
