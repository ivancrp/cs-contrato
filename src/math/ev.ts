import type { ContractOutput, EVMetrics } from '../models/types';

/**
 * Calcula Expected Value: EV = Σ(probabilidade × preço)
 * @param outputs - Saídas possíveis com probabilidades
 */
export function calculateEV(outputs: ContractOutput[]): number {
  return outputs.reduce((sum, o) => sum + o.probability * o.price, 0);
}

/**
 * Calcula métricas completas de EV, ROI e risco.
 */
export function calculateEVMetrics(
  outputs: ContractOutput[],
  totalCost: number,
  targetSkinId: string,
): EVMetrics {
  const expectedValue = calculateEV(outputs);
  const expectedProfit = expectedValue - totalCost;
  const roi = totalCost > 0 ? (expectedProfit / totalCost) * 100 : 0;
  const marginPercent = totalCost > 0 ? ((expectedValue - totalCost) / totalCost) * 100 : 0;

  const targetOutput = outputs.find((o) => o.item.id === targetSkinId);
  const targetChance = targetOutput?.probability ?? 0;

  const profits = outputs.map((o) => o.price - totalCost);
  const maxLoss = Math.min(...profits, 0);
  const weightedLoss = outputs
    .filter((o) => o.price < totalCost)
    .reduce((sum, o) => sum + o.probability * (totalCost - o.price), 0);

  const weightedGain = outputs
    .filter((o) => o.price > totalCost)
    .reduce((sum, o) => sum + o.probability * (o.price - totalCost), 0);

  const lossProb = outputs
    .filter((o) => o.price < totalCost)
    .reduce((sum, o) => sum + o.probability, 0);

  const gainProb = outputs
    .filter((o) => o.price > totalCost)
    .reduce((sum, o) => sum + o.probability, 0);

  const averageLoss = lossProb > 0 ? weightedLoss / lossProb : 0;
  const averageGain = gainProb > 0 ? weightedGain / gainProb : 0;

  const breakEvenChance = outputs
    .filter((o) => o.price >= totalCost)
    .reduce((sum, o) => sum + o.probability, 0);

  const isBreakEven = Math.abs(expectedValue - totalCost) < 0.01;

  const riskScore = calculateRiskScore(outputs, totalCost, targetChance);

  return {
    expectedValue,
    totalCost,
    expectedProfit,
    roi,
    marginPercent,
    maxLoss: Math.abs(maxLoss),
    averageLoss,
    averageGain,
    targetChance,
    breakEvenChance,
    isBreakEven,
    riskScore,
  };
}

/**
 * Score de risco: 0 (baixo) a 100 (alto).
 * Baseado na variância dos retornos e probabilidade de perda.
 */
function calculateRiskScore(
  outputs: ContractOutput[],
  totalCost: number,
  targetChance: number,
): number {
  const ev = calculateEV(outputs);
  const variance = outputs.reduce((sum, o) => {
    const diff = o.price - ev;
    return sum + o.probability * diff * diff;
  }, 0);

  const lossProb = outputs
    .filter((o) => o.price < totalCost)
    .reduce((sum, o) => sum + o.probability, 0);

  const normalizedVariance = Math.min(variance / (totalCost * totalCost || 1), 1);
  const chanceFactor = 1 - targetChance;

  return Math.round((normalizedVariance * 50 + lossProb * 30 + chanceFactor * 20) * 100) / 100;
}

/**
 * Análise do modo "menor perda possível" para cenários sem skin alvo.
 */
export function analyzeMinLossScenario(
  outputs: ContractOutput[],
  totalCost: number,
  targetSkinId: string,
) {
  const nonTarget = outputs.filter((o) => o.item.id !== targetSkinId);

  if (nonTarget.length === 0) {
    return {
      worstCase: { skin: '-', value: 0, loss: totalCost },
      bestCase: { skin: '-', value: 0, gain: -totalCost },
      nonTargetExpectedValue: 0,
      nonTargetRoi: -100,
      nonTargetAverageProfit: -totalCost,
      nonTargetDistribution: [],
    };
  }

  const sorted = [...nonTarget].sort((a, b) => a.price - b.price);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];

  const totalNonTargetProb = nonTarget.reduce((s, o) => s + o.probability, 0);
  const nonTargetExpectedValue = nonTarget.reduce(
    (sum, o) => sum + o.probability * o.price,
    0,
  ) / (totalNonTargetProb || 1);
  const nonTargetAverageProfit = nonTargetExpectedValue - totalCost;
  const nonTargetRoi = totalCost > 0 ? (nonTargetAverageProfit / totalCost) * 100 : 0;

  return {
    worstCase: {
      skin: worst.item.name,
      value: worst.price,
      loss: totalCost - worst.price,
    },
    bestCase: {
      skin: best.item.name,
      value: best.price,
      gain: best.price - totalCost,
    },
    nonTargetExpectedValue,
    nonTargetRoi,
    nonTargetAverageProfit,
    nonTargetDistribution: nonTarget.map((o) => ({
      skin: o.item.name,
      probability: totalNonTargetProb > 0
        ? o.probability / totalNonTargetProb
        : o.probability,
      price: o.price,
    })),
  };
}
