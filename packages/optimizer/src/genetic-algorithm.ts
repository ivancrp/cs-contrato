import {
  combinationCost,
  crossover,
  generateSeeds,
  mutateCombination,
  randomCombination,
} from './heuristic.js';
import type { Combination, InternalEvaluationContext, InternalOptimizationResult } from './types.js';

const POPULATION_SIZE = 48;
const GENERATIONS = 60;
const MUTATION_RATE = 0.15;

/** Algoritmo Genético — pools grandes (>80 candidatos) */
export function geneticOptimize(
  ctx: InternalEvaluationContext,
): InternalOptimizationResult | null {
  const poolSize = ctx.candidates.length;
  if (poolSize === 0) return null;

  const seeds = generateSeeds(ctx);
  let population: Combination[] = [
    ...seeds,
    ...Array.from({ length: POPULATION_SIZE - seeds.length }, () =>
      randomCombination(ctx.inputCount, poolSize),
    ),
  ];

  let best: InternalOptimizationResult | null = null;

  for (let gen = 0; gen < GENERATIONS; gen++) {
    const evaluated = population
      .map((combo) => {
        if (combinationCost(combo, ctx.candidates) > ctx.budget) return null;
        const result = ctx.evaluate(combo);
        return { combination: combo, algorithm: 'genetic', ...result };
      })
      .filter((r): r is InternalOptimizationResult => r !== null)
      .sort((a, b) => b.score - a.score);

    if (evaluated.length === 0) continue;

    if (!best || evaluated[0].score > best.score) {
      best = evaluated[0];
    }

    const elite = evaluated.slice(0, 10);
    const nextGen: Combination[] = elite.map((e) => e.combination);

    while (nextGen.length < POPULATION_SIZE) {
      const parentA = elite[Math.floor(Math.random() * elite.length)].combination;
      const parentB = elite[Math.floor(Math.random() * elite.length)].combination;
      let child = crossover(parentA, parentB);
      if (Math.random() < MUTATION_RATE) {
        child = mutateCombination(child, poolSize);
      }
      nextGen.push(child);
    }

    population = nextGen;
  }

  return best;
}
