import type { ContractOutput, OptimizationMode } from '../models/types';
import { calculateEV } from '../math/ev';

export interface ScoreWeights {
  ev: number;
  chance: number;
  cost: number;
  risk: number;
  loss: number;
  float: number;
}

const MODE_WEIGHTS: Record<OptimizationMode, ScoreWeights> = {
  low_cost: { ev: 0.15, chance: 0.15, cost: 0.4, risk: 0.1, loss: 0.1, float: 0.1 },
  balanced: { ev: 0.2, chance: 0.2, cost: 0.2, risk: 0.15, loss: 0.15, float: 0.1 },
  high_chance: { ev: 0.25, chance: 0.35, cost: 0.1, risk: 0.1, loss: 0.1, float: 0.1 },
  min_loss: { ev: 0.15, chance: 0.1, cost: 0.1, risk: 0.25, loss: 0.35, float: 0.05 },
};

export interface ContractScoreInput {
  outputs: ContractOutput[];
  totalCost: number;
  targetSkinId: string;
  expectedFloat: number;
  maxFloat: number;
  budget: number;
}

/**
 * Calcula score normalizado 0-100 para ranking de contratos.
 */
export function calculateContractScore(
  input: ContractScoreInput,
  mode: OptimizationMode = 'balanced',
): number {
  const weights = MODE_WEIGHTS[mode];
  const ev = calculateEV(input.outputs);
  const target = input.outputs.find((o) => o.item.id === input.targetSkinId);
  const chance = target?.probability ?? 0;

  const roi = input.totalCost > 0 ? (ev - input.totalCost) / input.totalCost : 0;
  const lossOutputs = input.outputs.filter((o) => o.price < input.totalCost);
  const lossProb = lossOutputs.reduce((s, o) => s + o.probability, 0);
  const avgLoss = lossOutputs.length > 0
    ? lossOutputs.reduce((s, o) => s + o.probability * (input.totalCost - o.price), 0) / (lossProb || 1)
    : 0;

  const floatPenalty = input.expectedFloat > input.maxFloat
    ? (input.expectedFloat - input.maxFloat) * 10
    : 0;

  const budgetPenalty = input.totalCost > input.budget
    ? (input.totalCost - input.budget) / input.budget
    : 0;

  const normEv = Math.min(Math.max(roi, -1), 2) / 2;
  const normChance = Math.min(chance * 5, 1);
  const normCost = 1 - Math.min(input.totalCost / (input.budget || 1), 1.5) / 1.5;
  const normRisk = 1 - Math.min(lossProb, 1);
  const normLoss = 1 - Math.min(avgLoss / (input.totalCost || 1), 1);

  const raw =
    weights.ev * normEv +
    weights.chance * normChance +
    weights.cost * normCost +
    weights.risk * normRisk +
    weights.loss * normLoss -
    weights.float * floatPenalty -
    weights.cost * budgetPenalty;

  return Math.round(Math.min(Math.max(raw * 100, 0), 100));
}

/**
 * Converte score 0-100 em estrelas 1-5.
 */
export function scoreToStars(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 55) return 3;
  if (score >= 35) return 2;
  return 1;
}
