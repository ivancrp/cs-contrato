import { planInputsForTargetChance, calculateOutputFloat, calculateAverageNormalizedFloat } from '@ct/engine';
import type { Collection, ContractInput, SkinItem } from '@ct/types';
import {
  buildBalancedCandidatePool,
  buildCheapCandidatePool,
  buildFloatFocusedPool,
  buildTargetHeavyPool,
  computeConstrainedFloorCost,
  computeFloorCost,
  hasTargetCollectionCandidates,
  isFeasibleContract,
} from './candidate-pool.js';
import { runOptimization, runOptimizationWithTargetMinimum } from './run-optimization.js';
import type { CandidateListing, OptimizationContext } from './scoring.js';
import {
  MIN_LOSS_TIER,
  TIER_CONFIGS,
  type TierOptimizationConfig,
} from './tier-configs.js';

const INPUT_COUNT = 10;

export interface TierOptimizationResult {
  tierId: string;
  label: string;
  inputs: ContractInput[];
  score: number;
  algorithm: string;
  strategy: TierOptimizationConfig['strategy'];
}

function combinationSignature(inputs: ContractInput[]): string {
  return inputs
    .map((input) => `${input.item.id}:${input.listing.float.toFixed(4)}`)
    .sort()
    .join('|');
}

function countTargetItems(
  inputs: ContractInput[],
  candidates: CandidateListing[],
): number {
  return inputs.filter((input) => {
    const match = candidates.find(
      (c) =>
        c.item.id === input.item.id &&
        Math.abs(c.listing.float - input.listing.float) < 0.0001,
    );
    return match?.isTargetCollection ?? false;
  }).length;
}

function resolveTierConfig(
  config: TierOptimizationConfig,
  targetSkin: SkinItem,
  collections: Collection[],
): TierOptimizationConfig | null {
  if (config.tierId !== 'target_60') return config;

  const plan = planInputsForTargetChance(
    targetSkin,
    collections,
    config.minTargetChance ?? 0.6,
  );
  if (!plan) return null;

  return {
    ...config,
    targetCollectionId: plan.collectionId,
    minTargetCount: plan.inputCount,
    targetRatio: plan.inputCount / INPUT_COUNT,
    label: `🎯 ${Math.round(plan.expectedChance * 100)}% chance no alvo`,
  };
}

function filterCandidatesForTier(
  candidates: CandidateListing[],
  config: TierOptimizationConfig,
): CandidateListing[] {
  switch (config.poolType) {
    case 'cheap':
      return buildCheapCandidatePool(candidates);
    case 'float':
      return buildFloatFocusedPool(candidates);
    case 'target_heavy':
      return config.targetCollectionId
        ? buildTargetHeavyPool(candidates, config.targetCollectionId)
        : buildBalancedCandidatePool(candidates);
    case 'full':
    default:
      return buildBalancedCandidatePool(candidates);
  }
}

function isValidResult(
  result: ReturnType<typeof runOptimization>,
  candidates: CandidateListing[],
  config: TierOptimizationConfig,
  budget: number,
  floorCost: number,
  requiresTargetCollection: boolean,
  outputsForSelection: OptimizationContext['outputsForSelection'],
  targetSkin?: SkinItem,
  targetMaxOutputFloat?: number,
): boolean {
  if (!result.inputs.length || !Number.isFinite(result.score)) return false;
  if (result.inputs.length !== INPUT_COUNT) return false;

  const totalCost = result.inputs.reduce((sum, input) => sum + input.listing.price, 0);
  const outputs = outputsForSelection(result.inputs);
  if (outputs.length === 0) return false;

  const wearLocked = targetMaxOutputFloat !== undefined;
  const minEvRatio = wearLocked ? config.minEvRatio * 0.72 : config.minEvRatio;
  const maxCostMultiplier = wearLocked ? config.maxCostMultiplier * 1.2 : config.maxCostMultiplier;

  if (
    !isFeasibleContract(
      outputs,
      totalCost,
      budget,
      floorCost,
      maxCostMultiplier,
      minEvRatio,
    )
  ) {
    return false;
  }

  const targetCount = countTargetItems(result.inputs, candidates);
  if (requiresTargetCollection && targetCount < config.minTargetCount) return false;
  if (config.maxTargetCount === 1 && targetCount !== 1) return false;
  if (targetCount > config.maxTargetCount) return false;

  if (targetSkin && targetMaxOutputFloat !== undefined) {
    const outputFloat = calculateOutputFloat(
      calculateAverageNormalizedFloat(result.inputs),
      targetSkin,
    );
    if (outputFloat > targetMaxOutputFloat + 0.0001) return false;
  }

  return true;
}

