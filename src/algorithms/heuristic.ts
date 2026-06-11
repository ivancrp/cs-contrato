import type { CandidateListing, Combination, EvaluationContext, OptimizationResult } from './types';

const CONTRACT_SIZE = 10;

function sortedCandidateIndices(
  ctx: EvaluationContext,
  compare: (a: CandidateListing, b: CandidateListing) => number,
): number[] {
  return ctx.candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => compare(a.candidate, b.candidate))
    .map(({ index }) => index);
}

/**
 * Heurística greedy: seleciona candidatos ordenados por critério do modo.
 */
export function greedyOptimize(ctx: EvaluationContext): OptimizationResult | null {
  const sortedIndices = sortedCandidateIndices(ctx, (a, b) => {
    switch (ctx.mode) {
      case 'low_cost':
        return a.price - b.price;
      case 'high_chance':
        return (b.isTargetCollection ? 1 : 0) - (a.isTargetCollection ? 1 : 0) || a.price - b.price;
      case 'min_loss':
        return b.price - a.price;
      default:
        return (a.isTargetCollection ? 0.5 : 0) + a.price * 0.001 - (b.isTargetCollection ? 0.5 : 0) - b.price * 0.001;
    }
  });

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
 * Gera combinação inicial com foco na coleção alvo.
 */
export function targetCollectionSeed(
  ctx: EvaluationContext,
  targetRatio: number,
): Combination {
  const targetIndices = sortedCandidateIndices(
    ctx,
    (a, b) => (a.isTargetCollection ? 0 : 1) - (b.isTargetCollection ? 0 : 1) || a.price - b.price,
  ).filter((idx) => ctx.candidates[idx]?.isTargetCollection);

  const otherIndices = sortedCandidateIndices(
    ctx,
    (a, b) => a.price - b.price,
  ).filter((idx) => !ctx.candidates[idx]?.isTargetCollection);

  const targetCount = Math.round(CONTRACT_SIZE * targetRatio);
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
    targetCollectionSeed(ctx, targetRatio),
    targetCollectionSeed(ctx, Math.min(targetRatio + 0.2, 1)),
    targetCollectionSeed(ctx, Math.max(targetRatio - 0.2, 0)),
    Array(CONTRACT_SIZE).fill(0),
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
