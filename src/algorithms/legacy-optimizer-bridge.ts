import { defaultRuleRegistry } from '@ct/contracts';
import { buildTradeUpContract } from '@ct/engine';
import { optimizeAllTiers, type TierOptimizationResult } from '@ct/optimizer';
import type { CandidateListing as PackageCandidate } from '@ct/optimizer';
import type { Collection, ContractInput, SkinItem } from '@ct/types';
import type { CandidateListing, Combination, EvaluationContext, OptimizationResult } from './types.js';
import { floatToWear } from '../math/wear';
import { buildMarketHashName } from '../utils/format';

function toPackageCandidates(candidates: CandidateListing[], itemsById: Map<string, SkinItem>): PackageCandidate[] {
  return candidates.map((c) => {
    const item = itemsById.get(c.itemId);
    if (!item) throw new Error(`Skin não encontrada: ${c.itemId}`);
    const wear = floatToWear(c.float);
    return {
      listing: {
        id: c.listingId,
        itemId: c.itemId,
        marketHashName: buildMarketHashName(item.name, item.stattrak, wear),
        marketplace: c.marketplace ?? 'csfloat',
        price: c.price,
        currency: 'BRL',
        float: c.float,
        wear,
        stattrak: item.stattrak,
        purchaseUrl: c.purchaseUrl,
      },
      item,
      isTargetCollection: c.isTargetCollection,
      floatFitScore: c.floatFitScore,
    };
  });
}

function inputsToCombination(inputs: ContractInput[], candidates: CandidateListing[]): Combination {
  return inputs.map((input) => {
    const idx = candidates.findIndex(
      (c) => c.itemId === input.item.id && Math.abs(c.float - input.listing.float) < 0.0001,
    );
    if (idx < 0) throw new Error('Input sem candidato correspondente');
    return idx;
  });
}

export interface PackageOptimizeOptions {
  collections: Collection[];
  itemsById: Map<string, SkinItem>;
}

/** Ponte legado → @ct/optimizer (optimizeAllTiers do monorepo). */
export function optimizeAllTiersViaPackage(
  baseCtx: EvaluationContext,
  options: PackageOptimizeOptions,
): Array<{
  result: OptimizationResult;
  algorithm: string;
  tierId: string;
  label: string;
}> {
  const rule = defaultRuleRegistry.getOrThrow('cs2_weapon_10');
  const packageCandidates = toPackageCandidates(baseCtx.candidates, options.itemsById);

  const tierResults = optimizeAllTiers(
    {
      candidates: packageCandidates,
      inputCount: rule.inputCount,
      targetSkinId: baseCtx.targetSkin.id,
      strategy: 'max_ev',
      budget: baseCtx.budget,
      outputsForSelection: (inputs) => {
        try {
          return buildTradeUpContract({
            inputs,
            targetSkin: baseCtx.targetSkin,
            rule,
            collections: options.collections,
            priceLookup: () => 10,
          }).outputs;
        } catch {
          return [];
        }
      },
    },
    {
      targetSkin: baseCtx.targetSkin,
      collections: options.collections,
      baseBudget: baseCtx.budget,
      includeMinLoss: true,
    },
  );

  return tierResults.map((tier: TierOptimizationResult) => {
    const combination = inputsToCombination(tier.inputs, baseCtx.candidates);
    const evaluated = baseCtx.evaluate(combination);
    return {
      result: {
        combination,
        candidatePool: [...baseCtx.candidates],
        inputs: tier.inputs,
        outputs: evaluated.outputs,
        totalCost: evaluated.totalCost,
        expectedFloat: evaluated.expectedFloat,
        score: Math.max(evaluated.score, tier.score * 100),
      },
      algorithm: tier.algorithm,
      tierId: tier.tierId,
      label: tier.label,
    };
  });
}

export { TIER_CONFIGS, MIN_LOSS_TIER, scoreToStars } from '@ct/optimizer';
