import type { AlgorithmType } from '../models/types';
import { yieldToMain } from '../utils/yieldToMain';
import type { Combination, EvaluationContext, OptimizationResult } from './types';
import { combinationCost, generateTierSeeds, mutateCombination, randomCombination } from './heuristic';

const YIELD_EVERY_ITERATIONS = 400;

/**
 * Simulated Annealing para pools médios.
 * Explora espaço de soluções aceitando piores estados com probabilidade decrescente.
 */
export async function simulatedAnnealingOptimize(
  ctx: EvaluationContext,
  iterations = 2000,
): Promise<OptimizationResult | null> {
  const poolSize = ctx.candidates.length;
  if (poolSize === 0) return null;

  let current: Combination = generateTierSeeds(ctx)[0] ?? randomCombination(poolSize);
  let currentEval = ctx.evaluate(current);
  let best: OptimizationResult = {
    combination: current,
    candidatePool: [...ctx.candidates],
    ...currentEval,
  };

  let temperature = 100;
  const coolingRate = 0.995;

  for (let i = 0; i < iterations; i++) {
    const neighbor = mutateCombination(current, poolSize);
    const cost = combinationCost(neighbor, ctx.candidates);
    if (cost > ctx.budget) {
      temperature *= coolingRate;
      continue;
    }

    const neighborEval = ctx.evaluate(neighbor);
    const delta = neighborEval.score - currentEval.score;

    if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
      current = neighbor;
      currentEval = neighborEval;
      if (neighborEval.score > best.score) {
        best = { combination: neighbor, candidatePool: [...ctx.candidates], ...neighborEval };
      }
    }

    temperature *= coolingRate;

    if (i % YIELD_EVERY_ITERATIONS === 0) {
      await yieldToMain();
    }
  }

  return best;
}

export const SIMULATED_ANNEALING: AlgorithmType = 'simulated_annealing';
