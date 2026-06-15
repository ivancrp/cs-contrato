import type { ContractInput } from '@ct/types';
import type { Combination, InternalEvaluationContext, OptimizerCandidate } from './types.js';

export function combinationCost(
  combination: Combination,
  candidates: OptimizerCandidate[],
): number {
  return combination.reduce((sum, idx) => sum + (candidates[idx]?.price ?? 0), 0);
}

export function randomCombination(inputCount: number, poolSize: number): Combination {
  return Array.from({ length: inputCount }, () => Math.floor(Math.random() * poolSize));
}

export function mutateCombination(
  combination: Combination,
  poolSize: number,
): Combination {
  const next = [...combination];
  const pos = Math.floor(Math.random() * combination.length);
  next[pos] = Math.floor(Math.random() * poolSize);
  return next;
}

export function crossover(a: Combination, b: Combination): Combination {
  const point = Math.floor(Math.random() * a.length);
  return [...a.slice(0, point), ...b.slice(point)];
}

export function greedyByPrice(ctx: InternalEvaluationContext): Combination {
  const sorted = ctx.candidates
    .map((c, index) => ({ index, price: c.price }))
    .sort((a, b) => a.price - b.price);

  const combination: Combination = [];
  let cost = 0;

  for (let i = 0; i < ctx.inputCount; i++) {
    const pick =
      sorted.find((entry) => cost + entry.price <= ctx.budget)?.index ?? sorted[0]?.index ?? 0;
    combination.push(pick);
    cost += ctx.candidates[pick]?.price ?? 0;
  }

  return combination;
}

export function generateSeeds(ctx: InternalEvaluationContext): Combination[] {
  const poolSize = ctx.candidates.length;
  if (poolSize === 0) return [];

  return [
    greedyByPrice(ctx),
    randomCombination(ctx.inputCount, poolSize),
    randomCombination(ctx.inputCount, poolSize),
  ];
}

export function combinationToInputs(
  combination: Combination,
  candidates: OptimizerCandidate[],
): ContractInput[] {
  return combination.map((idx) => ({
    listing: candidates[idx].listing,
    item: candidates[idx].item,
  }));
}
