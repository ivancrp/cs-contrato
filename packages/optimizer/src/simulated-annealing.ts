import {
  combinationCost,
  generateSeeds,
  mutateCombination,
  randomCombination,
} from './heuristic.js';
import type { Combination, InternalEvaluationContext, InternalOptimizationResult } from './types.js';

/**
 * Simulated Annealing — pools médios (26–80 candidatos).
 */
export function simulatedAnnealingOptimize(
  ctx: InternalEvaluationContext,
  iterations = 2000,
): InternalOptimizationResult | null {
  const poolSize = ctx.candidates.length;
  if (poolSize === 0) return null;

  const seeds = generateSeeds(ctx);
  let current: Combination =
    seeds[0] ?? randomCombination(ctx.inputCount, poolSize);
  let currentEval = ctx.evaluate(current);
  let best: InternalOptimizationResult = {
    combination: current,
    algorithm: 'simulated_annealing',
    ...currentEval,
  };

  let temperature = 100;
  const coolingRate = 0.995;

  for (let i = 0; i < iterations; i++) {
    const neighbor = mutateCombination(current, poolSize);
    if (combinationCost(neighbor, ctx.candidates) > ctx.budget) {
      temperature *= coolingRate;
      continue;
    }

    const neighborEval = ctx.evaluate(neighbor);
    const delta = neighborEval.score - currentEval.score;

    if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
      current = neighbor;
      currentEval = neighborEval;
      if (neighborEval.score > best.score) {
        best = { combination: neighbor, algorithm: 'simulated_annealing', ...neighborEval };
      }
    }

    temperature *= coolingRate;
  }

  return best;
}
