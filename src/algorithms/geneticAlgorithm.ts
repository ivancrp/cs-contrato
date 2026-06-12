import type { AlgorithmType } from '../models/types';
import { yieldToMain } from '../utils/yieldToMain';
import type { Combination, EvaluationContext, OptimizationResult } from './types';
import {
  combinationCost,
  crossover,
  generateTierSeeds,
  mutateCombination,
  randomCombination,
} from './heuristic';

const POPULATION_SIZE = 48;
const GENERATIONS = 60;
const MUTATION_RATE = 0.15;
const YIELD_EVERY_GENERATIONS = 12;

/**
 * Algoritmo Genético para pools grandes (>80 candidatos).
 * Escala via evolução populacional com elitismo.
 */
export async function geneticOptimize(ctx: EvaluationContext): Promise<OptimizationResult | null> {
  const poolSize = ctx.candidates.length;
  if (poolSize === 0) return null;

  let population: Combination[] = [
    ...generateTierSeeds(ctx),
    ...Array.from({ length: POPULATION_SIZE - 4 }, () => randomCombination(poolSize)),
  ];

  let best: OptimizationResult | null = null;

  for (let gen = 0; gen < GENERATIONS; gen++) {
    const evaluated = population
      .map((combo) => {
        const cost = combinationCost(combo, ctx.candidates);
        if (cost > ctx.budget) return null;
        const result = ctx.evaluate(combo);
        return { combination: combo, candidatePool: [...ctx.candidates], ...result };
      })
      .filter((r): r is OptimizationResult => r !== null)
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

    if (gen % YIELD_EVERY_GENERATIONS === 0) {
      await yieldToMain();
    }
  }

  return best;
}

export const GENETIC: AlgorithmType = 'genetic';
