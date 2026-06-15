import type { Combination, InternalEvaluationContext, InternalOptimizationResult } from './types.js';

/**
 * Branch and Bound — pools pequenos (≤25 candidatos).
 * Garante exploração com poda por orçamento.
 */
export function branchAndBoundOptimize(
  ctx: InternalEvaluationContext,
): InternalOptimizationResult | null {
  const { inputCount, candidates, budget } = ctx;
  let best: InternalOptimizationResult | null = null;
  let bestScore = -Infinity;

  interface BBNode {
    combination: Combination;
    depth: number;
    cost: number;
  }

  const queue: BBNode[] = [{ combination: [], depth: 0, cost: 0 }];
  const minPrice = Math.min(...candidates.map((c) => c.price), Infinity);

  while (queue.length > 0) {
    const node = queue.pop()!;
    if (node.depth === inputCount) {
      const result = ctx.evaluate(node.combination);
      if (result.score > bestScore) {
        bestScore = result.score;
        best = { combination: node.combination, algorithm: 'branch_and_bound', ...result };
      }
      continue;
    }

    const slotsLeft = inputCount - node.depth;
    if (node.cost + minPrice * slotsLeft > budget) continue;

    for (let i = 0; i < candidates.length; i++) {
      const newCost = node.cost + candidates[i].price;
      if (newCost > budget) continue;
      queue.push({
        combination: [...node.combination, i],
        depth: node.depth + 1,
        cost: newCost,
      });
    }
  }

  return best;
}
