import type { CandidateListing, Combination, EvaluationContext, OptimizationResult } from './types';

export const CONTRACT_SIZE = 10;

function sortedCandidateIndices(
  ctx: EvaluationContext,
  compare: (a: CandidateListing, b: CandidateListing) => number,
): number[] {
  return ctx.candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => compare(a.candidate, b.candidate))
    .map(({ index }) => index);
}

function compareByValueFloatCollection(
  a: CandidateListing,
  b: CandidateListing,
  targetWeight = 0,
): number {
  const floatDiff = a.floatFitScore - b.floatFitScore;
  if (Math.abs(floatDiff) > 0.02) return floatDiff;

  const targetDiff = (b.isTargetCollection ? 1 : 0) - (a.isTargetCollection ? 1 : 0);
  if (targetDiff !== 0) return targetDiff * targetWeight;

  return a.price - b.price;
}

/**
 * Heurística greedy: seleciona candidatos por preço, float e coleção.
 */
export function greedyOptimize(ctx: EvaluationContext): OptimizationResult | null {
  const targetWeight =
    ctx.mode === 'high_chance' ? 2 :
    ctx.mode === 'min_loss' ? 0.3 :
    ctx.mode === 'balanced' ? 1 : 0.5;

  const sortedIndices = sortedCandidateIndices(ctx, (a, b) =>
    compareByValueFloatCollection(a, b, targetWeight),
  );

  const combination: Combination = [];
  let cost = 0;

  for (let i = 0; i < CONTRACT_SIZE; i++) {
    const pickIdx = sortedIndices.find((idx) => {
      const candidate = ctx.candidates[idx];
      return candidate && cost + candidate.price <= ctx.budget;
    }) ?? sortedIndices[0];

    if (pickIdx === undefined) break;
    combination.push(pickIdx);
    cost += ctx.candidates[pickIdx]?.price ?? 0;
  }

  while (combination.length < CONTRACT_SIZE) {
    combination.push(combination[combination.length - 1] ?? sortedIndices[0] ?? 0);
  }

  if (combination.length < CONTRACT_SIZE) return null;
  const result = ctx.evaluate(combination);
  return { combination, candidatePool: [...ctx.candidates], ...result };
}

/**
 * 1 skin da coleção alvo + 9 baratas com bom float (estratégia mínima de chance).
 */
export function minimalTargetSeed(ctx: EvaluationContext): Combination {
  const targetIdx = sortedCandidateIndices(
    ctx,
    (a, b) => compareByValueFloatCollection(a, b, 1),
  ).find((idx) => ctx.candidates[idx]?.isTargetCollection);

  const otherIndices = sortedCandidateIndices(
    ctx,
    (a, b) => compareByValueFloatCollection(a, b, 0),
  ).filter((idx) => !ctx.candidates[idx]?.isTargetCollection);

  const combination: Combination = [];

  if (targetIdx !== undefined) {
    combination.push(targetIdx);
  }

  for (let i = combination.length; i < CONTRACT_SIZE; i++) {
    const slot = i - combination.length;
    combination.push(otherIndices[slot % (otherIndices.length || 1)] ?? targetIdx ?? 0);
  }

  return combination;
}

/**
 * Gera combinação inicial com foco na coleção alvo.
 */
export function targetCollectionSeed(
  ctx: EvaluationContext,
  targetRatio: number,
): Combination {
  const targetIndices = sortedCandidateIndices(
    ctx,
    (a, b) => compareByValueFloatCollection(a, b, 1),
  ).filter((idx) => ctx.candidates[idx]?.isTargetCollection);

  const otherIndices = sortedCandidateIndices(
    ctx,
    (a, b) => compareByValueFloatCollection(a, b, 0),
  ).filter((idx) => !ctx.candidates[idx]?.isTargetCollection);

  const targetCount = Math.max(1, Math.round(CONTRACT_SIZE * targetRatio));
  const combination: Combination = [];

  for (let i = 0; i < targetCount && i < CONTRACT_SIZE; i++) {
    const idx = targetIndices[i % (targetIndices.length || 1)];
    if (idx !== undefined) combination.push(idx);
  }

  while (combination.length < CONTRACT_SIZE) {
    const slot = combination.length - targetCount;
    const idx = otherIndices[slot % (otherIndices.length || 1)] ?? targetIndices[0] ?? 0;
    combination.push(idx);
  }

  return combination;
}

export function generateTierSeeds(
  ctx: EvaluationContext,
  targetRatio = 0.7,
): Combination[] {
  return [
    minimalTargetSeed(ctx),
    targetCollectionSeed(ctx, 0.1),
    targetCollectionSeed(ctx, targetRatio),
    targetCollectionSeed(ctx, Math.min(targetRatio + 0.2, 1)),
    targetCollectionSeed(ctx, Math.max(targetRatio - 0.2, 0.1)),
  ];
}

export function combinationCost(combination: Combination, candidates: CandidateListing[]): number {
  return combination.reduce((sum, idx) => sum + (candidates[idx]?.price ?? 0), 0);
}

export function randomCombination(poolSize: number): Combination {
  return Array.from({ length: CONTRACT_SIZE }, () => Math.floor(Math.random() * poolSize));
}

export function mutateCombination(combination: Combination, poolSize: number): Combination {
  const next = [...combination];
  const pos = Math.floor(Math.random() * CONTRACT_SIZE);
  next[pos] = Math.floor(Math.random() * poolSize);
  return next;
}

export function crossover(a: Combination, b: Combination): Combination {
  const point = Math.floor(Math.random() * CONTRACT_SIZE);
  return [...a.slice(0, point), ...b.slice(point)];
}
