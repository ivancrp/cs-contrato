import type { CandidateListing, Combination, EvaluationContext, OptimizationResult } from './types';

const CONTRACT_SIZE = 10;

/**
 * Heurística greedy: seleciona candidatos ordenados por critério do modo.
 */
export function greedyOptimize(ctx: EvaluationContext): OptimizationResult | null {
  const sorted = [...ctx.candidates].sort((a, b) => {
    switch (ctx.mode) {
      case 'low_cost':
        return a.price - b.price;
      case 'high_chance':
        return (b.isTargetCollection ? 1 : 0) - (a.isTargetCollection ? 1 : 0) || a.price - b.price;
      case 'min_loss':
        return b.price - a.price;
      default:
        return (a.isTargetCollection ? 0.5 : 0) + a.price * 0.001 - b.price * 0.001;
    }
  });

  const combination: Combination = [];
  let cost = 0;

  for (let i = 0; i < CONTRACT_SIZE; i++) {
    const pick = sorted.find((c) => cost + c.price <= ctx.budget) ?? sorted[0];

    if (!pick) break;
    combination.push(ctx.candidates.indexOf(pick));
    cost += pick.price;
  }

  while (combination.length < CONTRACT_SIZE) {
    combination.push(combination[combination.length - 1] ?? 0);
  }

  if (combination.length < CONTRACT_SIZE) return null;
  const result = ctx.evaluate(combination);
  return { combination, ...result };
}

/**
 * Gera combinação inicial com foco na coleção alvo.
 */
export function targetCollectionSeed(
  ctx: EvaluationContext,
  targetRatio: number,
): Combination {
  const targetCandidates = ctx.candidates.filter((c) => c.isTargetCollection);
  const otherCandidates = ctx.candidates.filter((c) => !c.isTargetCollection);
  const targetCount = Math.round(CONTRACT_SIZE * targetRatio);
  const combination: Combination = [];

  const cheapTarget = [...targetCandidates].sort((a, b) => a.price - b.price);
  const cheapOther = [...otherCandidates].sort((a, b) => a.price - b.price);

  for (let i = 0; i < targetCount && i < CONTRACT_SIZE; i++) {
    const c = cheapTarget[i % cheapTarget.length];
    if (c) combination.push(ctx.candidates.indexOf(c));
  }

  while (combination.length < CONTRACT_SIZE) {
    const c = cheapOther[(combination.length - targetCount) % (cheapOther.length || 1)];
    combination.push(c ? ctx.candidates.indexOf(c) : 0);
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
