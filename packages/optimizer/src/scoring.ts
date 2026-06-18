import type { ContractInput, ContractOutput, OptimizationStrategy } from '@ct/types';
import { calculateEVMetrics } from '@ct/engine';

export interface CandidateListing {
  listing: ContractInput['listing'];
  item: ContractInput['item'];
  isTargetCollection?: boolean;
  floatFitScore?: number;
}

export interface OptimizationContext {
  candidates: CandidateListing[];
  inputCount: number;
  targetSkinId: string;
  outputsForSelection: (inputs: ContractInput[]) => ContractOutput[];
  budget?: number;
  strategy: OptimizationStrategy;
}

export interface OptimizationResult {
  inputs: ContractInput[];
  score: number;
  strategy: OptimizationStrategy;
  algorithm: string;
}

export const STRATEGY_WEIGHTS: Record<
  OptimizationStrategy,
  { ev: number; roi: number; risk: number; profitChance: number; loss: number }
> = {
  max_profit: { ev: 0.5, roi: 0.3, risk: 0.05, profitChance: 0.1, loss: 0.05 },
  max_ev: { ev: 0.7, roi: 0.2, risk: 0.05, profitChance: 0.05, loss: 0 },
  min_loss: { ev: 0.1, roi: 0.1, risk: 0.3, profitChance: 0.1, loss: 0.4 },
  max_profit_chance: { ev: 0.2, roi: 0.1, risk: 0.1, profitChance: 0.5, loss: 0.1 },
  min_risk: { ev: 0.2, roi: 0.1, risk: 0.5, profitChance: 0.1, loss: 0.1 },
  max_sharpe: { ev: 0.3, roi: 0.2, risk: 0.3, profitChance: 0.1, loss: 0.1 },
  risk_adjusted_return: { ev: 0.25, roi: 0.25, risk: 0.25, profitChance: 0.15, loss: 0.1 },
};

export function scoreSelection(
  inputs: ContractInput[],
  context: OptimizationContext,
): number {
  const totalCost = inputs.reduce((s, i) => s + i.listing.price, 0);
  if (context.budget && totalCost > context.budget) return -Infinity;

  const outputs = context.outputsForSelection(inputs);
  if (outputs.length === 0) return -Infinity;

  const metrics = calculateEVMetrics(outputs, totalCost, context.targetSkinId);
  const weights = STRATEGY_WEIGHTS[context.strategy];

  const evNorm = metrics.expectedValue / (totalCost || 1);
  const roiNorm = metrics.roi / 100;
  const riskNorm = 1 - metrics.riskScore / 100;
  const profitChanceNorm = metrics.breakEvenChance;
  const lossNorm = 1 - metrics.lossChance;

  return (
    weights.ev * evNorm +
    weights.roi * roiNorm +
    weights.risk * riskNorm +
    weights.profitChance * profitChanceNorm +
    weights.loss * lossNorm
  );
}
