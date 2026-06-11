import type { AlgorithmType } from '../models/types';
import type { Combination, EvaluationContext, OptimizationResult } from './types';

const CONTRACT_SIZE = 10;

interface BBNode {
  combination: Combination;
  depth: number;
  cost: number;
}

/**
 * Branch and Bound para pools pequenos (≤25 candidatos).
 * Garante exploração completa com poda por orçamento e score.
 */
export function branchAndBoundOptimize(ctx: EvaluationContext): OptimizationResult | null {
  let best: OptimizationResult | null = null;
  let bestScore = -Infinity;

  const queue: BBNode[] = [{ combination: [], depth: 0, cost: 0 }];

  while (queue.length > 0) {
    const node = queue.pop()!;
    if (node.depth === CONTRACT_SIZE) {
      const result = ctx.evaluate(node.combination);
      if (result.score > bestScore) {
        bestScore = result.score;
        best = { combination: node.combination, candidatePool: [...ctx.candidates], ...result };
      }
      continue;
    }

    const slotsLeft = CONTRACT_SIZE - node.depth;
    const minRemainingCost = Math.min(...ctx.candidates.map((c) => c.price)) * slotsLeft;
    if (node.cost + minRemainingCost > ctx.budget) continue;

    for (let i = 0; i < ctx.candidates.length; i++) {
      const newCost = node.cost + ctx.candidates[i].price;
      if (newCost > ctx.budget) continue;

      const newCombination = [...node.combination, i];

      if (best && node.depth >= 3) {
        const partial = ctx.evaluate(
          [...newCombination, ...Array(CONTRACT_SIZE - newCombination.length).fill(0)],
        );
        if (partial.score < bestScore * 0.5) continue;
      }

      queue.push({ combination: newCombination, depth: node.depth + 1, cost: newCost });
    }
  }

  return best;
}

export const BRANCH_AND_BOUND: AlgorithmType = 'branch_and_bound';
