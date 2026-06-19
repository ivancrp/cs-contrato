import {
  calculateAverageNormalizedFloat,
  calculateEVMetrics,
  calculateOutputFloat,
  planInputsForTargetChance,
} from '@ct/engine';
import type { Collection, ContractInput, EVMetrics, SkinItem } from '@ct/types';
import {
  buildBalancedCandidatePool,
  buildCheapCandidatePool,
  buildFloatFocusedPool,
  buildTargetHeavyPool,
  hasTargetCollectionCandidates,
} from './candidate-pool.js';
import { runOptimization, runOptimizationWithTargetMinimum } from './run-optimization.js';
import type { CandidateListing, OptimizationContext } from './scoring.js';

const INPUT_COUNT = 10;

export type AnalysisObjectiveId =
  | 'min_loss'
  | 'max_profit'
  | 'max_chance'
  | 'high_risk_profit'
  | 'wear_target';

export interface ObjectiveConfig {
  id: AnalysisObjectiveId;
  label: string;
  maxTargetChance?: number;
}

export interface ObjectiveOptimizationResult {
  tierId: string;
  label: string;
  inputs: ContractInput[];
  score: number;
  algorithm: string;
  strategy: string;
  metrics: EVMetrics;
}

export const ANALYSIS_OBJECTIVES: ObjectiveConfig[] = [
  { id: 'min_loss', label: '🛡 Menor perda possível' },
  { id: 'max_profit', label: '💰 Maior lucro esperado' },
  { id: 'max_chance', label: '🎯 Maiores chances no alvo' },
  { id: 'high_risk_profit', label: '⚡ Menor chance · maior lucro', maxTargetChance: 0.25 },
];

export const WEAR_TARGET_OBJECTIVE: ObjectiveConfig = {
  id: 'wear_target',
  label: '◎ Wear alvo (float ideal)',
};

interface GeneratedContract {
  inputs: ContractInput[];
  metrics: EVMetrics;
  algorithm: string;
  signature: string;
}

function combinationSignature(inputs: ContractInput[]): string {
  return inputs
    .map((input) => `${input.item.id}:${input.listing.float.toFixed(4)}`)
    .sort()
    .join('|');
}

function isWearValid(
  inputs: ContractInput[],
  targetSkin: SkinItem,
  targetMaxOutputFloat?: number,
): boolean {
  if (targetMaxOutputFloat === undefined) return true;
  const outputFloat = calculateOutputFloat(
    calculateAverageNormalizedFloat(inputs),
    targetSkin,
  );
  return outputFloat <= targetMaxOutputFloat + 0.0001;
}

function objectiveScore(objectiveId: AnalysisObjectiveId, metrics: EVMetrics): number {
  switch (objectiveId) {
    case 'min_loss':
      return (
        (1 - metrics.lossChance) * 500 +
        metrics.expectedProfit * 0.4 -
        metrics.averageLoss * 3 -
        metrics.riskScore * 0.4
      );
    case 'max_profit':
      return metrics.expectedProfit * 200 + metrics.roi * 0.5;
    case 'max_chance':
      return metrics.targetChance * 5000 + metrics.expectedProfit * 0.5;
    case 'high_risk_profit':
      if (metrics.targetChance > 0.25) return -Infinity;
      return metrics.expectedProfit * 250 - metrics.lossChance * 120 + metrics.roi * 0.5;
    case 'wear_target':
      return (
        (1 - metrics.lossChance) * 120 +
        metrics.targetChance * 300 +
        metrics.expectedProfit * 0.5 -
        metrics.averageLoss
      );
    default:
      return metrics.expectedProfit;
  }
}

function tryAddContract(
  inputs: ContractInput[],
  algorithm: string,
  baseContext: OptimizationContext,
  targetSkin: SkinItem,
  targetMaxOutputFloat: number | undefined,
  budget: number,
  seen: Set<string>,
  results: GeneratedContract[],
): void {
  if (inputs.length !== INPUT_COUNT) return;

  const signature = combinationSignature(inputs);
  if (seen.has(signature)) return;
  if (!isWearValid(inputs, targetSkin, targetMaxOutputFloat)) return;

  const totalCost = inputs.reduce((sum, input) => sum + input.listing.price, 0);
  if (totalCost > budget) return;

  const outputs = baseContext.outputsForSelection(inputs);
  if (outputs.length === 0) return;

  const metrics = calculateEVMetrics(outputs, totalCost, baseContext.targetSkinId);
  if (metrics.targetChance <= 0) return;

  seen.add(signature);
  results.push({ inputs, metrics, algorithm, signature });
}

