import { calculateEV } from '@ct/engine';
import type { ContractOutput, SimulationResult, TradeUpContract } from '@ct/types';

export const SIMULATION_PRESETS = [100, 1_000, 10_000, 100_000, 1_000_000] as const;
export type SimulationPreset = (typeof SIMULATION_PRESETS)[number];

export interface MonteCarloOptions {
  iterations: number;
  /** Seed opcional para reprodutibilidade em testes */
  seed?: number;
}

/** PRNG simples com seed (Mulberry32) para testes reprodutíveis */
function createRng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulação Monte Carlo de contratos.
 * Cada iteração sorteia saída baseada nas probabilidades do contrato.
 */
export function simulateMonteCarlo(
  contract: TradeUpContract,
  options: MonteCarloOptions,
): SimulationResult {
  const { iterations, seed } = options;
  const rng = createRng(seed);
  const outputs = contract.outputs;
  const cost = contract.evMetrics.totalCost;

  const cumulative: { skinId: string; threshold: number }[] = [];
  let cum = 0;
  for (const o of outputs) {
    cum += o.probability;
    cumulative.push({ skinId: o.item.id, threshold: cum });
  }

  const outputCounts: Record<string, number> = {};
  let targetObtained = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let totalOutputValue = 0;
  let lossCount = 0;
  let breakEvenCount = 0;
  let profitCount = 0;
  const profitBuckets = new Map<string, number>();
  const profitSamples: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const roll = rng();
    const selected =
      cumulative.find((c) => roll <= c.threshold) ?? cumulative[cumulative.length - 1];
    const output = outputs.find((o) => o.item.id === selected.skinId)!;

    const name = output.item.name;
    outputCounts[name] = (outputCounts[name] ?? 0) + 1;
    totalOutputValue += output.price;

    if (output.isTarget) targetObtained++;

    const profit = output.price - cost;
    totalProfit += profit;
    profitSamples.push(profit);

    if (profit >= 0) breakEvenCount++;
    if (profit > 0) profitCount++;
    if (profit < 0) {
      totalLoss += Math.abs(profit);
      lossCount++;
    }

    const bucket = getProfitBucket(profit);
    profitBuckets.set(bucket, (profitBuckets.get(bucket) ?? 0) + 1);
  }

  const averageProfit = totalProfit / iterations;
  const observedEV = totalOutputValue / iterations;
  const observedROI = cost > 0 ? (averageProfit / cost) * 100 : 0;

  const mean = averageProfit;
  const variance =
    profitSamples.reduce((sum, p) => sum + (p - mean) ** 2, 0) / iterations;
  const standardDeviation = Math.sqrt(variance);

  const profitDistribution = Array.from(profitBuckets.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  const histogram = profitDistribution.map((d) => ({
    range: d.bucket,
    count: d.count,
    percentage: (d.count / iterations) * 100,
  }));

  return {
    iterations,
    targetObtained,
    outputCounts,
    averageProfit,
    averageLoss: lossCount > 0 ? totalLoss / lossCount : 0,
    observedEV,
    observedROI,
    standardDeviation,
    profitChance: profitCount / iterations,
    lossChance: lossCount / iterations,
    breakEvenChance: breakEvenCount / iterations,
    breakEvenCount,
    profitDistribution,
    histogram,
  };
}

/** Simula com float exato informado — recalcula preços/wears das saídas */
export function simulateWithExactFloat(
  outputs: ContractOutput[],
  totalCost: number,
  exactInputFloat: number,
  iterations: number,
): SimulationResult {
  const adjustedOutputs = outputs.map((o) => ({
    ...o,
    expectedFloat: exactInputFloat,
  }));

  const mockContract: TradeUpContract = {
    id: 'sim_exact',
    ruleId: 'sim',
    inputs: [],
    outputs: adjustedOutputs,
    floatMetrics: {
      averageInputFloat: exactInputFloat,
      averageNormalizedFloat: exactInputFloat,
      expectedOutputFloat: exactInputFloat,
      expectedWear: 'Field-Tested',
      minPossibleFloat: 0,
      maxPossibleFloat: 1,
    },
    evMetrics: {
      expectedValue: calculateEV(adjustedOutputs),
      totalCost,
      expectedProfit: 0,
      roi: 0,
      marginPercent: 0,
      maxLoss: 0,
      averageLoss: 0,
      averageGain: 0,
      targetChance: 0,
      breakEvenChance: 0,
      lossChance: 0,
      isBreakEven: false,
      riskScore: 0,
    },
    worstCase: {
      skinId: '', skinName: '', float: 0, wear: 'Battle-Scarred',
      price: 0, profitOrLoss: 0, percent: 0,
    },
    bestCase: {
      skinId: '', skinName: '', float: 0, wear: 'Factory New',
      price: 0, profitOrLoss: 0, percent: 0,
    },
    collectionsUsed: [],
  };

  return simulateMonteCarlo(mockContract, { iterations });
}

function getProfitBucket(profit: number): string {
  if (profit < -50) return '< -50';
  if (profit < -20) return '-50 a -20';
  if (profit < 0) return '-20 a 0';
  if (profit < 20) return '0 a 20';
  if (profit < 50) return '20 a 50';
  return '> 50';
}
