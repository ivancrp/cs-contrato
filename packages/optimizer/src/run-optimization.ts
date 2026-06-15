import { branchAndBoundOptimize } from './branch-and-bound.js';
import { geneticOptimize } from './genetic-algorithm.js';
import { combinationToInputs, greedyByPrice } from './heuristic.js';
import { scoreSelection } from './scoring.js';
import { simulatedAnnealingOptimize } from './simulated-annealing.js';
import type { Combination, InternalEvaluationContext, OptimizerCandidate } from './types.js';
import type { OptimizationContext, OptimizationResult } from './scoring.js';

const BRANCH_BOUND_THRESHOLD = 25;
const SA_THRESHOLD = 80;

export function createEvaluationContext(
  context: OptimizationContext,
): InternalEvaluationContext {
  const candidates: OptimizerCandidate[] = context.candidates.map((c) => ({
    listing: c.listing,
    item: c.item,
    price: c.listing.price,
  }));

  const defaultBudget =
    candidates.length > 0
      ? Math.max(...candidates.map((c) => c.price)) * context.inputCount * 3
      : Infinity;

  return {
    candidates,
    inputCount: context.inputCount,
    budget: context.budget ?? defaultBudget,
    evaluate: (combination: Combination) => {
      const inputs = combinationToInputs(combination, candidates);
      const outputs = context.outputsForSelection(inputs);
      const totalCost = inputs.reduce((s, i) => s + i.listing.price, 0);
      const score = scoreSelection(inputs, context);
      return { inputs, outputs, totalCost, score };
    },
  };
}

export function selectAlgorithm(poolSize: number): string {
  if (poolSize <= BRANCH_BOUND_THRESHOLD) return 'branch_and_bound';
  if (poolSize <= SA_THRESHOLD) return 'simulated_annealing';
  return 'genetic';
}

export function runOptimization(context: OptimizationContext): OptimizationResult {
  const ctx = createEvaluationContext(context);
  const poolSize = ctx.candidates.length;

  if (poolSize === 0) {
    return {
      inputs: [],
      score: -Infinity,
      strategy: context.strategy,
      algorithm: 'none',
    };
  }

  let result =
    poolSize <= BRANCH_BOUND_THRESHOLD
      ? branchAndBoundOptimize(ctx)
      : poolSize <= SA_THRESHOLD
        ? simulatedAnnealingOptimize(ctx)
        : geneticOptimize(ctx);

  if (!result) {
    const fallback = greedyByPrice(ctx);
    const evalResult = ctx.evaluate(fallback);
    result = { combination: fallback, algorithm: 'heuristic_greedy', ...evalResult };
  }

  return {
    inputs: result.inputs,
    score: result.score,
    strategy: context.strategy,
    algorithm: result.algorithm,
  };
}
