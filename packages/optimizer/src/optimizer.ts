export {
  scoreSelection,
  STRATEGY_WEIGHTS,
  type OptimizationContext,
  type OptimizationResult,
  type CandidateListing,
} from './scoring.js';

export { runOptimization, selectAlgorithm, createEvaluationContext } from './run-optimization.js';

export function optimize(context: import('./scoring.js').OptimizationContext) {
  return runOptimization(context);
}

export function optimizeGreedy(context: import('./scoring.js').OptimizationContext) {
  return runOptimization(context);
}

import { runOptimization } from './run-optimization.js';

export { branchAndBoundOptimize } from './branch-and-bound.js';
export { simulatedAnnealingOptimize } from './simulated-annealing.js';
export { geneticOptimize } from './genetic-algorithm.js';
