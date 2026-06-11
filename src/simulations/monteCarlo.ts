import type { SimulationResult, TradeUpContract } from '../models/types';

/**
 * Simula N contratos usando Monte Carlo.
 * Cada iteração sorteia uma saída baseada nas probabilidades do contrato.
 */
export function simulateContracts(
  contract: TradeUpContract,
  iterations = 100_000,
): SimulationResult {
  const outputCounts: Record<string, number> = {};
  let targetObtained = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let totalOutputValue = 0;
  let lossCount = 0;
  let breakEvenCount = 0;
  const profitBuckets = new Map<string, number>();

  const outputs = contract.outputs;
  const cumulative: { skinId: string; threshold: number }[] = [];
  let cum = 0;
  for (const o of outputs) {
    cum += o.probability;
    cumulative.push({ skinId: o.item.id, threshold: cum });
  }

  const cost = contract.evMetrics.totalCost;

  for (let i = 0; i < iterations; i++) {
    const roll = Math.random();
    const selected = cumulative.find((c) => roll <= c.threshold) ?? cumulative[cumulative.length - 1];
    const output = outputs.find((o) => o.item.id === selected.skinId)!;

    const name = output.item.name;
    outputCounts[name] = (outputCounts[name] ?? 0) + 1;
    totalOutputValue += output.price;

    if (output.isTarget) targetObtained++;

    const profit = output.price - cost;
    totalProfit += profit;

    if (profit >= 0) {
      breakEvenCount++;
    }

    if (profit < 0) {
      totalLoss += Math.abs(profit);
      lossCount++;
    }

    const bucket = getProfitBucket(profit);
    profitBuckets.set(bucket, (profitBuckets.get(bucket) ?? 0) + 1);
  }

  const profitDistribution = Array.from(profitBuckets.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  const histogram = buildHistogram(profitDistribution, iterations);

  return {
    iterations,
    targetObtained,
    outputCounts,
    averageProfit: totalProfit / iterations,
    averageLoss: lossCount > 0 ? totalLoss / lossCount : 0,
    observedEV: totalOutputValue / iterations,
    breakEvenCount,
    profitDistribution,
    histogram,
  };
}

function getProfitBucket(profit: number): string {
  if (profit < -50) return '< -R$50';
  if (profit < -20) return 'R$-50 a -20';
  if (profit < 0) return 'R$-20 a 0';
  if (profit < 20) return 'R$0 a 20';
  if (profit < 50) return 'R$20 a 50';
  return '> R$50';
}

function buildHistogram(
  distribution: { bucket: string; count: number }[],
  total: number,
): SimulationResult['histogram'] {
  return distribution.map((d) => ({
    range: d.bucket,
    count: d.count,
    percentage: (d.count / total) * 100,
  }));
}
