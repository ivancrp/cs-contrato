import type { OptimizationStrategy } from '@ct/types';

export type TierPoolType = 'cheap' | 'float' | 'full' | 'target_heavy';

export interface TierOptimizationConfig {
  tierId: string;
  label: string;
  strategy: OptimizationStrategy;
  budgetMultiplier: number;
  targetRatio: number;
  minTargetCount: number;
  maxTargetCount: number;
  poolType: TierPoolType;
  maxCostMultiplier: number;
  minEvRatio: number;
  minTargetChance?: number;
  targetCollectionId?: string;
}

export const TIER_CONFIGS: TierOptimizationConfig[] = [
  {
    tierId: 'wear_target',
    label: '◎ Wear alvo (float ideal)',
    strategy: 'min_loss',
    budgetMultiplier: 1.75,
    targetRatio: 0.2,
    minTargetCount: 1,
    maxTargetCount: 6,
    poolType: 'float',
    maxCostMultiplier: 2.1,
    minEvRatio: 0.28,
  },
  {
    tierId: 'budget',
    label: '$ Menor custo',
    strategy: 'min_loss',
    budgetMultiplier: 1.45,
    targetRatio: 0.1,
    minTargetCount: 1,
    maxTargetCount: 3,
    poolType: 'cheap',
    maxCostMultiplier: 1.55,
    minEvRatio: 0.45,
  },
  {
    tierId: 'one_target',
    label: '◎ 1 skin da coleção alvo',
    strategy: 'min_loss',
    budgetMultiplier: 1.35,
    targetRatio: 0.1,
    minTargetCount: 1,
    maxTargetCount: 1,
    poolType: 'cheap',
    maxCostMultiplier: 1.45,
    minEvRatio: 0.45,
  },
  {
    tierId: 'float_safe',
    label: '◎ Float ideal (econômico)',
    strategy: 'max_ev',
    budgetMultiplier: 1.65,
    targetRatio: 0.2,
    minTargetCount: 1,
    maxTargetCount: 4,
    poolType: 'float',
    maxCostMultiplier: 1.75,
    minEvRatio: 0.48,
  },
  {
    tierId: 'balanced',
    label: '$$ Equilibrado',
    strategy: 'max_ev',
    budgetMultiplier: 2.0,
    targetRatio: 0.4,
    minTargetCount: 1,
    maxTargetCount: 7,
    poolType: 'full',
    maxCostMultiplier: 2.2,
    minEvRatio: 0.42,
  },
  {
    tierId: 'premium',
    label: '$$$ Maior chance',
    strategy: 'max_profit_chance',
    budgetMultiplier: 2.6,
    targetRatio: 0.7,
    minTargetCount: 1,
    maxTargetCount: 10,
    poolType: 'full',
    maxCostMultiplier: 3.0,
    minEvRatio: 0.35,
  },
  {
    tierId: 'target_60',
    label: '🎯 60% chance no alvo',
    strategy: 'max_profit_chance',
    budgetMultiplier: 2.8,
    targetRatio: 0.6,
    minTargetCount: 6,
    maxTargetCount: 10,
    poolType: 'target_heavy',
    maxCostMultiplier: 3.2,
    minEvRatio: 0.3,
    minTargetChance: 0.6,
  },
];

export const MIN_LOSS_TIER: TierOptimizationConfig = {
  tierId: 'min_loss',
  label: '🛡 Menor Perda Possível',
  strategy: 'min_loss',
  budgetMultiplier: 1.35,
  targetRatio: 0.1,
  minTargetCount: 1,
  maxTargetCount: 10,
  poolType: 'cheap',
  maxCostMultiplier: 1.55,
  minEvRatio: 0.45,
};

export function scoreToStars(score: number): number {
  if (!Number.isFinite(score)) return 1;
  const normalized = Math.min(Math.max(score, 0), 1) * 100;
  if (normalized >= 90) return 5;
  if (normalized >= 75) return 4;
  if (normalized >= 55) return 3;
  if (normalized >= 35) return 2;
  return 1;
}
