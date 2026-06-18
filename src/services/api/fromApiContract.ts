import type { AlgorithmType, TradeUpContract } from '../../models/types';
import type { CandidateListing } from '../../algorithms/types';

export interface ApiSearchCandidate {
  listingId: string;
  itemId: string;
  collectionId: string;
  rarity: TradeUpContract['inputs'][0]['item']['rarity'];
  stattrak: boolean;
  price: number;
  float: number;
  normalizedFloat: number;
  floatFitScore: number;
  isTargetCollection: boolean;
  marketplace: TradeUpContract['inputs'][0]['listing']['marketplace'];
  purchaseUrl?: string;
}

export interface ApiEnrichedContract {
  id: string;
  tier: string;
  tierLabel: string;
  inputs: TradeUpContract['inputs'];
  outputs: TradeUpContract['outputs'];
  floatMetrics: TradeUpContract['floatMetrics'] & { averageNormalizedFloat?: number };
  evMetrics: TradeUpContract['evMetrics'] & { lossChance?: number };
  aiScore: number;
  algorithmUsed: string;
  collectionsUsed: string[];
  worstCase?: unknown;
  bestCase?: unknown;
}

export function fromApiSearchCandidate(candidate: ApiSearchCandidate): CandidateListing {
  return {
    listingId: candidate.listingId,
    itemId: candidate.itemId,
    collectionId: candidate.collectionId,
    rarity: candidate.rarity,
    stattrak: candidate.stattrak,
    price: candidate.price,
    float: candidate.float,
    normalizedFloat: candidate.normalizedFloat,
    floatFitScore: candidate.floatFitScore,
    isTargetCollection: candidate.isTargetCollection,
    marketVerified: Boolean(candidate.purchaseUrl),
    marketplace: candidate.marketplace,
    purchaseUrl: candidate.purchaseUrl,
  };
}

export function fromApiContract(contract: ApiEnrichedContract): TradeUpContract {
  return {
    id: contract.id,
    tier: contract.tier as TradeUpContract['tier'],
    tierLabel: contract.tierLabel,
    inputs: contract.inputs,
    outputs: contract.outputs,
    floatMetrics: {
      averageInputFloat: contract.floatMetrics.averageInputFloat,
      expectedOutputFloat: contract.floatMetrics.expectedOutputFloat,
      expectedWear: contract.floatMetrics.expectedWear,
      minPossibleFloat: contract.floatMetrics.minPossibleFloat,
      maxPossibleFloat: contract.floatMetrics.maxPossibleFloat,
    },
    evMetrics: {
      expectedValue: contract.evMetrics.expectedValue,
      totalCost: contract.evMetrics.totalCost,
      expectedProfit: contract.evMetrics.expectedProfit,
      roi: contract.evMetrics.roi,
      marginPercent: contract.evMetrics.marginPercent,
      maxLoss: contract.evMetrics.maxLoss,
      averageLoss: contract.evMetrics.averageLoss,
      averageGain: contract.evMetrics.averageGain,
      targetChance: contract.evMetrics.targetChance,
      breakEvenChance: contract.evMetrics.breakEvenChance,
      isBreakEven: contract.evMetrics.expectedProfit >= 0,
      riskScore: contract.evMetrics.riskScore,
    },
    aiScore: contract.aiScore,
    algorithmUsed: contract.algorithmUsed as AlgorithmType,
    collectionsUsed: contract.collectionsUsed,
  };
}