function optimizeSingleTier(
  baseContext: OptimizationContext,
  config: TierOptimizationConfig,
  allCandidates: CandidateListing[],
  targetSkin: SkinItem,
  collections: Collection[],
  baseBudget: number,
  targetMaxOutputFloat?: number,
): TierOptimizationResult | null {
  const resolved = resolveTierConfig(config, targetSkin, collections);
  if (!resolved) return null;

  const tierCandidates = filterCandidatesForTier(allCandidates, resolved);
  if (tierCandidates.length < INPUT_COUNT) return null;

  if (resolved.targetCollectionId) {
    const collectionCount = tierCandidates.filter(
      (c) => c.item.collectionId === resolved.targetCollectionId,
    ).length;
    if (collectionCount < resolved.minTargetCount) return null;
  }

  const budget = Math.ceil(baseBudget * resolved.budgetMultiplier);
  const requiresTarget = hasTargetCollectionCandidates(allCandidates);
  const floorCost = requiresTarget
    ? computeConstrainedFloorCost(tierCandidates, INPUT_COUNT, resolved.minTargetCount)
    : computeFloorCost(tierCandidates);

  const context: OptimizationContext = {
    ...baseContext,
    candidates: tierCandidates,
    strategy: resolved.strategy,
    budget,
  };

  const result = requiresTarget
    ? runOptimizationWithTargetMinimum(context, resolved.minTargetCount)
    : runOptimization(context);
  if (
    !isValidResult(
      result,
      allCandidates,
      resolved,
      budget,
      floorCost,
      requiresTarget,
      baseContext.outputsForSelection,
      targetSkin,
      targetMaxOutputFloat,
    )
  ) {
    return null;
  }

  return {
    tierId: resolved.tierId,
    label: resolved.label,
    inputs: result.inputs,
    score: result.score,
    algorithm: result.algorithm,
    strategy: resolved.strategy,
  };
}

export function optimizeAllTiers(
  baseContext: OptimizationContext,
  options: {
    targetSkin: SkinItem;
    collections: Collection[];
    baseBudget: number;
    includeMinLoss?: boolean;
    targetMaxOutputFloat?: number;
  },
): TierOptimizationResult[] {
  const results: TierOptimizationResult[] = [];
  const used = new Set<string>();

  for (const config of TIER_CONFIGS) {
    const result = optimizeSingleTier(
      baseContext,
      config,
      baseContext.candidates,
      options.targetSkin,
      options.collections,
      options.baseBudget,
      options.targetMaxOutputFloat,
    );
    if (!result) continue;

    const sig = combinationSignature(result.inputs);
    if (used.has(sig)) continue;
    used.add(sig);
    results.push(result);
  }

  if (options.includeMinLoss !== false) {
    const minLoss = optimizeSingleTier(
      baseContext,
      MIN_LOSS_TIER,
      baseContext.candidates,
      options.targetSkin,
      options.collections,
      options.baseBudget,
      options.targetMaxOutputFloat,
    );
    if (minLoss) {
      const sig = combinationSignature(minLoss.inputs);
      if (!used.has(sig)) {
        results.push(minLoss);
      }
    }
  }

  return results;
}