function generateContractCandidates(
  baseContext: OptimizationContext,
  allCandidates: CandidateListing[],
  targetSkin: SkinItem,
  collections: Collection[],
  baseBudget: number,
  targetMaxOutputFloat?: number,
): GeneratedContract[] {
  const plan = planInputsForTargetChance(targetSkin, collections, 0.6);
  const targetCollectionId = plan?.collectionId;
  const budget = Math.ceil(baseBudget * 3.5);
  const seen = new Set<string>();
  const results: GeneratedContract[] = [];

  const poolConfigs: {
    pool: CandidateListing[];
    strategy: OptimizationContext['strategy'];
    targetCounts: number[];
  }[] = [
    {
      pool: buildFloatFocusedPool(allCandidates, 55),
      strategy: 'min_loss',
      targetCounts: [1, 2, 3],
    },
    {
      pool: buildCheapCandidatePool(allCandidates, 55),
      strategy: 'min_loss',
      targetCounts: [1, 2],
    },
    {
      pool: buildBalancedCandidatePool(allCandidates, 60),
      strategy: 'max_profit',
      targetCounts: [1, 2, 3, 4],
    },
  ];

  if (targetCollectionId) {
    const maxChanceCount = plan ? Math.min(10, plan.inputCount) : 8;
    const chanceCounts = [...new Set([1, 2, 3, 4, 5, 6, 7, 8, maxChanceCount])]
      .filter((n) => n >= 1 && n <= 10)
      .sort((a, b) => a - b);

    poolConfigs.push({
      pool: buildTargetHeavyPool(allCandidates, targetCollectionId, 60),
      strategy: 'max_profit_chance',
      targetCounts: chanceCounts,
    });
  }

  for (const { pool, strategy, targetCounts } of poolConfigs) {
    if (pool.length < INPUT_COUNT) continue;

    const context: OptimizationContext = {
      ...baseContext,
      candidates: pool,
      strategy,
      budget,
    };

    const generic = runOptimization(context);
    tryAddContract(
      generic.inputs,
      generic.algorithm,
      baseContext,
      targetSkin,
      targetMaxOutputFloat,
      budget,
      seen,
      results,
    );

    if (!hasTargetCollectionCandidates(pool)) continue;

    for (const targetCount of targetCounts) {
      const fixed = runOptimizationWithTargetMinimum(context, targetCount);
      tryAddContract(
        fixed.inputs,
        `target_${targetCount}+${fixed.algorithm}`,
        baseContext,
        targetSkin,
        targetMaxOutputFloat,
        budget,
        seen,
        results,
      );
    }
  }

  return results;
}

function labelForObjective(objective: ObjectiveConfig, metrics: EVMetrics): string {
  if (objective.id === 'max_chance' && metrics.targetChance > 0.05) {
    return `${objective.label} · ${(metrics.targetChance * 100).toFixed(0)}%`;
  }
  if (objective.id === 'high_risk_profit') {
    return `${objective.label} · ${(metrics.targetChance * 100).toFixed(0)}% chance`;
  }
  return objective.label;
}

function pickBestPerObjective(
  candidates: GeneratedContract[],
  objectives: ObjectiveConfig[],
): ObjectiveOptimizationResult[] {
  const results: ObjectiveOptimizationResult[] = [];
  const usedSignatures = new Set<string>();

  for (const objective of objectives) {
    let best: GeneratedContract | null = null;
    let bestScore = -Infinity;

    const ranked = [...candidates].sort(
      (a, b) => objectiveScore(objective.id, b.metrics) - objectiveScore(objective.id, a.metrics),
    );

    for (const candidate of ranked) {
      if (
        objective.maxTargetChance !== undefined &&
        candidate.metrics.targetChance > objective.maxTargetChance
      ) {
        continue;
      }

      const score = objectiveScore(objective.id, candidate.metrics);
      if (!Number.isFinite(score)) continue;

      if (
        objective.id === 'high_risk_profit' &&
        usedSignatures.has(candidate.signature) &&
        ranked.some(
          (alt) =>
            alt.signature !== candidate.signature &&
            !usedSignatures.has(alt.signature) &&
            alt.metrics.targetChance <= (objective.maxTargetChance ?? 1) &&
            Number.isFinite(objectiveScore(objective.id, alt.metrics)),
        )
      ) {
        continue;
      }

      best = candidate;
      bestScore = score;
      break;
    }

    if (!best) continue;

    usedSignatures.add(best.signature);
    results.push({
      tierId: objective.id,
      label: labelForObjective(objective, best.metrics),
      inputs: best.inputs,
      score: bestScore,
      algorithm: best.algorithm,
      strategy: objective.id,
      metrics: best.metrics,
    });
  }

  return results;
}

export function optimizeByObjectives(
  baseContext: OptimizationContext,
  options: {
    targetSkin: SkinItem;
    collections: Collection[];
    baseBudget: number;
    targetMaxOutputFloat?: number;
    includeWearTarget?: boolean;
  },
): ObjectiveOptimizationResult[] {
  const candidates = generateContractCandidates(
    baseContext,
    baseContext.candidates,
    options.targetSkin,
    options.collections,
    options.baseBudget,
    options.targetMaxOutputFloat,
  );

  if (candidates.length === 0) return [];

  const objectives: ObjectiveConfig[] = [];
  if (options.includeWearTarget && options.targetMaxOutputFloat !== undefined) {
    objectives.push(WEAR_TARGET_OBJECTIVE);
  }
  objectives.push(...ANALYSIS_OBJECTIVES);

  const displayOrder: AnalysisObjectiveId[] = [
    'wear_target',
    'min_loss',
    'max_profit',
    'max_chance',
    'high_risk_profit',
  ];

  return pickBestPerObjective(candidates, objectives).sort(
    (a, b) =>
      displayOrder.indexOf(a.tierId as AnalysisObjectiveId) -
      displayOrder.indexOf(b.tierId as AnalysisObjectiveId),
  );
}
