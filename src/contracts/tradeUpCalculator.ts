import { COLLECTIONS } from '../data/collections';
import { calculateEVMetrics } from '../math/ev';
import { calculateFloatMetrics } from '../math/float';
import { calculateExpectedFloatForOutput } from '../math/float';
import { buildContractOutputs, calculateOutputProbabilities } from '../math/probability';
import { getInputRarityForTarget } from '../math/probability';
import { assertValidContractInputs } from '../math/contractRules';
import { maxInputFloatForTarget } from '../math/wear';
import type {
  Collection,
  ContractInput,
  Marketplace,
  SkinItem,
  TradeUpContract,
} from '../models/types';
import { priceService } from '../services/priceService';
import { getRarityLabel } from '../utils/rarity';

/**
 * Encontra todas as coleções que contêm a skin alvo.
 */
export function findCollectionsForTarget(targetSkin: SkinItem): Collection[] {
  return COLLECTIONS.filter((col) =>
    col.items.some((item) => item.id === targetSkin.id),
  );
}

/**
 * Descobre skins de entrada possíveis para atingir a skin alvo.
 * Inclui skins de outras coleções (mix permitido) da mesma raridade e versão StatTrak.
 */
export function findInputCandidates(
  targetSkin: SkinItem,
  maxFloat: number,
): SkinItem[] {
  const inputRarity = getInputRarityForTarget(targetSkin.rarity);
  if (!inputRarity) return [];

  const targetCollections = findCollectionsForTarget(targetSkin);
  const targetCollectionIds = new Set(targetCollections.map((c) => c.id));

  const maxInputFloat = maxInputFloatForTarget(
    maxFloat,
    targetSkin.minFloat,
    targetSkin.maxFloat,
  );

  return COLLECTIONS.flatMap((col) =>
    col.items.filter(
      (item) =>
        !item.souvenir &&
        item.rarity === inputRarity &&
        item.stattrak === targetSkin.stattrak &&
        item.minFloat <= maxInputFloat,
    ),
  ).map((item) => ({
    ...item,
    _isTargetCollection: targetCollectionIds.has(item.collectionId),
  })) as (SkinItem & { _isTargetCollection?: boolean })[];
}

/**
 * Monta ContractInput[] a partir de listagens selecionadas.
 */
export function buildContractInputs(
  listings: { listing: import('../models/types').MarketListing; item: SkinItem }[],
): ContractInput[] {
  return listings.map(({ listing, item }) => ({ listing, item }));
}

/**
 * Calcula contrato completo a partir das entradas.
 */
export async function calculateContract(
  inputs: ContractInput[],
  targetSkin: SkinItem,
  marketplace: Marketplace,
  tier: TradeUpContract['tier'],
  tierLabel: string,
  algorithmUsed: import('../models/types').AlgorithmType,
  aiScore: number,
  priceLookup?: (itemId: string, expectedFloat: number) => Promise<number> | number,
): Promise<TradeUpContract> {
  assertValidContractInputs(inputs, targetSkin);

  const resolvePrice = async (itemId: string, expectedFloat: number): Promise<number> => {
    if (priceLookup) {
      const result = priceLookup(itemId, expectedFloat);
      return result instanceof Promise ? result : result;
    }
    const item = COLLECTIONS.flatMap((c) => c.items).find((i) => i.id === itemId);
    if (!item) return 0;
    const price = await priceService.getOutputPrice(
      item.name,
      item.stattrak,
      expectedFloat,
      marketplace,
    );
    return price > 0 ? price : priceService.getFallbackPrice(item.rarity, expectedFloat, item.stattrak);
  };

  const probabilities = calculateOutputProbabilities(
    inputs,
    COLLECTIONS,
    targetSkin.rarity,
    targetSkin.stattrak,
  );

  const priceCache = new Map<string, number>();
  for (const skinId of probabilities.keys()) {
    const item = COLLECTIONS.flatMap((c) => c.items).find((i) => i.id === skinId);
    if (!item) continue;
    const expectedFloat = calculateExpectedFloatForOutput(inputs, item);
    const key = `${skinId}-${expectedFloat.toFixed(4)}`;
    priceCache.set(key, await resolvePrice(skinId, expectedFloat));
  }

  const priceLookupSync = (itemId: string, expectedFloat: number): number => {
    const key = `${itemId}-${expectedFloat.toFixed(4)}`;
    if (priceCache.has(key)) return priceCache.get(key)!;
    const item = COLLECTIONS.flatMap((c) => c.items).find((i) => i.id === itemId);
    if (!item) return 0;
    return priceService.getFallbackPrice(item.rarity, expectedFloat, item.stattrak);
  };

  const outputs = buildContractOutputs(
    inputs,
    COLLECTIONS,
    targetSkin.rarity,
    targetSkin.stattrak,
    targetSkin.id,
    priceLookupSync,
  );

  const totalCost = inputs.reduce((sum, i) => sum + i.listing.price, 0);
  const floatMetrics = calculateFloatMetrics(inputs, targetSkin);
  const evMetrics = calculateEVMetrics(outputs, totalCost, targetSkin.id);

  const collectionsUsed = [...new Set(inputs.map((i) => i.item.collectionId))].map((id) => {
    const col = COLLECTIONS.find((c) => c.id === id);
    return col?.name ?? id;
  });

  return {
    id: crypto.randomUUID(),
    tier,
    tierLabel,
    inputs,
    outputs,
    floatMetrics: {
      averageInputFloat: floatMetrics.averageInputFloat,
      expectedOutputFloat: floatMetrics.expectedOutputFloat,
      expectedWear: floatMetrics.expectedWear,
      minPossibleFloat: floatMetrics.minPossibleFloat,
      maxPossibleFloat: floatMetrics.maxPossibleFloat,
    },
    evMetrics,
    aiScore,
    algorithmUsed,
    collectionsUsed,
  };
}

export function getCollectionName(collectionId: string): string {
  return COLLECTIONS.find((c) => c.id === collectionId)?.name ?? collectionId;
}

export function getItemRarityLabel(item: SkinItem): string {
  return getRarityLabel(item.rarity);
}
