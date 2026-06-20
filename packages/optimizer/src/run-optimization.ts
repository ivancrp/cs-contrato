import { branchAndBoundOptimize } from './branch-and-bound.js';
import { geneticOptimize } from './genetic-algorithm.js';
import { combinationToInputs, greedyByPrice } from './heuristic.js';
import { scoreSelection } from './scoring.js';
import { simulatedAnnealingOptimize } from './simulated-annealing.js';
import type { Combination, InternalEvaluationContext, OptimizerCandidate } from './types.js';
import type {
  CandidateListing,
  OptimizationContext,
  OptimizationResult,
} from './scoring.js';

const BRANCH_BOUND_THRESHOLD = 25;
const SA_THRESHOLD = 80;

function pickTargetBundles(
  targetCandidates: CandidateListing[],
  count: number,
  maxBundles: number,
): CandidateListing[][] {
  const sorted = [...targetCandidates].sort(
    (a, b) =>
      a.listing.price - b.listing.price ||
      (a.floatFitScore ?? 0) - (b.floatFitScore ?? 0),
  );

  if (count <= 0) return [[]];
  if (sorted.length < count) return [];

  if (count === 1) {
    return sorted.slice(0, Math.min(maxBundles, sorted.length)).map((candidate) => [candidate]);
  }

  if (count === 2) {
    const top = sorted.slice(0, Math.min(10, sorted.length));
    const bundles: CandidateListing[][] = [];
    for (let i = 0; i < top.length && bundles.length < maxBundles; i++) {
      for (let j = i; j < top.length && bundles.length < maxBundles; j++) {
        bundles.push([top[i], top[j]]);
      }
    }
    return bundles.length > 0 ? bundles : [sorted.slice(0, 2)];
  }

  if (count === 3) {
    const top = sorted.slice(0, Math.min(8, sorted.length));
    const bundles: CandidateListing[][] = [sorted.slice(0, count)];
    for (let i = 0; i < top.length && bundles.length < maxBundles; i++) {
      for (let j = i; j < top.length && bundles.length < maxBundles; j++) {
        for (let k = j; k < top.length && bundles.length < maxBundles; k++) {
          bundles.push([top[i], top[j], top[k]]);
        }
      }
    }
    return bundles;
  }

  return [sorted.slice(0, count)];
}

export function runOptimizationWithTargetMinimum(
  context: OptimizationContext,
  minTargetCount: number,
): OptimizationResult {
  const targetCandidates = context.candidates.filter((candidate) => candidate.isTargetCollection);
  const fillerCandidates = context.candidates.filter((candidate) => !candidate.isTargetCollection);

  if (targetCandidates.length < minTargetCount) {
    return {
      inputs: [],
      score: -Infinity,
      strategy: context.strategy,
      algorithm: 'none',
    };
  }

  const fillerSlots = context.inputCount - minTargetCount;
  const targetBundles = pickTargetBundles(targetCandidates, minTargetCount, 18);
  let best: OptimizationResult | null = null;

  for (const fixedTargets of targetBundles) {
    const fixedInputs = fixedTargets.map((candidate) => ({
      listing: candidate.listing,
      item: candidate.item,
    }));
    const fixedCost = fixedInputs.reduce((sum, input) => sum + input.listing.price, 0);
    const remainingBudget =
      context.budget !== undefined ? context.budget - fixedCost : undefined;

    if (remainingBudget !== undefined && remainingBudget < 0) continue;

    let candidateInputs = fixedInputs;
    let algorithm = 'target_fixed';

    if (fillerSlots > 0) {
      if (fillerCandidates.length < fillerSlots) continue;

      const fillerResult = runOptimization({
        ...context,
        candidates: fillerCandidates,
        inputCount: fillerSlots,
        budget: remainingBudget,
      });

      if (fillerResult.inputs.length !== fillerSlots) continue;

      candidateInputs = [...fixedInputs, ...fillerResult.inputs];
      algorithm = `target_fixed+${fillerResult.algorithm}`;
    }

    const outputs = context.outputsForSelection(candidateInputs);
    if (outputs.length === 0) continue;

    const score = scoreSelection(candidateInputs, context);
    if (!Number.isFinite(score)) continue;

    const candidate: OptimizationResult = {
      inputs: candidateInputs,
      score,
      strategy: context.strategy,
      algorithm,
    };

    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  return (
    best ?? {
      inputs: [],
      score: -Infinity,
      strategy: context.strategy,
      algorithm: 'none',
    }
  );
}

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
