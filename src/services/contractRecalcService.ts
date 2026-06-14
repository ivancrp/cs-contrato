import type {
  ContractInput,
  ContractOutput,
  Marketplace,
  SkinItem,
  TargetSearchParams,
  TradeUpContract,
} from '../models/types';
import { calculateContractScore, scoreToStars } from '../algorithms/scoring';
import type { CandidateListing } from '../algorithms/types';
import { getCollections } from '../data/collections';
import { calculateEVMetrics } from '../math/ev';
import { calculateFloatMetrics } from '../math/float';
import { buildContractOutputs } from '../math/probability';
import {
  applyResolvedPriceToOutput,
  clearOutputPriceCache,
  resolveOutputPrice,
} from './outputPriceService';
import { priceService } from './priceService';
import { yieldToMain } from '../utils/yieldToMain';

const ENRICH_BATCH_SIZE = 4;

function createSyncPriceLookup(marketplace: Marketplace) {
  return (itemId: string, expectedFloat: number): number => {
    const item = getCollections().flatMap((c) => c.items).find((i) => i.id === itemId);
    if (!item) return 0;
    const price = priceService.getOutputPriceSync(
      item.name,
      item.stattrak,
      expectedFloat,
      marketplace,
    );
    return price > 0 ? price : priceService.getFallbackPrice(item.rarity, expectedFloat, item.stattrak);
  };
}

export async function enrichOutputsWithMarketPrices(
  outputs: ContractOutput[],
  marketplace: Marketplace,
): Promise<ContractOutput[]> {
  const enriched: ContractOutput[] = [];

  for (let index = 0; index < outputs.length; index += 1) {
    const output = outputs[index];
    const resolved = await resolveOutputPrice(output.item, output.expectedFloat, marketplace);
    enriched.push(applyResolvedPriceToOutput(output, resolved));

    if ((index + 1) % ENRICH_BATCH_SIZE === 0) {
      await yieldToMain();
    }
  }

  return enriched;
}

export async function applyMarketPricesToContract(
  contract: TradeUpContract,
  marketplace: Marketplace,
): Promise<TradeUpContract> {
  const targetId = contract.outputs.find((output) => output.isTarget)?.item.id ?? '';
  const outputs = await enrichOutputsWithMarketPrices(contract.outputs, marketplace);
  const evMetrics = calculateEVMetrics(outputs, contract.evMetrics.totalCost, targetId);

  return {
    ...contract,
    outputs,
    evMetrics,
  };
}

export async function enrichContractsWithMarketPrices(
  contracts: TradeUpContract[],
  marketplace: Marketplace,
): Promise<TradeUpContract[]> {
  clearOutputPriceCache();
  const enriched: TradeUpContract[] = [];

  for (const contract of contracts) {
    enriched.push(await applyMarketPricesToContract(contract, marketplace));
  }

  return enriched;
}

export function buildAlternativeOptions(
  candidates: CandidateListing[],
  currentInputs: ContractInput[],
  slotIndex: number,
): CandidateListing[] {
  const usedListingIds = new Set(
    currentInputs
      .filter((_, index) => index !== slotIndex)
      .map((input) => input.listing.id),
  );

  return candidates
    .filter((candidate) => !usedListingIds.has(candidate.listingId))
    .sort((a, b) => a.price - b.price || a.floatFitScore - b.floatFitScore);
}

export async function recalculateContractFromInputs(
  inputs: ContractInput[],
  targetSkin: SkinItem,
  params: TargetSearchParams,
  base?: Pick<TradeUpContract, 'tier' | 'tierLabel' | 'algorithmUsed' | 'aiScore'>,
): Promise<TradeUpContract> {
  await priceService.preload();

  const marketplace = params.marketplace;
  const maxFloat = params.maxFloat ?? 1;
  const priceLookup = createSyncPriceLookup(marketplace);

  const outputs = buildContractOutputs(
    inputs,
    getCollections(),
    targetSkin.rarity,
    targetSkin.stattrak,
    targetSkin.id,
    priceLookup,
  );

  const marketOutputs = await enrichOutputsWithMarketPrices(outputs, marketplace);
  const totalCost = inputs.reduce((sum, input) => sum + input.listing.price, 0);
  const floatMetrics = calculateFloatMetrics(inputs, targetSkin);
  const evMetrics = calculateEVMetrics(marketOutputs, totalCost, targetSkin.id);

  const score = calculateContractScore(
    {
      outputs: marketOutputs,
      totalCost,
      targetSkinId: targetSkin.id,
      expectedFloat: floatMetrics.expectedOutputFloat,
      maxFloat,
      budget: params.budget ?? totalCost * 2,
    },
    params.mode ?? 'balanced',
  );

  const collectionsUsed = [...new Set(inputs.map((input) => input.item.collectionId))].map((id) => {
    const col = getCollections().find((c) => c.id === id);
    return col?.name ?? id;
  });

  return {
    id: crypto.randomUUID(),
    tier: base?.tier ?? 'balanced',
    tierLabel: base?.tierLabel ?? 'Contrato personalizado',
    inputs,
    outputs: marketOutputs,
    floatMetrics: {
      averageInputFloat: floatMetrics.averageInputFloat,
      expectedOutputFloat: floatMetrics.expectedOutputFloat,
      expectedWear: floatMetrics.expectedWear,
      minPossibleFloat: floatMetrics.minPossibleFloat,
      maxPossibleFloat: floatMetrics.maxPossibleFloat,
    },
    evMetrics,
    aiScore: base?.aiScore ?? scoreToStars(score),
    algorithmUsed: base?.algorithmUsed ?? 'heuristic',
    collectionsUsed,
  };
}
