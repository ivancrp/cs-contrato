import type { ContractOutput, EVMetrics, FeeConfig, ScenarioCase } from '@ct/types';
import { DEFAULT_FEE_CONFIG } from '@ct/types';

/**
 * Expected Value: EV = Σ(probability × preço)
 */
export function calculateEV(outputs: ContractOutput[]): number {
  return outputs.reduce((sum, o) => sum + o.probability * o.price, 0);
}

export function applyFees(value: number, feePercent: number): number {
  return value * (1 - feePercent / 100);
}

export function calculateNetProceeds(
  grossPrice: number,
  fees: FeeConfig = DEFAULT_FEE_CONFIG,
  marketplace: 'steam' | 'csfloat' | 'custom' = 'csfloat',
): number {
  const feePercent =
    marketplace === 'steam'
      ? fees.steamFeePercent
      : marketplace === 'csfloat'
        ? fees.csfloatFeePercent
        : (fees.customFeePercent ?? 0);

  const afterFee = applyFees(grossPrice, feePercent);
  const slippage = fees.slippagePercent ?? 0;
  return applyFees(afterFee, slippage);
}

function standardDeviation(outputs: ContractOutput[], ev: number): number {
  const variance = outputs.reduce((sum, o) => {
    const diff = o.price - ev;
    return sum + o.probability * diff * diff;
  }, 0);
  return Math.sqrt(variance);
}

/**
 * Risk Score 0–100 considerando variância, liquidez implícita, spread e perda.
 */
export function calculateRiskScore(
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

  const normalizedVariance = Math.min(variance / ((totalCost * totalCost) || 1), 1);
  const chanceFactor = 1 - targetChance;

  return Math.round((normalizedVariance * 50 + lossProb * 30 + chanceFactor * 20) * 100) / 100;
}

export function calculateSharpeRatio(
  expectedReturn: number,
  riskFreeRate: number,
  stdDev: number,
): number {
  if (stdDev === 0) return 0;
  return (expectedReturn - riskFreeRate) / stdDev;
}

export function calculateEVMetrics(
  outputs: ContractOutput[],
  totalCost: number,
  targetSkinId: string,
  fees?: FeeConfig,
): EVMetrics {
  const expectedValue = calculateEV(outputs);
  const expectedProfit = expectedValue - totalCost;
  const roi = totalCost > 0 ? (expectedProfit / totalCost) * 100 : 0;

  const targetOutput = outputs.find((o) => o.item.id === targetSkinId);
  const targetChance = targetOutput?.probability ?? 0;

  const profits = outputs.map((o) => o.price - totalCost);
  const maxLoss = Math.min(...profits, 0);

  const lossProb = outputs
    .filter((o) => o.price < totalCost)
    .reduce((sum, o) => sum + o.probability, 0);

  const gainProb = outputs
    .filter((o) => o.price > totalCost)
    .reduce((sum, o) => sum + o.probability, 0);

  const weightedLoss = outputs
    .filter((o) => o.price < totalCost)
    .reduce((sum, o) => sum + o.probability * (totalCost - o.price), 0);

  const weightedGain = outputs
    .filter((o) => o.price > totalCost)
    .reduce((sum, o) => sum + o.probability * (o.price - totalCost), 0);

  const averageLoss = lossProb > 0 ? weightedLoss / lossProb : 0;
  const averageGain = gainProb > 0 ? weightedGain / gainProb : 0;

  const breakEvenChance = outputs
    .filter((o) => o.price >= totalCost)
    .reduce((sum, o) => sum + o.probability, 0);

  const stdDev = standardDeviation(outputs, expectedValue);
  const sharpeRatio = calculateSharpeRatio(expectedProfit, 0, stdDev);

  let netExpectedValue = expectedValue;
  if (fees) {
    netExpectedValue = outputs.reduce(
      (sum, o) => sum + o.probability * calculateNetProceeds(o.price, fees, 'csfloat'),
      0,
    );
  }

  return {
    expectedValue: fees ? netExpectedValue : expectedValue,
    totalCost,
    expectedProfit: (fees ? netExpectedValue : expectedValue) - totalCost,
    roi: totalCost > 0 ? (((fees ? netExpectedValue : expectedValue) - totalCost) / totalCost) * 100 : 0,
    marginPercent: roi,
    maxLoss: Math.abs(maxLoss),
    averageLoss,
    averageGain,
    targetChance,
    breakEvenChance,
    lossChance: lossProb,
    isBreakEven: Math.abs(expectedValue - totalCost) < 0.01,
    riskScore: calculateRiskScore(outputs, totalCost, targetChance),
    sharpeRatio,
    standardDeviation: stdDev,
  };
}

export function analyzeScenarios(
  outputs: ContractOutput[],
  totalCost: number,
): { worstCase: ScenarioCase; bestCase: ScenarioCase } {
  if (outputs.length === 0) {
    return {
      worstCase: {
        skinId: '', skinName: '-', float: 0, wear: 'Battle-Scarred',
        price: 0, profitOrLoss: -totalCost, percent: -100,
      },
      bestCase: {
        skinId: '', skinName: '-', float: 0, wear: 'Factory New',
        price: 0, profitOrLoss: -totalCost, percent: -100,
      },
    };
  }

  const sorted = [...outputs].sort((a, b) => a.price - b.price);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];

  const worstProfit = worst.price - totalCost;
  const bestProfit = best.price - totalCost;

  return {
    worstCase: {
      skinId: worst.item.id,
      skinName: worst.item.name,
      float: worst.expectedFloat,
      wear: worst.expectedWear,
      price: worst.price,
      profitOrLoss: worstProfit,
      percent: totalCost > 0 ? (worstProfit / totalCost) * 100 : 0,
    },
    bestCase: {
      skinId: best.item.id,
      skinName: best.item.name,
      float: best.expectedFloat,
      wear: best.expectedWear,
      price: best.price,
      profitOrLoss: bestProfit,
      percent: totalCost > 0 ? (bestProfit / totalCost) * 100 : 0,
    },
  };
}
